import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CLERK_SECRET_KEY  = (Deno.env.get('CLERK_SECRET_KEY') ?? '').trim()
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const PORTAL_URL        = 'https://urbanecho.com.au/join'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: { email?: string; first_name?: string; last_name?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { email, first_name, last_name, role = 'team' } = body

  if (!email) {
    return json({ error: 'email is required' }, 400)
  }

  const validRoles = ['team', 'team_manager', 'super_admin']
  if (!validRoles.includes(role)) {
    return json({ error: 'Invalid role' }, 400)
  }

  // ── 1. Send Clerk invitation ──────────────────────────────────
  const clerkRes = await fetch('https://api.clerk.com/v1/invitations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email_address: email,
      redirect_url: PORTAL_URL,
      // Store role in public_metadata so it's readable after sign-up
      public_metadata: { role },
    }),
  })

  const clerkData = await clerkRes.json()

  if (!clerkRes.ok) {
    const msg = clerkData?.errors?.[0]?.long_message
      || clerkData?.errors?.[0]?.message
      || 'Clerk invitation failed'
    return json({ error: msg }, 400)
  }

  // ── 2. Pre-create a Supabase profile row (pending) ───────────
  // Uses the service role key so it can write without a user JWT.
  // A temp UUID is used for id so the row satisfies the primary key constraint;
  // the Clerk webhook replaces it with the real Clerk user id on sign-up.
  if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    // Check if a profile for this email already exists (don't overwrite real id)
    const { data: existing } = await sb
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (!existing) {
      await sb.from('profiles').insert({
        id: crypto.randomUUID(),
        email,
        first_name: first_name || null,
        last_name:  last_name  || null,
        role,
      })
    } else {
      // Update name/role on re-invite without touching the id
      await sb.from('profiles').update({
        first_name: first_name || null,
        last_name:  last_name  || null,
        role,
      }).eq('email', email)
    }
  }

  return json({ ok: true, invitation_id: clerkData.id })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}
