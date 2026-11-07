// invite-crew
//
// Sends a Clerk invitation and pre-creates the matching profile row.
//
// Who can use it: only a signed-in super admin. The portal sends the person's
// Clerk session token in the request body (clerk_token). This function checks
// the token's signature, issuer and expiry, confirms with Clerk that the
// session is still active, and only then does anything. The Supabase anon key
// on its own is not enough, because that key is public.
//
// Settings (Supabase dashboard > Edge Functions > Secrets). Only the first is
// required; the rest have safe defaults.
//   CLERK_SECRET_KEY           Clerk secret key (already set)
//   SUPER_ADMIN_CLERK_IDS      comma separated Clerk user ids allowed to invite.
//                              Default: the owner's id below. Include the owner
//                              in the list if you set it.
//   PROFILE_ROLE_ADMINS        set to 1 to also accept anyone whose profiles row
//                              says role = super_admin. Leave it off unless the
//                              profiles table is locked so people cannot edit
//                              their own role.
//   ALLOWED_ORIGINS            comma separated site origins. Default: the two
//                              urbanecho.com.au origins.
//   CLERK_ISSUER               Clerk Frontend API URL. Default:
//                              https://clerk.urbanecho.com.au
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { createRemoteJWKSet, jwtVerify } from 'https://esm.sh/jose@5.9.6'

// ── Settings ────────────────────────────────────────────────────
const CLERK_SECRET_KEY = (Deno.env.get('CLERK_SECRET_KEY') ?? '').trim()
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CLERK_ISSUER = (Deno.env.get('CLERK_ISSUER') ?? 'https://clerk.urbanecho.com.au')
  .trim()
  .replace(/\/+$/, '')
const PORTAL_URL = 'https://urbanecho.com.au/join'
const OWNER_CLERK_ID = 'user_3GWcEQB1aIQ9VX3mF4ZOd3gF9IV'

function csv(value: string | undefined, fallback: string[]): string[] {
  const items = (value ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return items.length ? items : fallback
}

const SUPER_ADMIN_IDS = csv(Deno.env.get('SUPER_ADMIN_CLERK_IDS'), [OWNER_CLERK_ID])
const ALLOWED_ORIGINS = csv(Deno.env.get('ALLOWED_ORIGINS'), [
  'https://urbanecho.com.au',
  'https://www.urbanecho.com.au',
])
const PROFILE_ROLE_ADMINS = ['1', 'true'].includes(
  (Deno.env.get('PROFILE_ROLE_ADMINS') ?? '').trim().toLowerCase(),
)

const VALID_ROLES = ['team', 'team_manager', 'super_admin']
const MAX_BODY_CHARS = 4096
const CLERK_TIMEOUT_MS = 8000

if (!CLERK_SECRET_KEY) console.error('CLERK_SECRET_KEY is not set: every invite will be refused')

const jwks = createRemoteJWKSet(new URL(`${CLERK_ISSUER}/.well-known/jwks.json`))

// ── Entry point ─────────────────────────────────────────────────
serve(async (req: Request) => {
  const origin = req.headers.get('Origin') ?? ''
  try {
    return await handle(req, origin)
  } catch (e) {
    // Details go to the function logs only, never back to the caller.
    console.error('invite-crew failed:', e instanceof Error ? `${e.name}: ${e.message}` : e)
    return json({ error: 'Something went wrong. Please try again.' }, 500, origin)
  }
})

async function handle(req: Request, origin: string): Promise<Response> {
  // Browsers always send Origin on cross-site requests. Refuse other sites outright.
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'Not allowed from this site.' }, 403, origin)
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, origin)
  }

  const raw = await req.text()
  if (raw.length > MAX_BODY_CHARS) {
    return json({ error: 'Request too large.' }, 413, origin)
  }
  let body: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape')
    body = parsed as Record<string, unknown>
  } catch {
    return json({ error: 'Invalid JSON' }, 400, origin)
  }

  // ── 1. Who is asking? ─────────────────────────────────────────
  const caller = await authenticate(body.clerk_token)
  if (!caller) {
    return json(
      { error: 'Your sign-in could not be verified. Please refresh the page and sign in again.' },
      401,
      origin,
    )
  }
  const admin = SUPABASE_URL && SUPABASE_SERVICE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
    : null
  if (!(await isSuperAdmin(caller.userId, admin))) {
    console.warn('invite-crew refused for non-admin', caller.userId)
    return json({ error: 'Only a super admin can send invites.' }, 403, origin)
  }

  // ── 2. Check what they sent ───────────────────────────────────
  const email = cleanEmail(body.email)
  if (!email) {
    return json({ error: 'Please enter a valid email address.' }, 400, origin)
  }
  const first = cleanName(body.first_name)
  const last = cleanName(body.last_name)
  if (first === false || last === false) {
    return json(
      { error: 'Names can only use letters, spaces, apostrophes, hyphens and full stops (60 characters at most).' },
      400,
      origin,
    )
  }
  const role = body.role === undefined || body.role === '' ? 'team' : body.role
  if (typeof role !== 'string' || !VALID_ROLES.includes(role)) {
    return json({ error: 'Invalid role' }, 400, origin)
  }

  // ── 3. Send the Clerk invitation ──────────────────────────────
  const clerkRes = await fetch('https://api.clerk.com/v1/invitations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: email,
      redirect_url: PORTAL_URL,
      // Stored in public_metadata so the role is readable after sign-up.
      public_metadata: { role },
    }),
    signal: AbortSignal.timeout(CLERK_TIMEOUT_MS),
  })
  const clerkData = await clerkRes.json().catch(() => ({}))
  if (!clerkRes.ok) {
    const msg = clerkData?.errors?.[0]?.long_message ||
      clerkData?.errors?.[0]?.message ||
      'Clerk invitation failed'
    return json({ error: msg }, 400, origin)
  }
  console.log(JSON.stringify({
    event: 'invite',
    by: caller.userId,
    role,
    domain: email.split('@')[1],
  }))

  // ── 4. Pre-create the profile row (pending) ───────────────────
  // Uses the service role key so it can write without a user token. A temp
  // UUID fills the primary key; the Clerk webhook swaps in the real Clerk
  // user id when the person signs up.
  let warning = ''
  if (!admin) {
    warning = 'Invite sent, but the crew list could not be updated.'
  } else {
    const { data: existing, error: lookupError } = await admin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (lookupError) {
      console.error('profile lookup failed:', lookupError.message)
      warning = 'Invite sent, but the crew list could not be updated.'
    } else if (!existing) {
      const { error } = await admin.from('profiles').insert({
        id: crypto.randomUUID(),
        email,
        first_name: first,
        last_name: last,
        role,
      })
      if (error) {
        console.error('profile insert failed:', error.message)
        warning = 'Invite sent, but the crew list could not be updated.'
      }
    } else {
      // Re-invite: update name and role without touching the id.
      const { error } = await admin
        .from('profiles')
        .update({ first_name: first, last_name: last, role })
        .eq('email', email)
      if (error) {
        console.error('profile update failed:', error.message)
        warning = 'Invite sent, but the crew list could not be updated.'
      }
    }
  }

  return json({ ok: true, invitation_id: clerkData.id, ...(warning ? { warning } : {}) }, 200, origin)
}

// ── Who is calling ──────────────────────────────────────────────
// Every refusal is logged with its reason (never shown to the caller) so a
// settings mistake is easy to spot in the function logs.
function reject(reason: string): null {
  console.warn('token rejected:', reason)
  return null
}

async function authenticate(token: unknown): Promise<{ userId: string } | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 4000) return reject('missing or malformed')
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: CLERK_ISSUER,
      algorithms: ['RS256'],
      clockTolerance: 5,
      requiredClaims: ['exp', 'sub'],
    })
    const userId = typeof payload.sub === 'string' ? payload.sub : ''
    const sessionId = typeof payload.sid === 'string' ? payload.sid : ''
    const azp = typeof payload.azp === 'string' ? payload.azp : ''
    if (!/^user_[A-Za-z0-9]{10,}$/.test(userId)) return reject('subject is not a Clerk user id')
    if (!/^sess_[A-Za-z0-9]{10,}$/.test(sessionId)) return reject('no session id')
    // azp is the site the token was issued to; when present it must be ours.
    if (azp && !ALLOWED_ORIGINS.includes(azp)) return reject(`azp ${azp} is not in ALLOWED_ORIGINS`)
    // Tokens live about a minute, so also ask Clerk whether the session is still
    // active. That makes sign-out, revoked sessions and deleted accounts take
    // effect straight away.
    if (!(await sessionIsActive(sessionId, userId))) return reject('session is not active')
    return { userId }
  } catch (e) {
    // jose errors carry the failing claim (for example "iss") and a short code.
    const err = e as { name?: string; code?: string; claim?: string }
    return reject([err.name, err.code, err.claim].filter(Boolean).join(' ') || 'verification failed')
  }
}

async function sessionIsActive(sessionId: string, userId: string): Promise<boolean> {
  const res = await fetch(`https://api.clerk.com/v1/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
    signal: AbortSignal.timeout(CLERK_TIMEOUT_MS),
  })
  if (!res.ok) return false
  const session = await res.json().catch(() => null)
  return !!session && session.status === 'active' && session.user_id === userId
}

// deno-lint-ignore no-explicit-any
async function isSuperAdmin(userId: string, admin: any): Promise<boolean> {
  if (SUPER_ADMIN_IDS.includes(userId)) return true
  if (!PROFILE_ROLE_ADMINS || !admin) return false
  const { data, error } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
  return !error && data?.role === 'super_admin'
}

// ── Input checks ────────────────────────────────────────────────
// Plain addresses only: no quotes, angle brackets or other characters that
// could be mistaken for markup if an address is ever shown on a page.
const EMAIL_RE = /^[A-Za-z0-9._+-]{1,64}@(?:[A-Za-z0-9-]{1,63}\.)+[A-Za-z][A-Za-z0-9-]{1,23}$/

function cleanEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null
}

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M} '’.-]{0,59}$/u

// Returns the cleaned name, null when left blank, or false when it is not acceptable.
function cleanName(value: unknown): string | null | false {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') return false
  const name = value.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (name === '') return null
  return NAME_RE.test(name) ? name : false
}

// ── Responses ───────────────────────────────────────────────────
function corsHeaders(origin: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
  if (ALLOWED_ORIGINS.includes(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function json(data: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(origin) },
  })
}
