# Agent Runtime

`@repo/cli` 是 Node.js ESM 库，不是最终用户的 CLI 应用。沿用当前仓库的 `@repo/*` 命名，无新增运行时依赖。要求 Node.js 24.14.0、pnpm 11；构建输出为 `dist/index.js` 和类型声明。

## 客户端调用

调用应用需声明 `"@repo/cli": "workspace:*"` 依赖。Electron 在主进程调用，CLI Client 在 Node 进程调用。参数解析、环境变量、密钥存储、UI、日志和应用退出由客户端负责。

```ts
import {
  AgentRuntime,
  ChatCompletionsProvider,
  createToolRegistry,
  RuntimeError,
  type ChatCompletionsOptions,
  type PermissionOptions,
  type RuntimeListener
} from '@repo/cli'

export async function runAgent(
  modelConfig: ChatCompletionsOptions,
  prompt: string,
  cwd: string,
  onEvent: RuntimeListener,
  requestPermission: NonNullable<PermissionOptions['request']>,
  signal?: AbortSignal
) {
  const runtime = new AgentRuntime({
    model: new ChatCompletionsProvider(modelConfig),
    tools: createToolRegistry(),
    permissions: {
      rules: { read: 'allow', write: 'ask', shell: 'ask' },
      request: requestPermission
    },
    maxTurns: 20
  })
  const unsubscribe = runtime.on('event', onEvent)
  try {
    return await runtime.run({ prompt, cwd, signal })
  } catch (error) {
    if (error instanceof RuntimeError) {
      // error.kind / code / disposition 区分错误；error.session 保留已开始执行的历史。
      // 将失败展示给用户，不要把失败解释成已完成。
    }
    throw error
  } finally {
    unsubscribe()
  }
}
```

`modelConfig` 由调用端提供 `{ baseUrl, model, apiKey?, stream? }`；`baseUrl` 是 API 根地址，适配器追加 `/chat/completions`。默认 `stream: true`，可关闭以兼容仅支持 JSON 返回的端点。支持标准文本、function tools、usage、finish reason 及可选 reasoning 字段；不宣称兼容所有供应商扩展参数。真实网络请求使用原生 `fetch`，只在调用 `run()` 后发生。

`requestPermission(request, signal)` 必须返回 `Promise<'allow' | 'deny'>`，其中 `request.id` 可用于客户端关联审批；回调收到取消信号时应关闭待处理的 UI。`permission.requested` 事件仅用于观察，请通过回调返回决策。没有回调时 `ask` 按拒绝处理。取消使用调用端的 `AbortController.abort()`。

## 模块与执行链

| 模块                                 | 职责                                                                 |
| ------------------------------------ | -------------------------------------------------------------------- |
| `runtime.ts`                         | 装配依赖、创建每次独立 Session、结束生命周期                         |
| `loop.ts`                            | Context → Model → Assistant → 串行工具批次 → 下一轮；限制 `maxTurns` |
| `session.ts`                         | 唯一持有消息、状态、时间；对外提供副本                               |
| `context.ts`                         | provider 无关的编码 System Prompt + Session 历史                     |
| `model/chat-completions.ts`          | HTTP、JSON/SSE、消息转换、工具参数组装与校验                         |
| `tool.ts`、`execution.ts`            | 注册、参数校验、Hooks、权限、真实执行、结果与错误回写                |
| `workspace.ts`                       | 统一解析现存路径和新文件父路径，限制文件工具访问范围                 |
| `permission.ts`                      | read/write/shell 的 allow/ask/deny；将询问交给客户端                 |
| `events.ts`、`hooks.ts`、`errors.ts` | 类型化观察、轻量扩展点、可恢复/致命/取消错误                         |

一次调用的消息顺序为 `user → assistant(toolCalls) → tool(result) → assistant(final)`；多工具按声明顺序逐一执行并回写。Tool Call ID 在 Session 内必须唯一。上下文额外在最前方添加 system message，不在 Session 复制一份派生状态。

Unknown Tool、参数错误、权限拒绝和工具执行错误以 `isError: true` 的 tool message 回交模型，允许恢复。Provider 错误、截断/被过滤的生成、Hook 错误、循环上限终止运行并抛出类型化错误；取消抛出 `RuntimeAbortError`。已记录但未完成的工具批次会补齐失败结果。启动参数、workspace 检查和预先取消在创建 Session 前失败，因此没有 Session 或 started 事件。

## 工具与权限

| 工具             | 参数                                       | 默认权限与限制                                                              |
| ---------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| `read_file`      | `path`, `maxBytes?`                        | read/allow；UTF-8 文本，默认 128 KiB，最大 256 KiB                          |
| `write_file`     | `path`, `content`                          | write/ask；创建目录或覆盖文件，内容最多 1 MiB                               |
| `apply_patch`    | `path`, `oldText`, `newText`               | write/ask；单文件精确替换，匹配零次或多次均拒绝，最大 1 MiB                 |
| `list_directory` | `path?`, `maxEntries?`                     | read/allow；单层列目录，默认 200，最大 1000 条                              |
| `search_files`   | `query`, `path?`, `maxResults?`            | read/allow；逐行字面文本搜索，最多 2000 个条目、8 MiB 扫描，每文件前 64 KiB |
| `shell`          | `command`, `timeoutMs?`, `maxOutputBytes?` | shell/ask；默认 30 秒/128 KiB，最多 120 秒/1 MiB                            |

`apply_patch` 是轻量精确文本替换，不接受 unified diff。读取严格校验 UTF-8，截断时保留完整字符边界，补丁保留 BOM。写入通过同目录临时文件和原子替换提交，并保留已有文件权限；提交前取消或失败不会破坏原文，提交后取消不会回滚完整写入。搜索跳过符号链接、二进制或非法 UTF-8 文件及 `.git`、`node_modules`、`dist`、`.turbo`。截断结果带 `truncated`，不能当作完整文件或完整搜索结果。

Workspace 默认等于 `cwd`，可显式传入其祖先 `workspaceRoot`。文件工具校验规范化路径、真实路径和新文件最近的现存父目录，拒绝 `..`、外部绝对路径及符号链接逃逸。最终文件打开使用 `O_NOFOLLOW`；这些检查不等同于抵御宿主其他进程并发替换目录的 OS 沙箱。

Shell 在 workspace cwd 启动，但以宿主用户权限执行任意授权命令，能够访问外部文件和网络。POSIX 下使用独立进程组，取消、超时、输出超限和 shell 退出时终止组内子进程，并等待 shell close 后返回；不支持后台任务。主动脱离进程组的守护程序不属于此机制保证范围。Windows 暂返回 `SHELL_UNSUPPORTED`，需补充可靠的进程树管理后启用。

可用 `new ToolRegistry().register(tool)` 替换默认工具集。每个 `Tool<TInput>` 必须提供 `inputSchema`、`parse(unknown): TInput`、`permission` 和 `execute(input, context)`。Schema 提供给模型，`parse` 才是本地输入校验；解析在任何 Hook/权限交互之前执行一次。自定义工具必须遵守 workspace 与 AbortSignal 并在 Promise 结束前清理资源。Runtime 直接等待工具退出，以免用 Promise race 提前返回而遗留进程。直接调用 Registry 是低层 API，不经过 Runtime 的权限和事件流程。

## 事件、Hooks 与扩展边界

事件带 `sessionId` 和 `timestamp`，包括 agent.started/completed/failed/aborted、model.started/delta/completed/failed、tool.started/completed/failed、permission.requested/resolved。`model.delta` 区分文本、reasoning 和工具参数增量，最终完整结果在 model.completed。usage 随该完整结果提供。事件监听器不阻塞执行；同步异常及 Promise rejection 均隔离，不作为 Agent 失败。需要等待和错误传播时使用 Hook。

Hooks 是构造参数中的回调数组，串行等待，获得历史副本与 signal：SessionStart、UserPromptSubmit、PreToolUse、PermissionRequest、PostToolUse、PostToolUseFailure、Stop。Stop 在正常生成结束后、Session 标记 completed 前执行；失败/取消清理以 agent.failed/aborted 事件和 signal 为准。Hooks 不加载脚本、不授予权限，异常明确终止运行。

每次 `run()` 创建独立 Session，可携带 `parentSessionId`。工具集、权限、system prompt、工作目录、maxTurns 和 signal 可独立注入，便于以后组合 Child Runtime；本阶段没有 SubAgent 调度、持久化或 Resume。

## 参考与取舍

研究参考为 ZCode commit `328c1a0c0ffaa5a4f65e8fa199af5e4c20706e5f`：

- [turn-loop.ts](https://github.com/zai-org/ZCode/blob/328c1a0c0ffaa5a4f65e8fa199af5e4c20706e5f/apps/zcode-cli/packages/core/src/runtime/methods/turn-loop.ts)：循环与工具结果回喂。
- [permission-flow.ts](https://github.com/zai-org/ZCode/blob/328c1a0c0ffaa5a4f65e8fa199af5e4c20706e5f/apps/zcode-cli/packages/core/src/tool/executor/permission-flow.ts)：权限决策和客户端交互分离。
- [context/builder.ts](https://github.com/zai-org/ZCode/blob/328c1a0c0ffaa5a4f65e8fa199af5e4c20706e5f/apps/zcode-cli/packages/core/src/context/builder.ts)：历史与模型输入的职责分离。
- [subagent/runner.ts](https://github.com/zai-org/ZCode/blob/328c1a0c0ffaa5a4f65e8fa199af5e4c20706e5f/apps/zcode-cli/packages/core/src/subagent/runner.ts)：通过独立运行参数组合子代理。
- [path-policy.ts](https://github.com/zai-org/ZCode/blob/328c1a0c0ffaa5a4f65e8fa199af5e4c20706e5f/apps/zcode-cli/packages/core/src/tool/path-policy.ts)：ZCode 允许跨 workspace 路径；本项目按需求收紧文件工具边界。
- [Chat Completions 协议文档](https://api-docs.deepseek.com/api/create-chat-completion/)：适配器的请求、tool_call_id、流式工具参数与 usage 格式。

仅借鉴状态所有权、依赖注入和执行边界，没有复制源码、目录布局或复杂框架。暂不实现队列、MCP、压缩、RAG、插件或后台 Agent。

## 验证

```sh
pnpm --filter @repo/cli check-types
pnpm --filter @repo/cli test
pnpm lint
pnpm check-types
pnpm test
pnpm build
```

使用 Node 自带 `node:test` 与已有 `tsx`，无真实 LLM API 请求。`test/runtime.test.ts` 中 FakeModelProvider 驱动真实文件工具，验证第二轮 ModelRequest 含文件内容、消息顺序、关联 ID 和事件；另有权限、取消、Hooks、maxTurns 测试。Adapter 测试注入 fetch 验证真实 wire 协议及 SSE 分片；工具测试启动真实 POSIX 子进程并验证清理。

后续优先：接入 Desktop/CLI Client 的模型配置、审批 UI 和事件展示；需要 Windows 执行命令时补齐进程树管理。持久化 Session 与上下文预算由实际使用需求决定。
