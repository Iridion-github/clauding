// Cloudflare Worker — Discord OAuth token-exchange proxy.
//
// Why this exists: FlippingHusks is hosted on Render's free tier, whose shared
// datacenter egress IP is rate-limited by Discord's Cloudflare (HTTP 429 /
// "error code: 1015"). This Worker performs the discord.com token exchange from
// Cloudflare's network — a clean egress IP Discord does not block — and holds the
// client secret so it never ships to the browser.
//
// Flow:  browser → Render /api/token → THIS Worker → discord.com/api/oauth2/token
//
// Env (set as Worker variables/secrets — see README.md):
//   DISCORD_CLIENT_ID      — the Activity's application (client) id
//   DISCORD_CLIENT_SECRET  — the Activity's client secret  (mark as Secret)
//   PROXY_SECRET           — shared secret; must match Render's
//                            DISCORD_TOKEN_PROXY_SECRET  (mark as Secret, optional)

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed.' }, 405);
    }

    // Shared-secret gate so nobody can use this Worker as an open relay.
    if (env.PROXY_SECRET && request.headers.get('x-proxy-secret') !== env.PROXY_SECRET) {
      return json({ error: 'Unauthorized.' }, 401);
    }

    let body;
    try { body = await request.json(); } catch { body = null; }
    const code = body?.code;
    if (!code) return json({ error: 'Missing authorization code.' }, 400);

    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
      return json({ error: 'Discord credentials not configured on the Worker.' }, 500);
    }

    const params = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    });

    let resp, data, raw;
    try {
      resp = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      raw = await resp.text();
      try { data = JSON.parse(raw); } catch { data = null; }
    } catch (err) {
      return json({ error: 'Token exchange error.', detail: String(err) }, 502);
    }

    if (!resp.ok || !data?.access_token) {
      // Mirror the diagnostic shape the client already understands.
      return json({
        error: 'Token exchange failed.',
        discordStatus: resp.status,
        discordError: data?.error ?? null,
        discordErrorDescription: data?.error_description ?? (data ? null : raw?.slice(0, 200)),
      }, 502);
    }

    return json({ access_token: data.access_token });
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
