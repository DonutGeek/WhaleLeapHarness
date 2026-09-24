import { abortable, RuntimeError } from './errors.js'
import type { ErrorInfo } from './errors.js'
import type { PermissionRequest } from './events.js'
import type { SessionSnapshot, ToolCall } from './types.js'

export type HookEvent =
  | { type: 'SessionStart' }
  | { type: 'UserPromptSubmit'; prompt: string }
  | { type: 'PreToolUse'; toolCall: ToolCall }
  | { type: 'PermissionRequest'; request: PermissionRequest }
  | { type: 'PostToolUse'; toolCall: ToolCall; content: string }
  | { type: 'PostToolUseFailure'; toolCall: ToolCall; error: ErrorInfo }
  | { type: 'Stop' }

export interface HookContext {
  session: SessionSnapshot
  signal: AbortSignal
}

export type RuntimeHook = (event: HookEvent, context: HookContext) => void | Promise<void>

export class HookManager {
  constructor(private readonly hooks: readonly RuntimeHook[] = []) {}

  async run(event: HookEvent, context: HookContext): Promise<void> {
    for (const hook of this.hooks) {
      try {
        await abortable(
          async () =>
            hook(structuredClone(event), {
              session: structuredClone(context.session),
              signal: context.signal
            }),
          context.signal
        )
      } catch (cause) {
        if (context.signal.aborted) throw cause
        throw new RuntimeError('HOOK_FAILED', `Hook ${event.type} failed`, { cause })
      }
    }
  }
}
