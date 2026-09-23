export type ApiResponse<T> = {
  data: T
}

export const isDefined = <T>(value: T | null | undefined): value is T => value != null
