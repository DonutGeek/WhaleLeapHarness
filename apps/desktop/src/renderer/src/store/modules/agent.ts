import { defineStore } from 'pinia'
import type {
  AgentAttachment,
  AgentConversation,
  AgentConversationGroup,
  AgentMessage,
  AgentSuggestion
} from '@/components/Agent'
import { store } from '@/store'

/**
 * Agent 会话状态：侧栏「最近任务」和内容区对话共用这一份数据。
 * 布局只负责摆位置，会话本身不属于某一个 layout 部件。
 */
interface AgentState {
  activeConversationId: string
  sending: boolean
  paused: boolean
  /** 侧栏会话菜单。右侧标题和消息跟这里的选中项走 */
  groups: AgentConversationGroup[]
  messages: AgentMessage[]
  /** 切走的会话消息留在这里，再点回来时还原 */
  transcripts: Record<string, AgentMessage[]>
}

function task(id: string, title: string, timeLabel: string): AgentConversation {
  return { id, title, timeLabel, updatedAt: '', status: 'idle' }
}

function nowIso() {
  return new Date().toISOString()
}

/** 模拟回复的定时器，不进 state，避免被持久化 */
let replyTimer: number | null = null
let pendingTimestamp = 0

function clearReplyTimer() {
  if (replyTimer != null) {
    window.clearTimeout(replyTimer)
    replyTimer = null
  }
}

export const useAgentStore = defineStore('agent', {
  state: (): AgentState => ({
    activeConversationId: 'gomoku-1',
    sending: false,
    paused: false,
    groups: [
      {
        id: 'gomoku-ai',
        name: 'gomoku-ai',
        conversations: [
          task('gomoku-1', '做一个会下棋的五子棋...', '2分钟'),
          task('gomoku-2', '调整开局提示和回合逻辑...', '9分钟'),
          task('gomoku-3', '接入启发式 AI 回合...', '14分钟'),
          task('gomoku-4', '适配棋盘缩放和布局...', '27分钟'),
          task('gomoku-5', '补上规则说明和重新开始...', '51分钟'),
          task('gomoku-6', '打磨结果面板的文案...', '1小时'),
          task('gomoku-7', '记录启发式搜索过程...', '2小时'),
          task('gomoku-8', '加上悔棋...', '3小时'),
          task('gomoku-9', '调整开局库的权重...', '5小时'),
          task('gomoku-10', '写终局总结...', '1天')
        ]
      },
      {
        id: 'zcode-website',
        name: 'zcode-website',
        conversations: [
          task('web-1', '修复滚到底部时的定位...', '8分钟'),
          task('web-2', '更新首页主视觉...', '3分钟'),
          task('web-3', '收紧首页的英文文案...', '42分钟'),
          task('web-4', '调整主视觉的断点...', '1小时'),
          task('web-5', '补充定价常见问题...', '2小时'),
          task('web-6', '重写页脚链接...', '3小时'),
          task('web-7', '加上更新日志页...', '5小时'),
          task('web-8', '压缩主视觉截图...', '1天'),
          task('web-9', '检查移动端导航文案...', '2天')
        ]
      },
      { id: 'zcode-desktop', name: 'zcode-desktop', conversations: [] }
    ],
    messages: [],
    transcripts: {}
  }),

  getters: {
    /** 当前任务标题，页头直接展示 */
    activeTitle(state): string {
      for (const group of state.groups) {
        const found = group.conversations.find((item) => item.id === state.activeConversationId)
        if (found) return found.title
      }
      return '未命名任务'
    }
  },

  actions: {
    /** 改当前选中会话在菜单里的标题和状态 */
    patchActiveConversation(patch: Partial<AgentConversation>) {
      this.groups = this.groups.map((group) => ({
        ...group,
        conversations: group.conversations.map((conversation) =>
          conversation.id === this.activeConversationId
            ? { ...conversation, ...patch }
            : conversation
        )
      }))
    },

    createConversation() {
      clearReplyTimer()
      this.transcripts = {
        ...this.transcripts,
        [this.activeConversationId]: this.messages
      }
      const id = `task-${Date.now()}`
      const conversation: AgentConversation = {
        id,
        title: '新任务',
        preview: '等待输入',
        updatedAt: nowIso(),
        timeLabel: '刚刚',
        status: 'idle'
      }
      this.groups = this.groups.map((group, index) =>
        index === 0 ? { ...group, conversations: [conversation, ...group.conversations] } : group
      )
      this.activeConversationId = id
      this.messages = []
      this.sending = false
      this.paused = false
    },

    selectConversation(id: string) {
      if (this.activeConversationId === id) return
      clearReplyTimer()
      this.transcripts = {
        ...this.transcripts,
        [this.activeConversationId]: this.messages
      }
      this.activeConversationId = id
      this.messages = this.transcripts[id] ?? []
      this.sending = false
      this.paused = false
    },

    sendPrompt(prompt: string, attachments: AgentAttachment[] = []) {
      const text = prompt.trim()
      if (!text && !attachments.length) return
      const timestamp = Date.now()
      const now = nowIso()
      this.paused = false
      this.sending = true
      pendingTimestamp = timestamp
      this.messages.push({
        id: `user-${timestamp}`,
        role: 'user',
        content: text,
        createdAt: now,
        attachments: attachments.length ? attachments : undefined
      })
      const currentTitle = this.activeTitle
      this.patchActiveConversation({
        title:
          currentTitle === '未命名任务' || currentTitle === '新任务'
            ? (text || attachments[0]?.name || '未命名任务').slice(0, 28)
            : currentTitle,
        preview: '正在执行',
        status: 'running',
        updatedAt: now
      })
      this.scheduleReply(timestamp)
    },

    stopPrompt() {
      if (!this.sending) return
      clearReplyTimer()
      this.sending = false
      this.paused = true
      this.patchActiveConversation({
        preview: '已停止生成',
        status: 'idle',
        updatedAt: nowIso()
      })
    },

    resumePrompt() {
      if (!this.paused || this.sending) return
      this.paused = false
      this.sending = true
      this.patchActiveConversation({
        preview: '正在执行',
        status: 'running',
        updatedAt: nowIso()
      })
      this.scheduleReply(pendingTimestamp || Date.now())
    },

    scheduleReply(timestamp: number) {
      clearReplyTimer()
      replyTimer = window.setTimeout(() => {
        replyTimer = null
        this.messages.push({
          id: `assistant-${timestamp}`,
          role: 'assistant',
          content:
            '我已梳理任务并完成第一轮执行。你可以在右侧检查器查看改动、终端输出与本次工具调用。\n\n```ts\nexport function greet(name: string) {\n  return `Hello, ${name}`\n}\n```',
          createdAt: nowIso(),
          thought: [
            {
              id: `think-${timestamp}`,
              title: '正在分析',
              detail: '分析任务范围与相关模块',
              status: 'completed'
            },
            {
              id: `read-${timestamp}`,
              title: '已读取 src/App.vue',
              detail: '读取应用入口和全局配置',
              status: 'completed'
            },
            {
              id: `edit-${timestamp}`,
              title: '正在编辑 Sidebar.vue',
              detail: '正在整理工作区导航',
              status: 'running'
            },
            {
              id: `command-${timestamp}`,
              title: '正在运行 pnpm dev',
              detail: '启动本地开发环境',
              status: 'pending'
            }
          ],
          suggestions: [
            {
              id: 'continue',
              label: '继续这个任务',
              prompt: '继续完成上一步任务'
            },
            {
              id: 'explain',
              label: '解释当前方案',
              prompt: '解释刚才的实现方案'
            }
          ]
        })
        this.patchActiveConversation({
          preview: '第一轮执行完成',
          status: 'idle',
          updatedAt: nowIso()
        })
        this.sending = false
        this.paused = false
      }, 700)
    },

    chooseSuggestion(suggestion: AgentSuggestion) {
      this.sendPrompt(suggestion.prompt)
    }
  }
})

export function useAgentStoreWithOut() {
  return useAgentStore(store)
}
