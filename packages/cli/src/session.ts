import { randomUUID } from 'node:crypto'
import { RuntimeError } from './errors.js'
import type { AgentMessage, AgentStatus, SessionSnapshot } from './types.js'

export class AgentSession {
  private readonly state: SessionSnapshot

  constructor(options: {
    id?: string
    parentSessionId?: string
    cwd: string
    workspaceRoot: string
  }) {
    const now = new Date()
    this.state = {
      ...options,
      id: options.id ?? randomUUID(),
      messages: [],
      status: 'running',
      createdAt: now,
      updatedAt: now
    }
  }

  get id(): string {
    return this.state.id
  }

  append(message: AgentMessage): void {
    if (this.state.status !== 'running') {
      throw new RuntimeError('SESSION_CLOSED', 'Cannot append to a finished session')
    }
    this.state.messages.push(structuredClone(message))
    this.state.updatedAt = new Date()
  }

  finish(status: Exclude<AgentStatus, 'running'>): void {
    if (this.state.status !== 'running') {
      throw new RuntimeError('SESSION_CLOSED', 'Session already finished')
    }
    this.state.status = status
    this.state.updatedAt = new Date()
  }

  snapshot(): SessionSnapshot {
    return structuredClone(this.state)
  }
}
