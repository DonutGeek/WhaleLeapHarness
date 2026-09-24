import { DefaultContextManager, type ContextManager } from './context.js'
import { RuntimeAbortError, RuntimeError, throwIfAborted } from './errors.js'
import { RuntimeEvents } from './events.js'
import { HookManager, type RuntimeHook } from './hooks.js'
import { runAgentLoop } from './loop.js'
import { PermissionManager, type PermissionOptions } from './permission.js'
import { AgentSession } from './session.js'
import type { ToolRegistry } from './tool.js'
import { createToolRegistry } from './tools/index.js'
import type { ModelProvider, SessionSnapshot } from './types.js'
import { Workspace } from './workspace.js'

export interface AgentRuntimeOptions {
  model: ModelProvider
  tools?: ToolRegistry
  permissions?: PermissionOptions | PermissionManager
  contextManager?: ContextManager
  systemPrompt?: string
  maxTurns?: number
  hooks?: readonly RuntimeHook[]
}

export interface AgentRunOptions {
  prompt: string
  cwd: string
  workspaceRoot?: string
  sessionId?: string
  parentSessionId?: string
  signal?: AbortSignal
  maxTurns?: number
}

export interface AgentRunResult {
  text: string
  turns: number
  session: SessionSnapshot
}

export class AgentRuntime extends RuntimeEvents {
  private readonly model: ModelProvider
  private readonly tools: ToolRegistry
  private readonly permissions: PermissionManager
  private readonly contextManager: ContextManager
  private readonly hooks: HookManager
  private readonly maxTurns: number

  constructor(options: AgentRuntimeOptions) {
    super()
    this.model = options.model
    this.tools = options.tools ?? createToolRegistry()
    this.permissions =
      options.permissions instanceof PermissionManager
        ? options.permissions
        : new PermissionManager(options.permissions)
    this.contextManager = options.contextManager ?? new DefaultContextManager(options.systemPrompt)
    this.hooks = new HookManager(options.hooks)
    this.maxTurns = options.maxTurns ?? 20
  }

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    const signal = options.signal ?? new AbortController().signal
    const maxTurns = options.maxTurns ?? this.maxTurns
    if (!options.prompt.trim() || !Number.isSafeInteger(maxTurns) || maxTurns < 1) {
      throw new RuntimeError(
        'INVALID_RUN_OPTIONS',
        'A non-empty prompt and a positive integer maxTurns are required'
      )
    }
    throwIfAborted(signal)
    let workspace: Workspace
    try {
      workspace = await Workspace.create(options.cwd, options.workspaceRoot)
    } catch (cause) {
      throw new RuntimeError('INVALID_WORKSPACE', 'Cannot open the requested workspace', { cause })
    }
    const session = new AgentSession({
      id: options.sessionId,
      parentSessionId: options.parentSessionId,
      cwd: workspace.cwd,
      workspaceRoot: workspace.root
    })
    const emit: Parameters<typeof runAgentLoop>[0]['emit'] = (event) => this.emit(session.id, event)
    emit({ type: 'agent.started', session: session.snapshot() })
    try {
      throwIfAborted(signal)
      await this.hooks.run({ type: 'SessionStart' }, { session: session.snapshot(), signal })
      session.append({ role: 'user', content: options.prompt })
      await this.hooks.run(
        { type: 'UserPromptSubmit', prompt: options.prompt },
        { session: session.snapshot(), signal }
      )
      const result = await runAgentLoop({
        model: this.model,
        tools: this.tools,
        permissions: this.permissions,
        contextManager: this.contextManager,
        hooks: this.hooks,
        maxTurns,
        session,
        context: { sessionId: session.id, cwd: workspace.cwd, workspace, signal },
        emit
      })
      await this.hooks.run({ type: 'Stop' }, { session: session.snapshot(), signal })
      throwIfAborted(signal)
      session.finish('completed')
      const snapshot = session.snapshot()
      emit({ type: 'agent.completed', ...result, session: snapshot })
      return { ...result, session: snapshot }
    } catch (cause) {
      const error = signal.aborted
        ? new RuntimeAbortError()
        : cause instanceof RuntimeError
          ? cause
          : new RuntimeError('RUNTIME_FAILED', 'Agent execution failed', { cause })
      session.finish(error.disposition === 'aborted' ? 'aborted' : 'failed')
      error.session = session.snapshot()
      emit({
        type: error.disposition === 'aborted' ? 'agent.aborted' : 'agent.failed',
        error: error.toJSON(),
        session: session.snapshot()
      })
      throw error
    }
  }
}

export const createAgentRuntime = (options: AgentRuntimeOptions): AgentRuntime =>
  new AgentRuntime(options)
