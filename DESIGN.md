# WhaleLeapHarness 设计说明

## 目标

提供一个以 Electron 桌面端为主、可承载 Agent Runtime 的 pnpm monorepo。Desktop Client 与后续 CLI Client 负责交互体验，Cloud Server 承担云端服务职责，`packages/cli` 提供可复用的 Agent Harness。

## 架构

```text
apps/desktop (Electron + Vue 3 Desktop Client)
  ├─ renderer：页面、状态、国际化与 UI
  ├─ preload：受限 IPC 桥接
  └─ main：窗口管理、终端与系统能力

apps/client：Standalone CLI Client（后续）
apps/server：Cloud Server
packages/cli：Agent Runtime / Agent Harness（@repo/cli）
packages/protocol：跨边界通信契约
packages/shared：通用 TypeScript 工具
packages/ui：共享 Vue UI
```

以上为目标职责。当前 `apps/client` 与 `packages/protocol` 尚未创建；Cloud Server 仅有 `/health` HTTP 服务骨架，尚无云端部署实现。`packages/ui` 当前提供基础工具与样式令牌，后续承载共享 Vue 组件。

## 运行边界

- 渲染进程不直接访问 Node.js 或操作系统 API。
- 主进程对 IPC 请求进行参数校验，并将终端会话绑定到发起的渲染进程。
- Agent Runtime 通过返回值、类型化事件、权限回调和 AbortSignal 与客户端通信，不包含命令行解析、终端 UI 或应用启动。
- Desktop 接入 Runtime 时须在主进程调用，Renderer 仅通过 preload 的受限 IPC 访问；当前 Desktop 的 Agent 回复仍为模拟数据，尚未接入 Runtime。未来 `apps/client` 负责 CLI 参数、终端输出和进程生命周期。
- Session 独占执行历史，ContextManager 构造每轮输入，ToolRegistry 管理工具与参数校验，PermissionManager 管理决策，Model Adapter 负责供应商转换。
- `packages/protocol` 负责 IPC、客户端与服务端之间的可序列化通信契约；在接入边界时建立，避免将 Node Runtime 对象直接暴露给 Renderer。Runtime 内部领域模型由 Runtime 自己拥有。
- `packages/shared` 负责通用 TypeScript 工具，不代替 protocol 成为跨边界契约的归属。应用依赖 packages，packages 不反向依赖应用。

## 开发流程

1. 使用 `pnpm dev:desktop` 启动桌面端，或使用 `pnpm dev:server` 在本地启动 Cloud Server 开发实例。
2. 通过 `pnpm --filter @repo/cli test` 验证 Agent Runtime；真实模型接入见 [Runtime 文档](./packages/cli/README.md)。
3. 提交前依次运行 `pnpm format`、`pnpm lint`、`pnpm check-types`、`pnpm test` 和 `pnpm build`。
