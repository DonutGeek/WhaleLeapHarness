import { randomUUID } from 'node:crypto'
import { abortable, PermissionError, throwIfAborted } from './errors.js'
import type { EmitEvent, PermissionRequest } from './events.js'
import type { PermissionCategory, PermissionDecision, ToolCall } from './types.js'

export interface PermissionOptions {
  rules?: Partial<Record<PermissionCategory, PermissionDecision>>
  request?: (request: PermissionRequest, signal: AbortSignal) => Promise<'allow' | 'deny'>
}

export class PermissionManager {
  private readonly rules: Record<PermissionCategory, PermissionDecision>
  private readonly request?: PermissionOptions['request']

  constructor(options: PermissionOptions = {}) {
    this.rules = { read: 'allow', write: 'ask', shell: 'ask', ...options.rules }
    this.request = options.request
  }

  async authorize(options: {
    category: PermissionCategory
    toolCall: ToolCall
    sessionId: string
    cwd: string
    signal: AbortSignal
    emit: EmitEvent
    beforeRequest: (request: PermissionRequest) => Promise<void>
  }): Promise<void> {
    const { category, toolCall, sessionId, cwd, signal, emit, beforeRequest } = options
    throwIfAborted(signal)
    const request: PermissionRequest = {
      id: randomUUID(),
      category,
      toolCall: structuredClone(toolCall),
      sessionId,
      cwd
    }
    const policy = this.rules[category]
    let decision: 'allow' | 'deny' = policy === 'allow' ? 'allow' : 'deny'
    let reason: string | undefined
    if (policy === 'ask') {
      await beforeRequest(structuredClone(request))
      throwIfAborted(signal)
      emit({ type: 'permission.requested', request })
      try {
        decision = this.request
          ? await abortable(() => this.request!(structuredClone(request), signal), signal)
          : 'deny'
        if (decision !== 'allow') decision = 'deny'
        if (!this.request) reason = 'No client permission handler is installed'
      } catch (cause) {
        emit({
          type: 'permission.resolved',
          request,
          decision: 'deny',
          reason: signal.aborted ? 'Cancelled' : 'Permission handler failed'
        })
        throwIfAborted(signal)
        throw new PermissionError('PERMISSION_HANDLER_FAILED', 'Client permission handler failed', {
          cause
        })
      }
    }
    emit({ type: 'permission.resolved', request, decision, reason })
    throwIfAborted(signal)
    if (decision !== 'allow') {
      throw new PermissionError(
        'PERMISSION_DENIED',
        reason ?? `Permission denied for ${toolCall.name}`
      )
    }
  }
}
