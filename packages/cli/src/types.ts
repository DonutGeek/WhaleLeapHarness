export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }
export type JsonSchema = Readonly<Record<string, unknown>>

export interface ToolCall {
  id: string
  name: string
  input: JsonValue
}

export type AgentMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[]; reasoning?: string }
  | { role: 'tool'; content: string; toolCallId: string; name: string; isError: boolean }

export type AgentStatus = 'running' | 'completed' | 'failed' | 'aborted'

export interface SessionSnapshot {
  id: string
  parentSessionId?: string
  cwd: string
  workspaceRoot: string
  messages: AgentMessage[]
  status: AgentStatus
  createdAt: Date
  updatedAt: Date
}

export type PermissionCategory = 'read' | 'write' | 'shell'
export type PermissionDecision = 'allow' | 'ask' | 'deny'

export interface ToolDefinition {
  name: string
  description: string
  inputSchema: JsonSchema
}

export interface ModelUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export type ModelDelta =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool_call'; index: number; id?: string; name?: string; arguments?: string }

export interface ModelRequest {
  messages: readonly AgentMessage[]
  tools: readonly ToolDefinition[]
  signal: AbortSignal
  onDelta?: (delta: ModelDelta) => void
}

export interface ModelResponse {
  text: string
  toolCalls?: ToolCall[]
  reasoning?: string
  usage?: ModelUsage
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'other'
}

export interface ModelProvider {
  generate(request: ModelRequest): Promise<ModelResponse>
}
