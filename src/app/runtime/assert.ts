export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

export function assertOnce(flag: boolean, message: string): void {
  invariant(!flag, message)
}

export function assertDefined<T>(value: T | null | undefined, message: string): T {
  invariant(value !== null && value !== undefined, message)
  return value
}
