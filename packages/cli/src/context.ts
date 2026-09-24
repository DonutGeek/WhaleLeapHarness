import type { AgentMessage, SessionSnapshot } from './types.js'

export interface ContextManager {
  build(session: SessionSnapshot): readonly AgentMessage[]
}

export function codingSystemPrompt(session: SessionSnapshot): string {
  return `You are a coding agent working in ${session.cwd}.
Workspace boundary: ${session.workspaceRoot}.
Use tools to inspect the real project state. Never assume the contents of unread files.
Before editing, inspect relevant implementations and project instructions, even for simple tasks.
Respect the project's architecture, conventions and code style. Prefer the smallest necessary change.
Do not rewrite unrelated code without a reason.
Only claim tool executions and command results that actually happened.
After a tool failure, decide the next step using the actual error result.
After changes, run appropriate verification when possible and report any checks you could not perform.
File tools are restricted to the workspace. Shell requires authorization and is not an OS sandbox.`
}

// Session owns history; this is the single extension point for budgeting/compaction later.
export class DefaultContextManager implements ContextManager {
  constructor(private readonly systemPrompt?: string) {}

  build(session: SessionSnapshot): AgentMessage[] {
    return [
      { role: 'system', content: this.systemPrompt ?? codingSystemPrompt(session) },
      ...structuredClone(session.messages)
    ]
  }
}
