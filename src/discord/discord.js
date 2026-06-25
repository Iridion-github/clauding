// Discord Activity bootstrap.
//
// The same build runs in two places:
//   1. The public website on Render (normal browser) — Discord code never runs.
//   2. Embedded inside Discord as an Activity (an iframe on *.discordsays.com) —
//      we initialise the Embedded App SDK, do the OAuth handshake, and learn which
//      voice channel + user we're attached to so the game can auto-join a room.
//
// Discord launches the iframe with query params (frame_id, instance_id, channel_id,
// guild_id, platform). The presence of `frame_id` is the canonical "am I running
// inside Discord?" signal.
import { DiscordSDK } from '@discord/embedded-app-sdk';

const params = new URLSearchParams(window.location.search);
export const isDiscordActivity = Boolean(params.get('frame_id'));

const CLIENT_ID = process.env.REACT_APP_DISCORD_CLIENT_ID;

let _setupPromise = null;

// Resolves to { user, channelId, instanceId } when running as an Activity, or
// null when running as a plain website. Memoised so it only runs once.
export function setupDiscord() {
  if (!isDiscordActivity) return Promise.resolve(null);
  if (_setupPromise) return _setupPromise;

  _setupPromise = (async () => {
    if (!CLIENT_ID) {
      throw new Error('REACT_APP_DISCORD_CLIENT_ID is not set at build time.');
    }

    const sdk = new DiscordSDK(CLIENT_ID);
    await sdk.ready();

    // 1) Ask Discord for an OAuth authorization code (no visible prompt for an
    //    already-authorized user). `identify` is all we need to know who's playing.
    const { code } = await sdk.commands.authorize({
      client_id: CLIENT_ID,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify'],
    });

    // 2) Exchange the code for an access token on our server (keeps the client
    //    secret server-side). Same-origin path — proxied to Render by Discord.
    const res = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throw new Error(`Token exchange failed (${res.status}).`);
    const { access_token } = await res.json();

    // 3) Authenticate the SDK with the token; this returns the player's profile.
    const auth = await sdk.commands.authenticate({ access_token });
    if (!auth?.user) throw new Error('Discord authentication returned no user.');

    return {
      user: auth.user,                 // { id, username, global_name, avatar, ... }
      channelId: sdk.channelId,        // voice channel — stable shared room key
      instanceId: sdk.instanceId,      // this Activity launch
    };
  })();

  return _setupPromise;
}

// The room every player in the same voice channel converges on. Channel id is a
// snowflake; we prefix + uppercase it so it reads as a room code in the lobby.
export function discordRoomId(info) {
  const base = info.channelId || info.instanceId || 'lobby';
  return `DC-${base}`.toUpperCase();
}

// Best available display name for the Discord user.
export function discordPlayerName(info) {
  return info.user.global_name || info.user.username || 'Player';
}

// CDN URL for the Discord user's avatar (256px), or their default avatar if they have
// none. Loaded as a plain <img> from Discord's own CDN (allowed by the Activity CSP).
export function discordAvatarUrl(info) {
  const u = info?.user;
  if (!u || !u.id) return null;
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=256`;
  // New default-avatar scheme: (user_id >> 22) % 6. Dividing by 2^22 (=4194304) drops the
  // low timestamp bits, leaving a value well within Number's safe range, so no BigInt needed.
  let idx = 0;
  try { idx = Math.floor(Number(u.id) / 4194304) % 6; } catch { idx = 0; }
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}
