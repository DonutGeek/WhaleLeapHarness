# WhaleLeapHarness

基于 pnpm workspace 与 Turborepo 的 Electron 应用仓库，内置本地服务与 Agent Runtime CLI。

## 环境要求

- Node.js `24.14.0`（见 `.nvmrc`）
- pnpm `11.25.0`

```sh
nvm use
corepack enable
pnpm install
```

## 工作区

- `apps/desktop`：Electron + Vue3 + TypeScript 桌面应用
- `apps/server`：Node.js 服务，提供 `GET /health`
- `packages/shared`：共享类型与工具
- `packages/ui`：基础 UI 工具与样式令牌
- `packages/cli`：Agent Runtime 的命令行入口

## 常用命令

```sh
pnpm dev:desktop
pnpm dev:server
pnpm --filter @repo/cli agent -- --input "你好"
pnpm lint
pnpm format
pnpm format:check
pnpm check-types
pnpm build
```

## Agent Runtime

CLI 包可运行最小 Agent Runtime，并输出启动与完成事件：

```sh
pnpm --filter @repo/cli agent -- --input "你好"
pnpm --filter @repo/cli agent -- --input "你好" --session-id session-001 --json
```

更多架构与运行边界见 [DESIGN.md](./DESIGN.md)。

## 代码质量

- Oxlint：工作区 lint 检查
- Oxfmt：代码与配置文件格式化
- Husky：提交前自动运行 `pnpm lint` 与 `pnpm format:check`
