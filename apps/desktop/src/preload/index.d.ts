import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      shell: {
        openExternal: (url: string) => Promise<void>
      }
      terminal: {
        create: (sessionId: string, cols: number, rows: number) => Promise<void>
        write: (sessionId: string, data: string) => Promise<void>
        resize: (sessionId: string, cols: number, rows: number) => Promise<void>
        close: (sessionId: string) => Promise<void>
        onOutput: (callback: (output: { sessionId: string; data: string }) => void) => () => void
      }
      window: {
        toggleMaximize: () => Promise<void>
      }
    }
  }
}
