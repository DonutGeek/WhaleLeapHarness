# WhaleLeapHarness 设计说明

## 目标

提供一个以 Electron 桌面端为主、可承载 Agent Runtime 的 pnpm monorepo。桌面端负责交互体验，本地服务负责 HTTP 能力，CLI 支持自动化和开发调试。

## 架构

```text
apps/desktop (Electron + Vue3)
  ├─ renderer：页面、状态、国际化与 UI
  ├─ preload：受限 IPC 桥接
  └─ main：窗口管理、终端与系统能力

apps/server：本地 HTTP 服务
packages/cli：Agent Runtime 命令行入口
packages/shared：跨端类型与工具
packages/ui：通用 UI 样式与组件
```

## 运行边界

- 渲染进程不直接访问 Node.js 或操作系统 API。
- 主进程对 IPC 请求进行参数校验，并将终端会话绑定到发起的渲染进程。
- CLI 的 Runtime 以事件流表达生命周期，调用者可选择文本或 JSON 输出。
- 跨应用共享的无状态类型与工具放入 `@repo/shared`，避免反向依赖应用层。

## 开发流程

1. 使用 `pnpm dev:desktop` 启动桌面端，或使用 `pnpm dev:server` 启动本地服务。
2. 通过 `pnpm --filter @repo/cli agent -- --input "..."` 调试 Agent Runtime。
3. 提交前依次运行 `pnpm format`、`pnpm lint`、`pnpm check-types` 和 `pnpm build`。
