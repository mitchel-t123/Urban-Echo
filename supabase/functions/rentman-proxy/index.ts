import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RENTMAN_BASE = 'https://api.rentman.net'
const RENTMAN_TOKEN = Deno.env.get('RENTMAN_TOKEN') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS })
  }

  const url = new URL(req.url)
  // Forward everything after /rentman-proxy as the Rentman path
  const path = url.pathname.replace(/.*\/rentman-proxy/, '') || '/'
  const query = url.search

  try {
    const upstream = await fetch(RENTMAN_BASE + path + query, {
      headers: {
        Authorization: `Bearer ${RENTMAN_TOKEN}`,
        'Content-Type': 'application/json',
      },
    })

    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS },
    })
  }
})
