export type AgentRole = 'user' | 'assistant' | 'system'

export interface AgentAttachment {
  id: string
  name: string
  kind: 'image' | 'file'
  previewUrl?: string
}

export interface AgentMessage {
  id: string
  role: AgentRole
  content: string
  createdAt: string
  pending?: boolean
  stopped?: boolean
  attachments?: AgentAttachment[]
  thought?: AgentThoughtStep[]
  sources?: AgentSource[]
  suggestions?: AgentSuggestion[]
}

export interface AgentConversation {
  id: string
  title: string
  updatedAt: string
  preview?: string
  /** 列表右侧的相对时间。未传时按 updatedAt 格式化 */
  timeLabel?: string
  status?: 'idle' | 'running' | 'waitingApproval' | 'failed'
}

/** 侧栏里按工作区分组的会话 */
export interface AgentConversationGroup {
  id: string
  name: string
  conversations: AgentConversation[]
}

export interface AgentThoughtStep {
  id: string
  title: string
  detail?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export interface AgentSource {
  id: string
  title: string
  href?: string
  description?: string
  kind?: 'file' | 'url' | 'document'
}

export interface AgentSuggestion {
  id: string
  label: string
  prompt: string
}
