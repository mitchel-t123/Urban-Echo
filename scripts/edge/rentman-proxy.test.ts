// Tests for supabase/functions/rentman-proxy/index.ts (the retired stub).
import { assert, assertEquals } from './asserts.ts'

// deno-lint-ignore no-explicit-any
const g = globalThis as any

Deno.env.set('RENTMAN_TOKEN', 'secret-rentman-token')
let fetches = 0
g.fetch = () => {
  fetches++
  return Promise.reject(new Error('the retired proxy must not call anything'))
}

await import(new URL('../../supabase/functions/rentman-proxy/index.ts', import.meta.url).href)

Deno.test('the retired proxy refuses every request and never uses the Rentman token', async () => {
  for (const method of ['GET', 'POST', 'OPTIONS']) {
    const res = await g.__handler(
      new Request('https://project.supabase.co/functions/v1/rentman-proxy/crew?limit=100', {
        method,
        headers: { authorization: 'Bearer anon-key' },
      }),
    )
    assertEquals(res.status, 410, method)
    const text = await res.text()
    assert(!text.includes('secret-rentman-token'), 'token must not appear')
  }
  assertEquals(fetches, 0, 'no outgoing requests')
})
