import type { ContextManager } from './context.js'
import { abortable, ModelError, RuntimeAbortError, RuntimeError, throwIfAborted } from './errors.js'
import { executeTool, type ToolExecutionOptions } from './execution.js'
import type { ModelProvider, ModelResponse, ToolCall } from './types.js'

export interface LoopOptions extends ToolExecutionOptions {
  model: ModelProvider
  contextManager: ContextManager
  maxTurns: number
}

function validateResponse(response: ModelResponse, seenIds: Set<string>): void {
  if (
    typeof response.text !== 'string' ||
    !['stop', 'tool_calls', 'length', 'content_filter', 'other'].includes(response.finishReason)
  ) {
    throw new ModelError('INVALID_MODEL_RESPONSE', 'Model returned an invalid response')
  }
  const calls = response.toolCalls ?? []
  if (!Array.isArray(calls))
    throw new ModelError('INVALID_MODEL_RESPONSE', 'Tool calls must be an array')
  for (const call of calls) {
    if (
      !call ||
      typeof call.id !== 'string' ||
      !call.id ||
      typeof call.name !== 'string' ||
      !call.name ||
      seenIds.has(call.id)
    ) {
      throw new ModelError(
        'INVALID_TOOL_CALL',
        'Tool call IDs must be non-empty and unique across the session'
      )
    }
    seenIds.add(call.id)
  }
  if (response.finishReason === 'tool_calls' && !calls.length) {
    throw new ModelError(
      'INVALID_MODEL_RESPONSE',
      'Model finished with tool_calls but returned no calls'
    )
  }
  if (calls.length && response.finishReason !== 'tool_calls') {
    throw new ModelError(
      'INVALID_MODEL_RESPONSE',
      'Tool calls require a completed tool_calls response'
    )
  }
  if (response.finishReason !== 'stop' && response.finishReason !== 'tool_calls') {
    throw new ModelError('MODEL_INCOMPLETE', `Model did not complete: ${response.finishReason}`)
  }
}

export async function runAgentLoop(options: LoopOptions): Promise<{ text: string; turns: number }> {
  const { model, contextManager, session, context, emit, maxTurns, tools } = options
  const seenIds = new Set<string>()
  let pending: ToolCall[] = []
  try {
    for (let turn = 1; turn <= maxTurns; turn += 1) {
      throwIfAborted(context.signal)
      const messages = contextManager.build(session.snapshot())
      emit({ type: 'model.started', turn })
      let response: ModelResponse
      let acceptingDeltas = true
      try {
        response = await abortable(
          () =>
            model.generate({
              messages: structuredClone(messages),
              tools: tools.definitions(),
              signal: context.signal,
              onDelta: (delta) => {
                if (acceptingDeltas && !context.signal.aborted)
                  emit({ type: 'model.delta', turn, delta })
              }
            }),
          context.signal
        )
        throwIfAborted(context.signal)
        validateResponse(response, seenIds)
        response = structuredClone(response)
      } catch (cause) {
        const error = context.signal.aborted
          ? new RuntimeAbortError()
          : cause instanceof ModelError
            ? cause
            : new ModelError('MODEL_FAILED', 'Model generation failed', { cause })
        emit({ type: 'model.failed', turn, error: error.toJSON() })
        throw error
      } finally {
        acceptingDeltas = false
      }
      session.append({
        role: 'assistant',
        content: response.text,
        toolCalls: response.toolCalls,
        reasoning: response.reasoning
      })
      pending = [...(response.toolCalls ?? [])]
      emit({ type: 'model.completed', turn, response })
      throwIfAborted(context.signal)
      if (!pending.length) return { text: response.text, turns: turn }
      for (const call of [...pending]) {
        await executeTool(call, options)
        pending.shift()
      }
    }
    throw new RuntimeError('MAX_TURNS', `Agent reached the limit of ${maxTurns} model turns`)
  } catch (cause) {
    const error = context.signal.aborted
      ? new RuntimeAbortError()
      : cause instanceof RuntimeError
        ? cause
        : new RuntimeError('RUNTIME_FAILED', 'Agent loop failed', { cause })
    // Even aborted batches retain one result for every assistant call, in declaration order.
    const resolvedIds = new Set(
      session
        .snapshot()
        .messages.flatMap((message) => (message.role === 'tool' ? [message.toolCallId] : []))
    )
    for (const call of pending) {
      if (resolvedIds.has(call.id)) continue
      session.append({
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        content: JSON.stringify(error.toJSON()),
        isError: true
      })
      emit({ type: 'tool.failed', toolCall: call, error: error.toJSON() })
    }
    throw error
  }
}
