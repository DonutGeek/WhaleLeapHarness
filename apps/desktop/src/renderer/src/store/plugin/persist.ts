import type { Pinia, PiniaPluginContext } from 'pinia'

const storagePrefix = 'desktop:store:'

const readPersistedState = (context: PiniaPluginContext): void => {
  try {
    const value = localStorage.getItem(`${storagePrefix}${context.store.$id}`)
    if (value) context.store.$patch(JSON.parse(value))
  } catch {
    localStorage.removeItem(`${storagePrefix}${context.store.$id}`)
  }
}

export const registerPiniaPersistPlugin = (pinia: Pinia): void => {
  pinia.use((context) => {
    // 对话状态原本不持久化，避免下次启动时恢复已失效的会话与定时器状态。
    if (context.store.$id === 'agent') return

    readPersistedState(context)
    context.store.$subscribe((_mutation, state) => {
      const { pageLoading: _pageLoading, ...persistedState } = state as Record<string, unknown>
      localStorage.setItem(`${storagePrefix}${context.store.$id}`, JSON.stringify(persistedState))
    })
  })
}
