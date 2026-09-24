import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { AgentRuntime, RuntimeAbortError, type ModelProvider } from '../src/index.js'

const quote = (text: string): string => `'${text.replaceAll("'", "'\\''")}'`

test(
  'runtime cancellation waits for foreground shell child cleanup',
  { skip: process.platform === 'win32', timeout: 5000 },
  async (t) => {
    const cwd = await mkdtemp(join(tmpdir(), 'whale-shell-runtime-'))
    t.after(() => rm(cwd, { force: true, recursive: true }))
    const controller = new AbortController()
    let childPid: number | undefined
    let modelCalls = 0
    const model: ModelProvider = {
      generate: async () => {
        modelCalls += 1
        return {
          text: '',
          finishReason: 'tool_calls',
          toolCalls: [
            {
              id: 'shell-call',
              name: 'shell',
              input: { command: 'sleep 30 & child=$!; printf "$child" > child.pid; wait "$child"' }
            }
          ]
        }
      }
    }
    const runtime = new AgentRuntime({ model, permissions: { rules: { shell: 'allow' } } })
    const result = runtime.run({ prompt: 'Run command', cwd, signal: controller.signal })
    const cancelled = assert.rejects(result, (error: unknown) => {
      assert.ok(error instanceof RuntimeAbortError)
      const message = error.session?.messages.at(-1)
      assert.ok(message?.role === 'tool')
      assert.equal(message.toolCallId, 'shell-call')
      assert.equal(message.isError, true)
      return true
    })
    try {
      for (let i = 0; i < 100; i += 1) {
        try {
          childPid = Number(await readFile(join(cwd, 'child.pid'), 'utf8'))
          if (childPid > 0) break
        } catch {
          /* Wait for the actual process, not a fixed launch delay. */
        }
        await delay(10)
      }
      assert.ok(childPid && childPid > 0)
      controller.abort()
      await cancelled
      assert.equal(modelCalls, 1)
      for (let i = 0; i < 100; i += 1) {
        try {
          process.kill(childPid, 0)
        } catch {
          return
        }
        await delay(10)
      }
      assert.fail('Shell descendant survived cancellation')
    } finally {
      controller.abort()
      if (childPid) {
        try {
          process.kill(childPid, 'SIGKILL')
        } catch {
          /* Already stopped. */
        }
      }
    }
  }
)

test(
  'detached descendant pipes cannot hang cancellation',
  { skip: process.platform === 'win32', timeout: 5000 },
  async (t) => {
    const cwd = await mkdtemp(join(tmpdir(), 'whale-shell-detached-'))
    t.after(() => rm(cwd, { force: true, recursive: true }))
    const controller = new AbortController()
    const source = `const {spawn}=require('node:child_process');const {writeFileSync}=require('node:fs');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:['ignore',1,2]});writeFileSync('detached.pid',String(child.pid));child.unref()`
    const command = `${quote(process.execPath)} -e ${quote(source)}`
    const runtime = new AgentRuntime({
      model: {
        generate: async () => ({
          text: '',
          finishReason: 'tool_calls',
          toolCalls: [{ id: 'detach', name: 'shell', input: { command } }]
        })
      },
      permissions: { rules: { shell: 'allow' } }
    })
    const cancelled = assert.rejects(
      runtime.run({ prompt: 'Run', cwd, signal: controller.signal }),
      RuntimeAbortError
    )
    let childPid: number | undefined
    try {
      for (let i = 0; i < 100; i += 1) {
        try {
          childPid = Number(await readFile(join(cwd, 'detached.pid'), 'utf8'))
          if (childPid > 0) break
        } catch {
          /* Wait for the detached child before testing cancellation. */
        }
        await delay(10)
      }
      assert.ok(childPid && childPid > 0)
      controller.abort()
      await cancelled
    } finally {
      controller.abort()
      // Deliberate process-group escape is outside the built-in shell's isolation boundary.
      if (childPid) {
        try {
          process.kill(-childPid, 'SIGKILL')
        } catch {
          /* Already stopped. */
        }
      }
    }
  }
)
