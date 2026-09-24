import type { ErrorInfo } from './errors.js'
import type {
  ModelDelta,
  ModelResponse,
  PermissionCategory,
  SessionSnapshot,
  ToolCall
} from './types.js'

export interface PermissionRequest {
  id: string
  sessionId: string
  cwd: string
  category: PermissionCategory
  toolCall: ToolCall
}

export type RuntimeEventPayload =
  | { type: 'agent.started'; session: SessionSnapshot }
  | { type: 'agent.completed'; session: SessionSnapshot; text: string; turns: number }
  | { type: 'agent.failed' | 'agent.aborted'; session: SessionSnapshot; error: ErrorInfo }
  | { type: 'model.started'; turn: number }
  | { type: 'model.delta'; turn: number; delta: ModelDelta }
  | { type: 'model.completed'; turn: number; response: ModelResponse }
  | { type: 'model.failed'; turn: number; error: ErrorInfo }
  | { type: 'tool.started'; toolCall: ToolCall }
  | { type: 'tool.completed'; toolCall: ToolCall; content: string }
  | { type: 'tool.failed'; toolCall: ToolCall; error: ErrorInfo }
  | { type: 'permission.requested'; request: PermissionRequest }
  | {
      type: 'permission.resolved'
      request: PermissionRequest
      decision: 'allow' | 'deny'
      reason?: string
    }

export type RuntimeEvent = RuntimeEventPayload & { sessionId: string; timestamp: Date }
export type EmitEvent = (payload: RuntimeEventPayload) => void
export type RuntimeListener = (event: RuntimeEvent) => void

export class RuntimeEvents {
  private readonly listeners = new Set<RuntimeListener>()

  on(event: 'event', listener: RuntimeListener): () => void {
    if (event === 'event') this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  emit(sessionId: string, payload: RuntimeEventPayload): void {
    for (const listener of [...this.listeners]) {
      // Observers cannot mutate session state or interrupt execution. Use hooks for awaited work.
      try {
        const result = listener(structuredClone({ ...payload, sessionId, timestamp: new Date() }))
        void Promise.resolve(result).catch(() => {})
      } catch {
        // Client rendering/logging failures are outside the agent lifecycle.
      }
    }
  }
}
