import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url)
  },
  terminal: {
    create: (sessionId: string, cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke('terminal:create', { sessionId, cols, rows }),
    write: (sessionId: string, data: string): Promise<void> =>
      ipcRenderer.invoke('terminal:write', { sessionId, data }),
    resize: (sessionId: string, cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke('terminal:resize', { sessionId, cols, rows }),
    close: (sessionId: string): Promise<void> => ipcRenderer.invoke('terminal:close', sessionId),
    onOutput: (callback: (output: { sessionId: string; data: string }) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        output: { sessionId: string; data: string }
      ) => callback(output)
      ipcRenderer.on('terminal:output', listener)
      return () => ipcRenderer.removeListener('terminal:output', listener)
    }
  },
  window: {
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke('window:toggle-maximize')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
