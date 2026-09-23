import { BrowserWindow, ipcMain, shell } from 'electron'
import * as pty from 'node-pty'

type TerminalSession = {
  process: pty.IPty
  owner: Electron.WebContents
}

const sessions = new Map<string, TerminalSession>()

const normalizeSize = (value: number): number => Math.min(Math.max(Math.floor(value) || 1, 1), 500)

const assertSessionId = (sessionId: string): void => {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(sessionId)) {
    throw new Error('Invalid terminal session ID')
  }
}

const closeSession = (sessionId: string): void => {
  const session = sessions.get(sessionId)
  if (!session) return
  sessions.delete(sessionId)
  session.process.kill()
}

const defaultShell = (): string => {
  if (process.platform === 'win32') return process.env.COMSPEC ?? 'cmd.exe'
  return process.env.SHELL ?? '/bin/sh'
}

export const registerDesktopIpc = (): void => {
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    const parsedUrl = new URL(url)
    if (!['http:', 'https:'].includes(parsedUrl.protocol))
      throw new Error('Unsupported URL protocol')
    await shell.openExternal(parsedUrl.toString())
  })

  ipcMain.handle('window:toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })

  ipcMain.handle(
    'terminal:create',
    (event, payload: { sessionId: string; cols: number; rows: number }) => {
      const { sessionId } = payload
      assertSessionId(sessionId)
      closeSession(sessionId)

      const terminalProcess = pty.spawn(defaultShell(), [], {
        cols: normalizeSize(payload.cols),
        rows: normalizeSize(payload.rows),
        cwd: process.cwd(),
        name: 'xterm-256color'
      })
      const session = { process: terminalProcess, owner: event.sender }
      sessions.set(sessionId, session)

      terminalProcess.onData((data) => {
        if (!event.sender.isDestroyed()) event.sender.send('terminal:output', { sessionId, data })
      })
      terminalProcess.onExit(() => sessions.delete(sessionId))
    }
  )

  ipcMain.handle('terminal:write', (event, payload: { sessionId: string; data: string }) => {
    assertSessionId(payload.sessionId)
    const session = sessions.get(payload.sessionId)
    if (!session) throw new Error('Terminal session not found')
    if (session.owner !== event.sender) throw new Error('Terminal session owner mismatch')
    session.process.write(payload.data)
  })

  ipcMain.handle(
    'terminal:resize',
    (event, payload: { sessionId: string; cols: number; rows: number }) => {
      assertSessionId(payload.sessionId)
      const session = sessions.get(payload.sessionId)
      if (!session) return
      if (session.owner !== event.sender) throw new Error('Terminal session owner mismatch')
      session.process.resize(normalizeSize(payload.cols), normalizeSize(payload.rows))
    }
  )

  ipcMain.handle('terminal:close', (event, sessionId: string) => {
    assertSessionId(sessionId)
    const session = sessions.get(sessionId)
    if (session && session.owner !== event.sender)
      throw new Error('Terminal session owner mismatch')
    closeSession(sessionId)
  })
}
