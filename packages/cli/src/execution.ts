import { PermissionError, RuntimeError, ToolError, throwIfAborted } from './errors.js'
import type { EmitEvent } from './events.js'
import type { HookManager } from './hooks.js'
import type { PermissionManager } from './permission.js'
import type { AgentSession } from './session.js'
import type { ToolContext, ToolRegistry } from './tool.js'
import type { ToolCall } from './types.js'

export interface ToolExecutionOptions {
  tools: ToolRegistry
  permissions: PermissionManager
  hooks: HookManager
  session: AgentSession
  context: ToolContext
  emit: EmitEvent
}

export async function executeTool(call: ToolCall, options: ToolExecutionOptions): Promise<void> {
  const { tools, permissions, hooks, session, context, emit } = options
  throwIfAborted(context.signal)
  emit({ type: 'tool.started', toolCall: call })
  let content: string
  let failure: RuntimeError | undefined
  try {
    const tool = tools.get(call.name)
    if (!tool) throw new ToolError('UNKNOWN_TOOL', `Unknown tool: ${call.name}`)
    const execute = tool.prepare(call.input)
    await hooks.run(
      { type: 'PreToolUse', toolCall: call },
      { session: session.snapshot(), signal: context.signal }
    )
    await permissions.authorize({
      category: tool.permission,
      toolCall: call,
      sessionId: session.id,
      cwd: context.cwd,
      signal: context.signal,
      emit,
      beforeRequest: (request) =>
        hooks.run(
          { type: 'PermissionRequest', request },
          { session: session.snapshot(), signal: context.signal }
        )
    })
    throwIfAborted(context.signal)
    // Await tool cleanup on cancellation. Tools must honor the supplied signal before resolving.
    const output = await execute(context)
    throwIfAborted(context.signal)
    content = typeof output === 'string' ? output : JSON.stringify(output)
    if (typeof content !== 'string')
      throw new ToolError('INVALID_TOOL_OUTPUT', 'Tool must return JSON-serializable output')
  } catch (cause) {
    if (context.signal.aborted) throw cause
    if (cause instanceof RuntimeError && cause.disposition !== 'recoverable') throw cause
    failure =
      cause instanceof ToolError || cause instanceof PermissionError
        ? cause
        : new ToolError(
            'TOOL_EXECUTION_FAILED',
            cause instanceof Error ? cause.message : 'Tool execution failed',
            { cause }
          )
    content = JSON.stringify(failure.toJSON())
  }
  session.append({
    role: 'tool',
    content,
    toolCallId: call.id,
    name: call.name,
    isError: Boolean(failure)
  })
  if (failure) {
    emit({ type: 'tool.failed', toolCall: call, error: failure.toJSON() })
    await hooks.run(
      { type: 'PostToolUseFailure', toolCall: call, error: failure.toJSON() },
      { session: session.snapshot(), signal: context.signal }
    )
  } else {
    emit({ type: 'tool.completed', toolCall: call, content })
    await hooks.run(
      { type: 'PostToolUse', toolCall: call, content },
      { session: session.snapshot(), signal: context.signal }
    )
  }
}
