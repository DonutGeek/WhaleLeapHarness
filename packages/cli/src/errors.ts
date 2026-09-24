import type { SessionSnapshot } from './types.js'

export type ErrorKind = 'runtime' | 'model' | 'tool' | 'permission' | 'abort'
export type ErrorDisposition = 'recoverable' | 'fatal' | 'aborted'

export interface ErrorInfo {
  kind: ErrorKind
  code: string
  message: string
  disposition: ErrorDisposition
}

export class RuntimeError extends Error implements ErrorInfo {
  readonly kind: ErrorKind = 'runtime'
  readonly disposition: ErrorDisposition = 'fatal'
  session?: SessionSnapshot

  constructor(
    readonly code: string,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = new.target.name
  }

  toJSON(): ErrorInfo {
    return {
      kind: this.kind,
      code: this.code,
      message: this.message,
      disposition: this.disposition
    }
  }
}

export class ModelError extends RuntimeError {
  override readonly kind = 'model'
}

export class ToolError extends RuntimeError {
  override readonly kind = 'tool'
  override readonly disposition = 'recoverable'
}

export class PermissionError extends RuntimeError {
  override readonly kind = 'permission'
  override readonly disposition = 'recoverable'
}

export class RuntimeAbortError extends RuntimeError {
  override readonly kind = 'abort'
  override readonly disposition = 'aborted'

  constructor() {
    super('ABORTED', 'Agent execution was cancelled')
  }
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new RuntimeAbortError()
}

// External callbacks may ignore signals. Stop waiting without allowing late results into the session.
export async function abortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  throwIfAborted(signal)
  let onAbort: () => void = () => {}
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => reject(new RuntimeAbortError())
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    return await Promise.race([
      Promise.resolve().then(() => {
        throwIfAborted(signal)
        return operation()
      }),
      cancelled
    ])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}
