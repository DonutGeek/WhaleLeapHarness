export function objectInput(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Expected an object')
  }
  const object = input as Record<string, unknown>
  const unexpected = Object.keys(object).find((key) => !allowed.includes(key))
  if (unexpected !== undefined) throw new Error(`Unknown property: ${unexpected}`)
  return object
}

export function stringInput(
  object: Record<string, unknown>,
  key: string,
  options: { optional?: boolean; empty?: boolean; maxBytes?: number } = {}
): string | undefined {
  const value = object[key]
  if (value === undefined && options.optional) return undefined
  if (typeof value !== 'string' || (!options.empty && value.length === 0) || value.includes('\0')) {
    throw new Error(
      `${key} must be ${options.empty ? 'a' : 'a non-empty'} string without null bytes`
    )
  }
  if (Buffer.byteLength(value) > (options.maxBytes ?? 32_768))
    throw new Error(`${key} is too large`)
  return value
}

export function requiredString(
  object: Record<string, unknown>,
  key: string,
  options: { empty?: boolean; maxBytes?: number } = {}
): string {
  const value = stringInput(object, key, options)
  if (value === undefined) throw new Error(`${key} is required`)
  return value
}

export function integerInput(
  object: Record<string, unknown>,
  key: string,
  fallback: number,
  maximum: number
): number {
  const value = object[key]
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${key} must be an integer from 1 to ${maximum}`)
  }
  return value
}
