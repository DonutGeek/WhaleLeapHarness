# WhaleLeapHarness

基于 pnpm workspace 与 Turborepo 的 Monorepo，包含 Electron Desktop Client、Cloud Server 与可复用 Agent Runtime。

## 环境要求

- Node.js `24.14.0`（见 `.nvmrc`）
- pnpm `11.25.0`

```sh
nvm use
corepack enable
pnpm install
```

## 工作区

- `apps/desktop`：Electron + Vue 3 Desktop Client
- `apps/client`：Standalone CLI Client（后续，当前尚未创建）
- `apps/server`：Cloud Server（当前为提供 `GET /health` 的 Node.js 服务骨架）
- `packages/cli`：与客户端无关的 Agent Runtime / Agent Harness（`@repo/cli`）
- `packages/protocol`：跨进程、跨客户端与服务端的通信契约（目标职责，当前尚未创建）
- `packages/shared`：通用 TypeScript 工具
- `packages/ui`：共享 Vue UI 层（当前为基础 UI 工具与样式令牌）

## 常用命令

```sh
pnpm dev:desktop
pnpm dev:server
pnpm --filter @repo/cli test
pnpm lint
pnpm format
pnpm format:check
pnpm check-types
pnpm test
pnpm build
```

## Agent Runtime

`@repo/cli` 提供 Session、Agent Loop、模型适配器、文件与 Shell 工具、权限、流式事件和取消。Desktop 主进程与未来 `apps/client` 可调用同一套 API；包本身不解析命令行参数或输出终端 UI。

```ts
import { AgentRuntime, ChatCompletionsProvider } from '@repo/cli'

const runtime = new AgentRuntime({
  model: new ChatCompletionsProvider({
    baseUrl: 'http://localhost:1234/v1',
    model: 'your-tool-capable-local-model'
  })
})

const result = await runtime.run({
  prompt: 'Read package.json and tell me what framework this project uses.',
  cwd: '/absolute/path/to/project'
})
// result.text：最终回答；result.session：执行历史快照
```

端点和模型名称需替换为实际配置。托管 Provider 的密钥由客户端安全配置传入 `apiKey`；Runtime 不读取环境变量。默认读取允许，写入和 Shell 需客户端回调授权，缺少回调时拒绝。

接入、工具限制与验证说明见 [packages/cli/README.md](./packages/cli/README.md)，项目边界见 [DESIGN.md](./DESIGN.md)。

## 代码质量

- Oxlint：工作区 lint 检查
- Oxfmt：代码与配置文件格式化
- Husky：提交前自动运行 `pnpm lint` 与 `pnpm format:check`
