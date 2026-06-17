# Discord token-exchange proxy (Cloudflare Worker)

Render free-tier's shared egress IP is rate-limited by Discord's Cloudflare
(`429 / error code: 1015`). This Worker runs the `discord.com` token exchange from
Cloudflare's clean egress IP instead, and holds the client secret.

```
browser → Render /api/token → THIS Worker → discord.com/api/oauth2/token
```

Free tier (100k req/day) is far more than this Activity needs — one request per launch.

## Setup (dashboard, no CLI needed)

1. **Create the Worker.** Cloudflare dashboard → Workers & Pages → *Create* → *Worker*.
   Name it `flippinghusks-token-proxy`, deploy the placeholder, then *Edit code* and
   paste the contents of [`worker.js`](./worker.js). Deploy.
2. **Add variables.** Worker → *Settings* → *Variables and Secrets*. Add (all as
   **Secret**, i.e. "Encrypt"):
   - `DISCORD_CLIENT_ID` — the Activity's application/client id
   - `DISCORD_CLIENT_SECRET` — the Activity's client secret
   - `PROXY_SECRET` — any long random string (e.g. `openssl rand -hex 24`)
3. **Copy the Worker URL** — `https://flippinghusks-token-proxy.<your-subdomain>.workers.dev`.
4. **Point Render at it.** On the Render service, add env vars:
   - `DISCORD_TOKEN_PROXY_URL` = the Worker URL from step 3
   - `DISCORD_TOKEN_PROXY_SECRET` = the **same** value as the Worker's `PROXY_SECRET`
   Redeploy. (Render's own `DISCORD_CLIENT_SECRET` is now unused on the direct path
   but harmless to leave.)
5. **Relaunch the Activity once** (fresh code). Expect `200 + access_token`.

## Setup (CLI alternative)

```bash
cd discord-token-worker
npm i -g wrangler           # if not installed
wrangler login
wrangler secret put DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put PROXY_SECRET
wrangler deploy
```

Then do steps 3–5 above.

## Verifying

The Worker returns the same JSON shape the client already understands, so a failure
still shows `discordStatus` / `discordError` in the browser network tab. If you now
see a non-429 status (e.g. `invalid_client`), the IP block is solved and any
remaining issue is credentials.
