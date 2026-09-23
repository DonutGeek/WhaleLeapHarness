export type AgentRuntimeRequest = {
  sessionId: string
  input: string
}

export type AgentRuntimeEvent = {
  sessionId: string
  status: 'started' | 'completed'
  output?: string
}

export type AgentRuntime = {
  run(request: AgentRuntimeRequest): AsyncGenerator<AgentRuntimeEvent>
}

export const createAgentRuntime = (): AgentRuntime => ({
  async *run(request) {
    yield { sessionId: request.sessionId, status: 'started' }
    yield {
      sessionId: request.sessionId,
      status: 'completed',
      output: request.input
    }
  }
})
