# 项目协作规范

## 工作区

- 使用 pnpm 11 管理依赖，Node.js 版本以 `.nvmrc` 为准。
- `apps/desktop` 是 Electron + Vue3 桌面应用；`apps/server` 提供本地服务。
- `packages/shared` 存放跨端类型和工具；`packages/ui` 存放通用 UI；`packages/cli` 提供 Agent Runtime 命令行入口。

## 开发约定

- 修改前先确认目标文件和现有实现，避免无关重构。
- 新增跨包能力时优先放入对应 `packages/*`，应用层只组合与调用。
- 使用 TypeScript 严格模式；不得使用未验证的 `any` 或忽略类型错误。
- Electron 主进程与渲染进程只通过 preload 暴露的最小化 IPC 接口通信。
- 不提交密钥、令牌或真实环境变量；新增环境变量必须同步更新 `.env.example`。
- 界面不手写 `aria-label`、`aria-labelledby`、`aria-orientation`，也不为读屏另加 `role`。控件含义用可见文案或 Tooltip 表达。图标组件内部的 `aria-hidden` 除外。

## 质量要求

- 代码格式化：`pnpm format`。
- 静态检查：`pnpm lint` 与 `pnpm check-types`。
- 构建验证：`pnpm build`。
- 涉及用户可见行为时，补充相应测试或明确说明验证方式。
