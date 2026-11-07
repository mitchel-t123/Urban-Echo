// Minimal assertion helpers so the tests need no remote imports.
export function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message)
}

export function assertEquals(actual: unknown, expected: unknown, message = ''): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${message ? message + ': ' : ''}expected ${e} but got ${a}`)
}
