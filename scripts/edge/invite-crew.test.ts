// Tests for supabase/functions/invite-crew/index.ts
//
// The real function file runs here, with the real jose library checking real
// RS256 signatures. Only the network (Clerk) and the database (Supabase) are
// faked. Run with:  bash scripts/test-edge-functions.sh
import { exportJWK, generateKeyPair, SignJWT } from 'npm:jose@5.9.6'
import { assert, assertEquals } from './asserts.ts'

// deno-lint-ignore no-explicit-any
const g = globalThis as any

const ADMIN_ID = 'user_3GWcEQB1aIQ9VX3mF4ZOd3gF9IV' // the owner's real Clerk id (public in admin.html)
const OTHER_ID = 'user_2abcDEFghiJKLmnoPQRstuvWXyz'
const SESSION_ID = 'sess_2abcDEFghiJKLmnoPQRstuvWXyz'
const ISSUER = 'https://clerk.urbanecho.com.au'
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`
const SITE = 'https://www.urbanecho.com.au'
const FN_URL = Deno.env.get('INVITE_CREW_FILE_URL') ??
  new URL('../../supabase/functions/invite-crew/index.ts', import.meta.url).href

// Clerk's signing key, and a different key an attacker controls.
const clerkKeys = await generateKeyPair('RS256')
const attackerKeys = await generateKeyPair('RS256')
const clerkJwk = { ...(await exportJWK(clerkKeys.publicKey)), kid: 'ins_clerk', alg: 'RS256', use: 'sig' }

// ── Fake world ──────────────────────────────────────────────────
type Call = { url: string; method: string; auth: string; body: unknown }
const world = {
  calls: [] as Call[],
  jwksUp: true,
  sessionHttp: 200,
  sessionStatus: 'active',
  sessionUser: ADMIN_ID,
  invite: { status: 200, body: { id: 'inv_123' } as unknown },
  inviteThrows: false,
}

function reset(): void {
  world.calls = []
  world.jwksUp = true
  world.sessionHttp = 200
  world.sessionStatus = 'active'
  world.sessionUser = ADMIN_ID
  world.invite = { status: 200, body: { id: 'inv_123' } }
  world.inviteThrows = false
  g.__db = { tables: { profiles: [] }, ops: [], fail: '' }
}

g.fetch = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const headers = new Headers(init?.headers)
  world.calls.push({
    url,
    method: init?.method ?? 'GET',
    auth: headers.get('authorization') ?? '',
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  })
  if (url === JWKS_URL) {
    return Promise.resolve(
      world.jwksUp ? Response.json({ keys: [clerkJwk] }) : new Response('down', { status: 503 }),
    )
  }
  if (url.startsWith('https://api.clerk.com/v1/sessions/')) {
    if (world.sessionHttp !== 200) return Promise.resolve(new Response('{}', { status: world.sessionHttp }))
    return Promise.resolve(Response.json({
      id: decodeURIComponent(url.split('/').pop() ?? ''),
      status: world.sessionStatus,
      user_id: world.sessionUser,
    }))
  }
  if (url === 'https://api.clerk.com/v1/invitations') {
    if (world.inviteThrows) return Promise.reject(new Error('secret-internal-detail-do-not-leak'))
    return Promise.resolve(new Response(JSON.stringify(world.invite.body), {
      status: world.invite.status,
      headers: { 'content-type': 'application/json' },
    }))
  }
  return Promise.reject(new Error(`unexpected fetch ${url}`))
}

// Each call loads a fresh copy of the real function, so settings read at start-up can differ.
let loads = 0
async function load(env: Record<string, string> = {}): Promise<(req: Request) => Promise<Response>> {
  for (const k of ['SUPER_ADMIN_CLERK_IDS', 'PROFILE_ROLE_ADMINS', 'ALLOWED_ORIGINS', 'CLERK_ISSUER']) {
    Deno.env.delete(k)
  }
  Deno.env.set('CLERK_SECRET_KEY', 'sk_test_secret')
  Deno.env.set('SUPABASE_URL', 'https://example.supabase.co')
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
  for (const [k, v] of Object.entries(env)) Deno.env.set(k, v)
  await import(`${FN_URL}?load=${++loads}`)
  return g.__handler
}

type TokenOptions = {
  sub?: string
  sid?: string | null
  iss?: string
  azp?: string | null
  kid?: string
  key?: Awaited<ReturnType<typeof generateKeyPair>>['privateKey']
  issuedAt?: number
  expires?: number | string | null
  extra?: Record<string, unknown>
}

async function token(o: TokenOptions = {}): Promise<string> {
  const claims: Record<string, unknown> = { ...(o.extra ?? {}) }
  if (o.sid !== null) claims.sid = o.sid ?? SESSION_ID
  if (o.azp !== null) claims.azp = o.azp ?? SITE
  let jwt = new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: o.kid ?? 'ins_clerk' })
    .setSubject(o.sub ?? ADMIN_ID)
    .setIssuer(o.iss ?? ISSUER)
    .setIssuedAt(o.issuedAt)
  if (o.expires !== null) jwt = jwt.setExpirationTime(o.expires ?? '60s')
  return await jwt.sign(o.key ?? clerkKeys.privateKey)
}

type PostOptions = { origin?: string | null; method?: string; raw?: string }
function post(body: unknown, o: PostOptions = {}): Request {
  const headers = new Headers({ 'content-type': 'application/json', authorization: 'Bearer anon-key' })
  const origin = o.origin === undefined ? SITE : o.origin
  if (origin) headers.set('origin', origin)
  const method = o.method ?? 'POST'
  return new Request('https://project.supabase.co/functions/v1/invite-crew', {
    method,
    headers,
    body: method === 'GET' || method === 'OPTIONS' ? undefined : (o.raw ?? JSON.stringify(body)),
  })
}

async function asAdmin(fields: Record<string, unknown>, tokenOptions: TokenOptions = {}) {
  return { clerk_token: await token(tokenOptions), ...fields }
}

// deno-lint-ignore no-explicit-any
async function read(res: Response): Promise<any> {
  return await res.json()
}

function dbWrites(): number {
  // deno-lint-ignore no-explicit-any
  return g.__db.ops.filter((o: any) => o.op !== 'select').length
}
function invitesSent(): number {
  return world.calls.filter((c) => c.url === 'https://api.clerk.com/v1/invitations').length
}
function assertNothingHappened(): void {
  assertEquals(invitesSent(), 0, 'no Clerk invitation was sent')
  assertEquals(dbWrites(), 0, 'no database write happened')
}

const opts = { sanitizeOps: false, sanitizeResources: false }

// ── Who may call it ─────────────────────────────────────────────
Deno.test({ name: 'a request with no sign-in token is refused (the old function accepted it)', ...opts, fn: async () => {
  reset()
  const handler = await load()
  const res = await handler(post({ email: 'attacker@example.com', role: 'super_admin' }))
  assertEquals(res.status, 401)
  assertNothingHappened()
} })

Deno.test({ name: 'the public anon key is not a credential', ...opts, fn: async () => {
  reset()
  const handler = await load()
  // The request already carries "Authorization: Bearer anon-key" via post(); a token field is what counts.
  const res = await handler(post({ email: 'attacker@example.com', role: 'super_admin', clerk_token: 'anon-key' }))
  assertEquals(res.status, 401)
  assertNothingHappened()
} })

const forgeries: [string, () => Promise<unknown>, string?][] = [
  ['garbage text', () => Promise.resolve('not-a-jwt-but-long-enough-to-pass-length-checks')],
  ['signed with the attacker\'s own key (same key id)', () => token({ key: attackerKeys.privateKey })],
  ['unknown key id', () => token({ kid: 'ins_unknown' })],
  ['expired', () => token({ issuedAt: Math.floor(Date.now() / 1000) - 600, expires: Math.floor(Date.now() / 1000) - 300 })],
  ['no expiry at all', () => token({ expires: null })],
  ['issued by a different issuer', () => token({ iss: 'https://clerk.evil.example' })],
  ['issued to a different site (azp)', () => token({ azp: 'https://evil.example' })],
  ['no session id', () => token({ sid: null })],
  ['subject that is not a Clerk user id', () => token({ sub: 'admin' })],
  ['unsigned (alg none)', () => {
    const enc = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
    const exp = Math.floor(Date.now() / 1000) + 60
    return Promise.resolve(`${enc({ alg: 'none', typ: 'JWT' })}.${enc({ sub: ADMIN_ID, sid: SESSION_ID, iss: ISSUER, azp: SITE, exp })}.`)
  }],
  ['HS256 signed with the public key as the secret (algorithm confusion)', async () => {
    const secret = new TextEncoder().encode(JSON.stringify(clerkJwk))
    return await new SignJWT({ sid: SESSION_ID, azp: SITE })
      .setProtectedHeader({ alg: 'HS256', kid: 'ins_clerk' })
      .setSubject(ADMIN_ID).setIssuer(ISSUER).setExpirationTime('60s').sign(secret)
  }],
]
for (const [label, make] of forgeries) {
  Deno.test({ name: `forged or invalid token is refused: ${label}`, ...opts, fn: async () => {
    reset()
    const handler = await load()
    const res = await handler(post({ email: 'attacker@example.com', role: 'super_admin', clerk_token: await make() }))
    assertEquals(res.status, 401)
    assertNothingHappened()
  } })
}

Deno.test({ name: 'a signed-out or revoked session is refused straight away', ...opts, fn: async () => {
  for (const status of ['ended', 'revoked', 'removed', 'expired', 'abandoned']) {
    reset()
    world.sessionStatus = status
    const handler = await load()
    const res = await handler(post(await asAdmin({ email: 'jane@example.com' })))
    assertEquals(res.status, 401, `session ${status}`)
    assertNothingHappened()
  }
} })

Deno.test({ name: 'a session that belongs to a different user is refused', ...opts, fn: async () => {
  reset()
  world.sessionUser = OTHER_ID
  const handler = await load()
  const res = await handler(post(await asAdmin({ email: 'jane@example.com' })))
  assertEquals(res.status, 401)
  assertNothingHappened()
} })

Deno.test({ name: 'if Clerk cannot confirm the session, the request fails closed', ...opts, fn: async () => {
  reset()
  world.sessionHttp = 500
  const handler = await load()
  const res = await handler(post(await asAdmin({ email: 'jane@example.com' })))
  assertEquals(res.status, 401)
  assertNothingHappened()
} })

Deno.test({ name: 'if the signing keys cannot be fetched, the request fails closed', ...opts, fn: async () => {
  reset()
  world.jwksUp = false
  const handler = await load()
  const res = await handler(post(await asAdmin({ email: 'jane@example.com' })))
  assertEquals(res.status, 401)
  assertNothingHappened()
} })

Deno.test({ name: 'a signed-in user who is not a super admin is refused, even if the token claims a role', ...opts, fn: async () => {
  reset()
  world.sessionUser = OTHER_ID
  const handler = await load()
  const res = await handler(post(await asAdmin(
    { email: 'friend@example.com', role: 'super_admin' },
    { sub: OTHER_ID, extra: { role: 'super_admin', public_metadata: { role: 'super_admin' } } },
  )))
  assertEquals(res.status, 403)
  assertEquals((await read(res)).error, 'Only a super admin can send invites.')
  assertNothingHappened()
} })

// ── What it accepts ─────────────────────────────────────────────
Deno.test({ name: 'a super admin can invite, and the details are cleaned before use', ...opts, fn: async () => {
  reset()
  const handler = await load()
  const res = await handler(post(await asAdmin({
    email: '  Jane.Smith+crew@Example.COM ',
    first_name: '  Jane   Mary ',
    last_name: 'Smith',
    role: 'team_manager',
  })))
  const body = await read(res)
  assertEquals(res.status, 200)
  assertEquals(body.ok, true)
  assertEquals(body.invitation_id, 'inv_123')
  assert(!('warning' in body), 'no warning on a clean run')

  const invite = world.calls.find((c) => c.url === 'https://api.clerk.com/v1/invitations')!
  assertEquals(invite.auth, 'Bearer sk_test_secret')
  assertEquals(invite.body, {
    email_address: 'jane.smith+crew@example.com',
    redirect_url: 'https://urbanecho.com.au/join',
    public_metadata: { role: 'team_manager' },
  })

  const rows = g.__db.tables.profiles
  assertEquals(rows.length, 1)
  assertEquals(rows[0].email, 'jane.smith+crew@example.com')
  assertEquals(rows[0].first_name, 'Jane Mary')
  assertEquals(rows[0].last_name, 'Smith')
  assertEquals(rows[0].role, 'team_manager')
  assert(/^[0-9a-f-]{36}$/.test(rows[0].id), 'a temporary UUID is used for the id')
} })

Deno.test({ name: 'role defaults to team, and blank names are stored as null', ...opts, fn: async () => {
  reset()
  const handler = await load()
  const res = await handler(post(await asAdmin({ email: 'a@example.com', first_name: '  ', last_name: '' })))
  assertEquals(res.status, 200)
  const row = g.__db.tables.profiles[0]
  assertEquals([row.first_name, row.last_name, row.role], [null, null, 'team'])
} })

Deno.test({ name: 'ordinary real-world names are accepted', ...opts, fn: async () => {
  const names = ["O'Brien", 'Jo-Anne', 'Zoë', '李', 'D’Arcy', 'St. John', 'van der Berg', 'Ng']
  reset()
  const handler = await load()
  for (const name of names) {
    const res = await handler(post(await asAdmin({ email: 'a@example.com', first_name: name, last_name: name })))
    assertEquals(res.status, 200, `name ${name}`)
  }
} })

Deno.test({ name: 're-inviting an existing person updates them without changing their id', ...opts, fn: async () => {
  reset()
  g.__db.tables.profiles.push({ id: 'user_real_clerk_id', email: 'jane@example.com', first_name: 'Old', role: 'team' })
  const handler = await load()
  const res = await handler(post(await asAdmin({ email: 'JANE@example.com', first_name: 'Jane', role: 'team_manager' })))
  assertEquals(res.status, 200)
  const rows = g.__db.tables.profiles
  assertEquals(rows.length, 1)
  assertEquals([rows[0].id, rows[0].first_name, rows[0].role], ['user_real_clerk_id', 'Jane', 'team_manager'])
  // deno-lint-ignore no-explicit-any
  assertEquals(g.__db.ops.filter((o: any) => o.op === 'insert').length, 0)
} })

// ── What it rejects (after sign-in) ─────────────────────────────
const badInputs: [string, Record<string, unknown>][] = [
  ['missing email', {}],
  ['email that is not an address', { email: 'not-an-email' }],
  ['email with markup', { email: '<script>alert(1)</script>@example.com' }],
  ['email with a quote', { email: "a'b@example.com" }],
  ['email with a space inside', { email: 'a b@example.com' }],
  ['two addresses', { email: 'a@example.com,b@example.com' }],
  ['email over 254 characters', { email: `${'a'.repeat(60)}@${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.${'e'.repeat(30)}.com` }],
  ['email that is not text', { email: 12345 }],
  ['unknown role', { email: 'a@example.com', role: 'owner' }],
  ['role that is not text', { email: 'a@example.com', role: ['super_admin'] }],
  ['first name with markup', { email: 'a@example.com', first_name: '<img src=x onerror=alert(1)>' }],
  ['last name with a quote', { email: 'a@example.com', last_name: '"><b>x</b>' }],
  ['name with a digit', { email: 'a@example.com', first_name: 'Jane2' }],
  ['name that is too long', { email: 'a@example.com', first_name: 'A'.repeat(61) }],
  ['name that is not text', { email: 'a@example.com', first_name: { $ne: null } }],
]
for (const [label, fields] of badInputs) {
  Deno.test({ name: `bad input is refused: ${label}`, ...opts, fn: async () => {
    reset()
    const handler = await load()
    const res = await handler(post(await asAdmin(fields)))
    assertEquals(res.status, 400)
    assertNothingHappened()
  } })
}

Deno.test({ name: 'oversized and malformed bodies are refused', ...opts, fn: async () => {
  reset()
  const handler = await load()
  assertEquals((await handler(post(null, { raw: 'x'.repeat(5000) }))).status, 413)
  assertEquals((await handler(post(null, { raw: '{not json' }))).status, 400)
  assertEquals((await handler(post(null, { raw: '[1,2,3]' }))).status, 400)
  assertEquals((await handler(post(null, { raw: 'null' }))).status, 400)
  assertNothingHappened()
} })

// ── Failures downstream ─────────────────────────────────────────
Deno.test({ name: 'a Clerk rejection is passed on clearly and nothing is saved', ...opts, fn: async () => {
  reset()
  world.invite = { status: 422, body: { errors: [{ long_message: 'That email address is taken.' }] } }
  const handler = await load()
  const res = await handler(post(await asAdmin({ email: 'taken@example.com' })))
  assertEquals(res.status, 400)
  assertEquals((await read(res)).error, 'That email address is taken.')
  assertEquals(dbWrites(), 0)
} })

Deno.test({ name: 'unexpected errors never leak internal details', ...opts, fn: async () => {
  reset()
  world.inviteThrows = true
  const handler = await load()
  const res = await handler(post(await asAdmin({ email: 'a@example.com' })))
  const text = await res.text()
  assertEquals(res.status, 500)
  assert(!text.includes('secret-internal-detail'), 'error text must not contain internal details')
  assert(!text.includes('sk_test_secret'), 'secret key must never appear')
} })

Deno.test({ name: 'if the crew list cannot be updated, the invite still succeeds with a visible warning', ...opts, fn: async () => {
  for (const fail of ['insert', 'lookup']) {
    reset()
    g.__db.fail = fail
    const handler = await load()
    const res = await handler(post(await asAdmin({ email: 'a@example.com' })))
    const body = await read(res)
    assertEquals(res.status, 200, `fail=${fail}`)
    assertEquals(body.ok, true)
    assertEquals(body.warning, 'Invite sent, but the crew list could not be updated.')
  }
} })

// ── Browser access (CORS) ───────────────────────────────────────
Deno.test({ name: 'preflight from the real site is allowed, from any other site is not', ...opts, fn: async () => {
  reset()
  const handler = await load()
  for (const origin of ['https://urbanecho.com.au', 'https://www.urbanecho.com.au']) {
    const res = await handler(post(null, { method: 'OPTIONS', origin }))
    assertEquals(res.status, 204)
    assertEquals(res.headers.get('access-control-allow-origin'), origin)
    assertEquals(res.headers.get('vary'), 'Origin')
  }
  const bad = await handler(post(null, { method: 'OPTIONS', origin: 'https://evil.example' }))
  assertEquals(bad.status, 403)
  assertEquals(bad.headers.get('access-control-allow-origin'), null)
} })

Deno.test({ name: 'a request from another site is refused even with a valid token', ...opts, fn: async () => {
  reset()
  const handler = await load()
  const res = await handler(post(await asAdmin({ email: 'a@example.com' }), { origin: 'https://evil.example' }))
  assertEquals(res.status, 403)
  assertEquals(res.headers.get('access-control-allow-origin'), null)
  assertNothingHappened()
} })

Deno.test({ name: 'responses are never cached, and only POST is accepted', ...opts, fn: async () => {
  reset()
  const handler = await load()
  const res = await handler(post({}, { method: 'GET' }))
  assertEquals(res.status, 405)
  assertEquals(res.headers.get('cache-control'), 'no-store')
} })

// ── Settings ────────────────────────────────────────────────────
Deno.test({ name: 'SUPER_ADMIN_CLERK_IDS replaces the default list', ...opts, fn: async () => {
  reset()
  world.sessionUser = OTHER_ID
  const handler = await load({ SUPER_ADMIN_CLERK_IDS: ` ${OTHER_ID} , user_someoneElse123456 ` })
  const ok = await handler(post(await asAdmin({ email: 'a@example.com' }, { sub: OTHER_ID })))
  assertEquals(ok.status, 200)

  reset()
  const handler2 = await load({ SUPER_ADMIN_CLERK_IDS: OTHER_ID })
  const owner = await handler2(post(await asAdmin({ email: 'a@example.com' })))
  assertEquals(owner.status, 403)
  assertNothingHappened()
} })

Deno.test({ name: 'profile roles are not trusted unless PROFILE_ROLE_ADMINS is on', ...opts, fn: async () => {
  // Off by default: a profiles row saying super_admin is not enough.
  reset()
  world.sessionUser = OTHER_ID
  g.__db.tables.profiles.push({ id: OTHER_ID, email: 'x@example.com', role: 'super_admin' })
  let handler = await load()
  let res = await handler(post(await asAdmin({ email: 'a@example.com' }, { sub: OTHER_ID })))
  assertEquals(res.status, 403)
  assertEquals(invitesSent(), 0)

  // On: a profile that says super_admin is accepted.
  reset()
  world.sessionUser = OTHER_ID
  g.__db.tables.profiles.push({ id: OTHER_ID, email: 'x@example.com', role: 'super_admin' })
  handler = await load({ PROFILE_ROLE_ADMINS: '1' })
  res = await handler(post(await asAdmin({ email: 'a@example.com' }, { sub: OTHER_ID })))
  assertEquals(res.status, 200)

  // On, but the profile is a normal team member: refused.
  reset()
  world.sessionUser = OTHER_ID
  g.__db.tables.profiles.push({ id: OTHER_ID, email: 'x@example.com', role: 'team' })
  handler = await load({ PROFILE_ROLE_ADMINS: 'true' })
  res = await handler(post(await asAdmin({ email: 'a@example.com' }, { sub: OTHER_ID })))
  assertEquals(res.status, 403)

  // On, but the database lookup fails: refused (fails closed).
  reset()
  world.sessionUser = OTHER_ID
  g.__db.fail = 'lookup'
  handler = await load({ PROFILE_ROLE_ADMINS: '1' })
  res = await handler(post(await asAdmin({ email: 'a@example.com' }, { sub: OTHER_ID })))
  assertEquals(res.status, 403)
  assertEquals(invitesSent(), 0)
} })

Deno.test({ name: 'ALLOWED_ORIGINS can be changed', ...opts, fn: async () => {
  reset()
  const handler = await load({ ALLOWED_ORIGINS: 'https://staging.example.com' })
  const refused = await handler(post(await asAdmin({ email: 'a@example.com' })))
  assertEquals(refused.status, 403)
  const ok = await handler(post(await asAdmin({ email: 'a@example.com' }, { azp: 'https://staging.example.com' }), { origin: 'https://staging.example.com' }))
  assertEquals(ok.status, 200)
} })
