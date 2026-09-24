import { spawn } from 'node:child_process'
import { RuntimeAbortError, ToolError, throwIfAborted } from '../errors.js'
import type { Tool } from '../tool.js'
import type { JsonValue } from '../types.js'
import { integerInput, objectInput, requiredString } from './validation.js'

interface ShellInput {
  command: string
  timeoutMs: number
  maxOutputBytes: number
}

export const shellTool: Tool<ShellInput> = {
  name: 'shell',
  description:
    'Run a foreground POSIX shell command in the workspace with the host user permissions. This is NOT a filesystem or network sandbox. Commands require shell permission. Background descendants are terminated when the command finishes. Output and execution time are bounded.',
  permission: 'shell',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', minLength: 1 },
      timeoutMs: { type: 'integer', minimum: 1, maximum: 120_000 },
      maxOutputBytes: { type: 'integer', minimum: 1, maximum: 1_048_576 }
    },
    required: ['command'],
    additionalProperties: false
  },
  parse(input) {
    const object = objectInput(input, ['command', 'timeoutMs', 'maxOutputBytes'])
    return {
      command: requiredString(object, 'command'),
      timeoutMs: integerInput(object, 'timeoutMs', 30_000, 120_000),
      maxOutputBytes: integerInput(object, 'maxOutputBytes', 131_072, 1_048_576)
    }
  },
  async execute(input, context): Promise<JsonValue> {
    throwIfAborted(context.signal)
    // Windows needs a Job Object implementation before we can guarantee child-process cleanup.
    if (process.platform === 'win32') {
      throw new ToolError(
        'SHELL_UNSUPPORTED',
        'The built-in shell currently supports POSIX systems only'
      )
    }
    const cwd = await context.workspace.resolve('.')
    throwIfAborted(context.signal)
    return new Promise<JsonValue>((resolve, reject) => {
      const child = spawn('/bin/sh', ['-c', input.command], {
        cwd,
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      const stdout: Buffer[] = []
      const stderr: Buffer[] = []
      let outputBytes = 0
      let failure: ToolError | RuntimeAbortError | undefined
      let settled = false

      const killGroup = (): void => {
        if (child.pid === undefined) return
        try {
          // detached gives the shell its own group; killing only the shell leaves grandchildren alive.
          process.kill(-child.pid, 'SIGKILL')
        } catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ESRCH')) {
            failure ??= new ToolError(
              'SHELL_CLEANUP_FAILED',
              'Cannot terminate the shell process group',
              { cause: error }
            )
          }
        }
      }
      const stop = (error: ToolError | RuntimeAbortError): void => {
        if (settled) return
        failure ??= error
        killGroup()
        // A detached descendant may retain inherited pipes after leaving our process group.
        // Closing our readers keeps cancellation bounded; process-group escape needs an OS sandbox.
        child.stdout.destroy()
        child.stderr.destroy()
      }
      const onAbort = (): void => stop(new RuntimeAbortError())
      const timer = setTimeout(
        () => stop(new ToolError('SHELL_TIMEOUT', `Command exceeded ${input.timeoutMs} ms`)),
        input.timeoutMs
      )

      const collect = (chunks: Buffer[], chunk: Buffer): void => {
        const remaining = Math.max(0, input.maxOutputBytes - outputBytes)
        if (remaining > 0) chunks.push(chunk.subarray(0, remaining))
        outputBytes += chunk.length
        if (outputBytes > input.maxOutputBytes) {
          stop(
            new ToolError(
              'SHELL_OUTPUT_LIMIT',
              `Command output exceeded ${input.maxOutputBytes} bytes`
            )
          )
        }
      }
      child.stdout.on('data', (chunk: Buffer) => collect(stdout, chunk))
      child.stderr.on('data', (chunk: Buffer) => collect(stderr, chunk))
      child.on('error', (cause) => {
        failure ??= new ToolError('SHELL_SPAWN_FAILED', 'Cannot start shell command', { cause })
        killGroup()
      })
      // Even a successful shell may have launched background children that still hold our pipes open.
      child.on('exit', killGroup)
      child.on('close', (exitCode, signal) => {
        settled = true
        clearTimeout(timer)
        context.signal.removeEventListener('abort', onAbort)
        const output = {
          stdout: Buffer.concat(stdout).toString('utf8'),
          stderr: Buffer.concat(stderr).toString('utf8'),
          exitCode,
          signal,
          truncated: outputBytes > input.maxOutputBytes
        }
        if (context.signal.aborted || failure instanceof RuntimeAbortError) {
          reject(new RuntimeAbortError())
        } else if (failure) {
          reject(
            new ToolError(failure.code, `${failure.message}\n${JSON.stringify(output)}`, {
              cause: failure
            })
          )
        } else if (exitCode !== 0) {
          reject(new ToolError('SHELL_EXIT', `Command failed\n${JSON.stringify(output)}`))
        } else {
          resolve(output)
        }
      })
      context.signal.addEventListener('abort', onAbort, { once: true })
      if (context.signal.aborted) onAbort()
    })
  }
}
