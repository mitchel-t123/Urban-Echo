// rentman-proxy: retired.
//
// This function used to forward any request to the Rentman API using the
// account token, without checking who was asking. The portal no longer calls
// it, so it now refuses every request and never reads or uses the token.
//
// Deploying this file replaces the old version. Deleting the function in the
// Supabase dashboard (Edge Functions > rentman-proxy) is equally good.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(() =>
  new Response(JSON.stringify({ error: 'This endpoint has been retired.' }), {
    status: 410,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
)
