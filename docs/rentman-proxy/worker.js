// Cloudflare Worker — Rentman CORS proxy for Urban Echo portal
// Deploy at: https://dash.cloudflare.com → Workers → Create → paste this file
// Set Worker name: rentman-proxy
// Add environment variable: RENTMAN_TOKEN  (your Rentman API JWT)

const RENTMAN_BASE = 'https://api.rentman.net';
const ALLOWED_ORIGIN = 'https://urbanecho.com.au';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: CORS });
    }

    const url = new URL(request.url);
    // Strip the /rentman prefix if used, forward the rest as the Rentman path
    const rentmanPath = url.pathname.replace(/^\/rentman/, '') + url.search;

    const upstream = await fetch(RENTMAN_BASE + rentmanPath, {
      headers: {
        'Authorization': 'Bearer ' + env.RENTMAN_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        ...CORS,
      },
    });
  },
};
