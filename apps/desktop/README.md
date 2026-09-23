# Desktop

基于 Electron、Vue3、Vite 与 TypeScript 的桌面应用。界面与业务模块从 Gito 项目迁入，运行时能力由 Electron IPC 提供。

## 功能组成

- Vue Router、Pinia、本地持久化与中英文国际化
- Antdv Next、Tailwind CSS、Tiptap、xterm、Virtua 与代码高亮
- 基于 `node-pty` 的本地交互式终端
- 受限 IPC：终端会话、系统外链、窗口最大化

## 开发

```sh
pnpm dev:desktop
pnpm --filter desktop build
```

## 环境变量

复制 `.env.example` 为需要的环境文件，或使用已提供的 `.env.development` / `.env.production`：

```env
VITE_GLOB_APP_TITLE=Desktop
VITE_GLOB_API_URL=http://localhost:3001
```
