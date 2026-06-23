const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const fs   = require('fs');
const path = require('path');
const { createGame: createFlippingHusksGame, resetGame: resetFlippingHusksGame } = require('./flippinghusks/GameState');
const { applyAction: applyFlippingHusksAction } = require('./flippinghusks/GameEngine');

const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// ── Flipping Husks namespace ────────────────────────────────────────────────────────
// fhRooms: { roomId: { hostId, players:[{socketId,id,name}], state } }
const fhRooms = {};
const fhSocketToRoom = {};

const fh = io.of('/flippinghusks');

// The visible "next round" countdown is driven CLIENT-side and only starts once a
// client's round-ending animations finish (animation-end + 5s), at which point the
// client auto-casts its next-round vote and the room advances on the all-voted path.
// This server timer is just a backstop for a client that never reports back — keep
// it comfortably longer than the longest animation + the countdown so it can never
// pre-empt the real, animation-aware countdown.
const NEXT_ROUND_COUNTDOWN_MS = 30000;

// Soundboard: emote keys it accepts, the SP cost to play one, and a hard cap on
// how long the global single-sound lock can stay engaged if the player who played
// it never reports the sound finishing (e.g. they disconnect mid-clip).
const FH_EMOTES = new Set(['anger', 'mockery', 'jingle']);
const SOUND_COST = 10;
const SOUND_LOCK_MAX_MS = 9000; // safety release if the player never reports 'ended' (clips are capped at 8s client-side)
const CHEAT_SP_BONUS = 10; // SP granted each time the hidden cheat "+" button is pressed

// Each emote plays a RANDOM clip from public/sounds/soundboard/<emote>/. The pick
// happens here on the server so every player hears the exact same clip. We read the
// folder fresh each time (clips are few and plays are infrequent) so newly-added
// files are picked up without a restart. In production the public folder is copied
// into build/, so we look there first, then fall back to public/ for local dev.
function soundboardDir(emote) {
  const candidates = [
    path.join(__dirname, '../build/sounds/soundboard', emote),
    path.join(__dirname, '../public/sounds/soundboard', emote),
  ];
  return candidates.find(d => fs.existsSync(d)) || null;
}

// Per-category memory of the most recently played clips. On each pick we remove the
// last RECENT_SOUND_MEMORY files for that emote from the candidate pool so the same
// sound isn't repeated too soon (and never repeats back-to-back).
const RECENT_SOUND_MEMORY = 3;
const recentSounds = new Map(); // emote -> [filenames, most-recent first]

function randomSoundUrl(emote) {
  const dir = soundboardDir(emote);
  if (!dir) return null;
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /\.(mp3|ogg|wav|m4a)$/i.test(f)); }
  catch { return null; }
  if (files.length === 0) return null;

  // Drop the recently-played clips from the pool. If that empties it (the folder has
  // RECENT_SOUND_MEMORY or fewer files), fall back to the full list so a pick is
  // always possible.
  const recent = recentSounds.get(emote) || [];
  let pool = files.filter(f => !recent.includes(f));
  if (pool.length === 0) pool = files;

  const file = pool[Math.floor(Math.random() * pool.length)];

  // Record this pick as most-recent, keeping only the last RECENT_SOUND_MEMORY.
  recentSounds.set(emote, [file, ...recent.filter(f => f !== file)].slice(0, RECENT_SOUND_MEMORY));

  return `/sounds/soundboard/${emote}/${encodeURIComponent(file)}`;
}

// Release the room's global sound lock and tell everyone the field is clear again.
function releaseSoundLock(roomId) {
  const room = fhRooms[roomId];
  if (!room) return;
  if (room.soundLockTimer) { clearTimeout(room.soundLockTimer); room.soundLockTimer = null; }
  if (room.soundLock == null) return;
  room.soundLock = null;
  fh.to(roomId).emit('fh_sound_done');
}

function clearNextRoundTimer(room) {
  if (room && room.nextRoundTimer) {
    clearTimeout(room.nextRoundTimer);
    room.nextRoundTimer = null;
  }
}

// Start (or restart) the auto-advance countdown for a freshly-ended round.
function scheduleNextRound(roomId) {
  const room = fhRooms[roomId];
  if (!room?.state || room.state.phase !== 'round_end') return;
  clearNextRoundTimer(room);
  room.nextRoundDeadline = Date.now() + NEXT_ROUND_COUNTDOWN_MS;
  room.nextRoundTimer = setTimeout(() => advanceToNextRound(roomId), NEXT_ROUND_COUNTDOWN_MS);
  fh.to(roomId).emit('fh_next_round_countdown', { deadline: room.nextRoundDeadline });
}

// Advance the round exactly as if everyone had pressed "Next Round". Shared by
// the all-voted path, the countdown timer, and the disconnect re-check. Guarded
// so it safely no-ops if the round has already advanced.
function advanceToNextRound(roomId) {
  const room = fhRooms[roomId];
  if (!room?.state || room.state.phase !== 'round_end' || room.players.length === 0) return;
  clearNextRoundTimer(room);
  room.nextRoundDeadline = null;
  room.nextRoundVotes.clear();
  const result = applyFlippingHusksAction(room.state, room.players[0].id, { type: 'NEXT_ROUND' });
  if (result.ok) {
    room.state = result.state;
    fh.to(roomId).emit('fh_state_update', { state: fhClientState(room.state) });
  }
}

// ── Roster + reconnection helpers ─────────────────────────────────────────────
// A player who drops mid-game is kept in the room (so the game state stays valid)
// but flagged offline; they resume by reconnecting. A room with nobody online is
// torn down after a grace period so abandoned games don't leak.
const ROOM_CLEANUP_MS = 5 * 60 * 1000;

function roster(room) {
  return room.players.map(p => ({ id: p.id, name: p.name, connected: p.connected !== false }));
}
function connectedCount(room) {
  return room.players.filter(p => p.connected !== false).length;
}
function cancelRoomCleanup(room) {
  if (room && room.cleanupTimer) { clearTimeout(room.cleanupTimer); room.cleanupTimer = null; }
}
function scheduleRoomCleanup(roomId) {
  const room = fhRooms[roomId];
  if (!room || room.cleanupTimer) return;
  room.cleanupTimer = setTimeout(() => {
    clearNextRoundTimer(room);
    if (room.soundLockTimer) clearTimeout(room.soundLockTimer);
    delete fhRooms[roomId];
    console.log('[FlippingHusks] Room cleaned up (all players offline):', roomId);
  }, ROOM_CLEANUP_MS);
}

// Tear a room down entirely — server state + every client — and send everyone back
// to the room-code screen. Used when all players unanimously vote to leave.
function closeRoom(roomId) {
  const room = fhRooms[roomId];
  if (!room) return;
  clearNextRoundTimer(room);
  cancelRoomCleanup(room);
  if (room.soundLockTimer) clearTimeout(room.soundLockTimer);
  fh.to(roomId).emit('fh_room_closed'); // notify while sockets are still in the room
  for (const p of room.players) {
    if (!p.socketId) continue;
    fh.sockets.get(p.socketId)?.leave(roomId);
    delete fhSocketToRoom[p.socketId];
  }
  delete fhRooms[roomId];
  console.log('[FlippingHusks] Room closed (all players voted to leave):', roomId);
}

// Close the room once every ONLINE player has voted to leave (offline players,
// like in the next-round logic, don't block the decision).
function maybeCloseRoomOnLeave(roomId) {
  const room = fhRooms[roomId];
  if (!room?.state) return;
  const online = room.players.filter(p => p.connected !== false);
  if (online.length === 0) return;
  if (online.every(p => room.leaveGameVotes.has(p.id))) closeRoom(roomId);
}

fh.on('connection', (socket) => {
  console.log('[FlippingHusks] Connected:', socket.id);

  socket.on('fh_join', ({ roomId, playerName, playerId }) => {
    const stableId = playerId || socket.id; // stable client identity (falls back for old clients)
    let room = fhRooms[roomId];

    // ── Reconnect / resume: this stable id is already known in the room ─────────
    const existing = room?.players.find(p => p.id === stableId);
    if (room && existing) {
      existing.socketId  = socket.id;
      existing.connected = true;
      if (playerName) existing.name = playerName;
      fhSocketToRoom[socket.id] = { roomId, playerId: stableId };
      socket.join(roomId);
      cancelRoomCleanup(room);

      socket.emit('fh_joined', { roomId, playerId: stableId, isHost: room.hostId === stableId });
      // Hand the reconnecting player the live state so they catch up instantly.
      if (room.state) {
        socket.emit('fh_resync', {
          state: fhClientState(room.state),
          nextRoundDeadline: room.nextRoundDeadline ?? null,
          nextRoundVotes: { votes: [...room.nextRoundVotes], players: roster(room) },
          playAgainVotes: { votes: [...room.playAgainVotes], players: roster(room) },
          leaveGameVotes: { votes: [...(room.leaveGameVotes || [])], players: roster(room) },
        });
      }
      fh.to(roomId).emit('fh_room_update', { players: roster(room), hostId: room.hostId });
      return;
    }

    // ── Fresh join ──────────────────────────────────────────────────────────────
    if (!room) {
      room = fhRooms[roomId] = {
        hostId: stableId, players: [], state: null,
        playAgainVotes: new Set(), nextRoundVotes: new Set(),
        leaveGameVotes: new Set(),
        nextRoundTimer: null, nextRoundDeadline: null,
        cleanupTimer: null, lastActionIds: {},
        soundLock: null, soundLockTimer: null,
      };
    }

    if (room.state) { socket.emit('fh_error', { message: 'Game already started.' }); return; }
    if (room.players.length >= 6) { socket.emit('fh_error', { message: 'Room is full (max 6).' }); return; }

    room.players.push({ socketId: socket.id, id: stableId, name: playerName, connected: true });
    fhSocketToRoom[socket.id] = { roomId, playerId: stableId };
    socket.join(roomId);
    cancelRoomCleanup(room);

    socket.emit('fh_joined', { roomId, playerId: stableId, isHost: room.hostId === stableId });
    fh.to(roomId).emit('fh_room_update', { players: roster(room), hostId: room.hostId });
  });

  socket.on('fh_start', ({ roomId, soundboardEnabled }) => {
    const room = fhRooms[roomId];
    if (!room) { socket.emit('fh_error', { message: 'Room not found.' }); return; }
    const meta = fhSocketToRoom[socket.id];
    if (!meta || room.hostId !== meta.playerId) { socket.emit('fh_error', { message: 'Only the host can start.' }); return; }
    if (room.players.length < 1) { socket.emit('fh_error', { message: 'No players in room.' }); return; }

    room.lastActionIds = {};
    room.leaveGameVotes.clear();
    room.state = createFlippingHusksGame(
      room.players.map(p => ({ id: p.id, name: p.name })),
      { soundboardEnabled: !!soundboardEnabled }, // host's lobby choice
    );
    fh.to(roomId).emit('fh_game_started', { state: fhClientState(room.state) });
  });

  // `ack` is the client's acknowledgement callback (Socket.IO). The client retries
  // until it fires, so every action carries an `actionId` we use to dedupe a retry
  // that arrives after the original already applied (e.g. the first ack was lost).
  socket.on('fh_action', ({ action, actionId }, ack) => {
    const meta = fhSocketToRoom[socket.id];
    if (!meta) { ack?.({ ok: false, error: 'Not in a room.' }); return; }
    const room = fhRooms[meta.roomId];
    if (!room?.state) { ack?.({ ok: false, error: 'Game not started.' }); return; }

    // Idempotency: a retry of an already-applied action must not run twice.
    if (actionId && room.lastActionIds[meta.playerId] === actionId) {
      socket.emit('fh_state_update', { state: fhClientState(room.state) });
      ack?.({ ok: true, duplicate: true });
      return;
    }

    const result = applyFlippingHusksAction(room.state, meta.playerId, action);
    if (!result.ok) {
      socket.emit('fh_action_rejected', { error: result.error });
      ack?.({ ok: false, error: result.error });
      return;
    }

    if (actionId) room.lastActionIds[meta.playerId] = actionId;
    room.state = result.state;
    fh.to(meta.roomId).emit('fh_state_update', { state: fhClientState(room.state) });

    // The round just ended → kick off the shared auto-advance countdown.
    if (room.state.phase === 'round_end' && !room.nextRoundTimer) {
      scheduleNextRound(meta.roomId);
    }
    ack?.({ ok: true });
  });

  socket.on('fh_next_round_vote', () => {
    const meta = fhSocketToRoom[socket.id];
    if (!meta) return;
    const room = fhRooms[meta.roomId];
    if (!room?.state || room.state.phase !== 'round_end') return;

    room.nextRoundVotes.add(meta.playerId);

    fh.to(meta.roomId).emit('fh_next_round_update', {
      votes: [...room.nextRoundVotes],
      players: roster(room),
    });

    // Everyone still online readied up → skip the countdown and advance now.
    if (room.nextRoundVotes.size >= connectedCount(room)) {
      advanceToNextRound(meta.roomId);
    }
  });

  socket.on('fh_play_again', () => {
    const meta = fhSocketToRoom[socket.id];
    if (!meta) return;
    const room = fhRooms[meta.roomId];
    if (!room?.state || room.state.phase !== 'finished') return;

    room.playAgainVotes.add(meta.playerId);

    fh.to(meta.roomId).emit('fh_play_again_update', {
      votes: [...room.playAgainVotes],
      players: roster(room),
    });

    if (room.playAgainVotes.size >= connectedCount(room)) {
      room.playAgainVotes.clear();
      room.leaveGameVotes.clear();
      room.lastActionIds = {};
      resetFlippingHusksGame(room.state);
      fh.to(meta.roomId).emit('fh_state_update', { state: fhClientState(room.state) });
    }
  });

  // Vote to leave the game (and tear the room down if everyone agrees). `leaving`
  // false withdraws a previously-cast vote (the player closed the modal).
  socket.on('fh_leave_vote', ({ leaving } = {}) => {
    const meta = fhSocketToRoom[socket.id];
    if (!meta) return;
    const room = fhRooms[meta.roomId];
    if (!room?.state) return;
    if (!room.leaveGameVotes) room.leaveGameVotes = new Set();

    if (leaving) room.leaveGameVotes.add(meta.playerId);
    else room.leaveGameVotes.delete(meta.playerId);

    fh.to(meta.roomId).emit('fh_leave_update', {
      votes: [...room.leaveGameVotes],
      players: roster(room),
    });

    maybeCloseRoomOnLeave(meta.roomId);
  });

  // Soundboard: a player spends SP to play a sound that EVERYONE in the room hears.
  // Only one sound may play across the whole room at a time (a global lock), and the
  // player needs at least SOUND_COST SP. On success we deduct the SP, engage the lock,
  // broadcast the sound to everyone (including the player, so they hear it too), and
  // push the updated state so SP counters refresh.
  socket.on('fh_play_sound', ({ emote } = {}) => {
    const meta = fhSocketToRoom[socket.id];
    if (!meta) return;
    const room = fhRooms[meta.roomId];
    if (!room?.state) return;
    if (!room.state.soundboardEnabled) return;   // host disabled the Soundboard this game
    if (room.soundLock != null) return;          // a sound is already playing
    if (!FH_EMOTES.has(emote)) return;
    const player = room.state.players[meta.playerId];
    if (!player || player.sp < SOUND_COST) return; // can't afford it

    const sound = randomSoundUrl(emote);
    if (!sound) return; // no clips available for this emote — don't charge or lock

    player.sp -= SOUND_COST;
    room.soundLock = meta.playerId;
    fh.to(meta.roomId).emit('fh_sound', { sound, playerId: meta.playerId });
    fh.to(meta.roomId).emit('fh_state_update', { state: fhClientState(room.state) });
    room.soundLockTimer = setTimeout(() => releaseSoundLock(meta.roomId), SOUND_LOCK_MAX_MS);
  });

  // The player who played the current sound reports it has finished → free the lock.
  socket.on('fh_sound_ended', () => {
    const meta = fhSocketToRoom[socket.id];
    if (!meta) return;
    const room = fhRooms[meta.roomId];
    if (room && room.soundLock === meta.playerId) releaseSoundLock(meta.roomId);
  });

  // The STOP button: only the player who STARTED the current sound may cut it short.
  // Tell everyone to halt their local audio, then free the room lock.
  socket.on('fh_stop_sound', () => {
    const meta = fhSocketToRoom[socket.id];
    if (!meta) return;
    const room = fhRooms[meta.roomId];
    if (!room || room.soundLock == null) return;        // nothing is playing
    if (room.soundLock !== meta.playerId) return;       // only the initiator can stop it
    fh.to(meta.roomId).emit('fh_sound_stop');
    releaseSoundLock(meta.roomId);
  });

  // Soundboard cheat: the client unlocked a hidden "+" button (rapid key presses)
  // and pressed it. Just grant the SP — cheating is the whole point — but only to a
  // real player in a running game.
  socket.on('fh_cheat_sp', () => {
    const meta = fhSocketToRoom[socket.id];
    if (!meta) return;
    const room = fhRooms[meta.roomId];
    if (!room?.state) return;
    const player = room.state.players[meta.playerId];
    if (!player) return;
    player.sp += CHEAT_SP_BONUS;
    fh.to(meta.roomId).emit('fh_state_update', { state: fhClientState(room.state) });
  });

  // Leave the room from the lobby ("Back") OR from a FINISHED game's end screen
  // ("Leave"). Leaving an IN-PROGRESS game (playing / round_end) still goes through
  // the unanimous fh_leave_vote path, so we only act here for the lobby or a finished
  // game. Crucially, a finished game must be torn down on leave — otherwise its stale
  // state (including the host's old Soundboard choice) lingers and gets resynced on
  // re-join, so the next lobby start never takes effect.
  socket.on('fh_leave_room', () => {
    const meta = fhSocketToRoom[socket.id];
    if (!meta) return;
    const room = fhRooms[meta.roomId];
    if (!room) return;
    if (room.state && room.state.phase !== 'finished') return; // in-progress → use the vote

    const wasHost = room.hostId === meta.playerId;
    room.players = room.players.filter(p => p.id !== meta.playerId);
    room.playAgainVotes.delete(meta.playerId);
    room.nextRoundVotes.delete(meta.playerId);
    room.leaveGameVotes?.delete(meta.playerId);

    // Finished game: also drop the leaver from the game state so a remaining player's
    // "Play Again" stays consistent.
    if (room.state) {
      delete room.state.players[meta.playerId];
      room.state.playerOrder = room.state.playerOrder.filter(id => id !== meta.playerId);
    }

    delete fhSocketToRoom[socket.id];
    socket.leave(meta.roomId);

    if (room.players.length === 0) {
      // Last one out → drop the whole room (and its finished state) so the next join
      // builds a brand-new room and lobby.
      clearNextRoundTimer(room);
      cancelRoomCleanup(room);
      if (room.soundLockTimer) clearTimeout(room.soundLockTimer);
      delete fhRooms[meta.roomId];
    } else {
      if (wasHost) room.hostId = room.players[0].id;
      fh.to(meta.roomId).emit('fh_room_update', { players: roster(room), hostId: room.hostId });
      if (room.state) fh.to(meta.roomId).emit('fh_state_update', { state: fhClientState(room.state) });
    }
  });

  socket.on('disconnect', () => {
    const meta = fhSocketToRoom[socket.id];
    delete fhSocketToRoom[socket.id];
    console.log('[FlippingHusks] Disconnected:', socket.id);
    if (!meta) return;
    const room = fhRooms[meta.roomId];
    if (!room) return;

    const player = room.players.find(p => p.id === meta.playerId);
    // Ignore a stale socket whose player already reconnected on a newer socket.
    if (player && player.socketId !== socket.id) return;

    if (room.state) {
      // Game in progress → keep the player in the game (state stays valid) and
      // just mark them offline; they resume by reconnecting.
      if (player) player.connected = false;
      fh.to(meta.roomId).emit('fh_room_update', { players: roster(room), hostId: room.hostId });

      // Drop any leave-game vote the now-offline player held, then re-check whether
      // the remaining online players are unanimous (which would close the room).
      if (room.leaveGameVotes?.delete(meta.playerId)) {
        fh.to(meta.roomId).emit('fh_leave_update', {
          votes: [...room.leaveGameVotes], players: roster(room),
        });
      }
      maybeCloseRoomOnLeave(meta.roomId);
      if (!fhRooms[meta.roomId]) return; // room was just closed

      // Online players may now be unanimous on next round → advance.
      if (room.state.phase === 'round_end'
          && room.nextRoundVotes.size > 0
          && room.nextRoundVotes.size >= connectedCount(room)) {
        advanceToNextRound(meta.roomId);
      }
      if (connectedCount(room) === 0) scheduleRoomCleanup(meta.roomId);
      return;
    }

    // Still in the lobby → drop them from the roster as before.
    room.players = room.players.filter(p => p.id !== meta.playerId);
    room.playAgainVotes.delete(meta.playerId);
    room.nextRoundVotes.delete(meta.playerId);
    if (room.players.length === 0) {
      clearNextRoundTimer(room);
      cancelRoomCleanup(room);
      delete fhRooms[meta.roomId];
    } else {
      if (room.hostId === meta.playerId) room.hostId = room.players[0].id;
      fh.to(meta.roomId).emit('fh_room_update', { players: roster(room), hostId: room.hostId });
    }
  });
});

// Strip server-only discardPile array; send just the count + reshuffleEvent to clients
function fhClientState(state) {
  const { discardPile, ...rest } = state;
  return { ...rest, discardCount: (discardPile || []).length };
}

// ── Discord Activity OAuth token exchange ──────────────────────────────────────
// The embedded client gets a short-lived authorization code, then calls this to
// trade it for an access token. The client secret stays here, never shipped to
// the browser. Requires env: DISCORD_CLIENT_SECRET and a client id (we reuse the
// build-time REACT_APP_DISCORD_CLIENT_ID, which Render also exposes at runtime).
const DISCORD_CLIENT_ID     = process.env.DISCORD_CLIENT_ID || process.env.REACT_APP_DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

// Render free-tier's shared datacenter IP is rate-limited by Discord's Cloudflare
// (429 / "error code: 1015"). When DISCORD_TOKEN_PROXY_URL is set we forward the
// code to a Cloudflare Worker, which does the discord.com call from a clean egress
// IP and holds the client secret. The optional shared secret stops randoms from
// using our Worker as an open token-exchange relay.
const DISCORD_TOKEN_PROXY_URL    = process.env.DISCORD_TOKEN_PROXY_URL;
const DISCORD_TOKEN_PROXY_SECRET = process.env.DISCORD_TOKEN_PROXY_SECRET;

// Minimal JSON POST over the https module (matches the no-global-fetch approach
// used for the direct Discord call). Resolves { status, data, raw }.
function postJson(urlString, payload, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString);
    const body = JSON.stringify(payload);
    const request = https.request(
      {
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...extraHeaders,
        },
      },
      (response) => {
        let raw = '';
        response.on('data', (chunk) => { raw += chunk; });
        response.on('end', () => {
          let data = null;
          try { data = JSON.parse(raw); } catch { /* non-JSON body */ }
          resolve({ status: response.statusCode, data, raw });
        });
      },
    );
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

// POST the OAuth code to Discord using the built-in https module (no dependency on
// a global fetch, which isn't present on older Node runtimes). Resolves with the
// parsed JSON body and HTTP status.
function discordTokenExchange(code) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      client_secret: DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
    }).toString();

    const request = https.request(
      {
        hostname: 'discord.com',
        path: '/api/oauth2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
          // Discord's API sits behind Cloudflare. A non-browser User-Agent from a
          // datacenter IP gets aggressively rate-limited (429 / "error code: 1015"),
          // so we present a normal browser UA to look less like a bot.
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json',
        },
      },
      (response) => {
        let raw = '';
        response.on('data', (chunk) => { raw += chunk; });
        response.on('end', () => {
          let data = null;
          try { data = JSON.parse(raw); } catch { /* non-JSON body */ }
          resolve({ status: response.statusCode, data, raw });
        });
      },
    );
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A 429 is Cloudflare rejecting us at the edge BEFORE Discord's OAuth backend runs,
// so the single-use code is NOT consumed and the same code can be safely retried.
// Back off and retry a few times to ride out a transient rate-limit window.
async function discordTokenExchangeWithRetry(code, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i++) {
    last = await discordTokenExchange(code);
    if (last.status !== 429) return last;
    if (i < attempts - 1) await sleep(500 * 2 ** i); // 500ms, then 1s
  }
  return last;
}

app.post('/api/token', async (req, res) => {
  if (!req.body?.code) {
    return res.status(400).json({ error: 'Missing authorization code.' });
  }

  // Preferred path: relay through the Cloudflare Worker (clean IP). The Worker
  // returns the final response shape, so we pass its status + body straight back.
  if (DISCORD_TOKEN_PROXY_URL) {
    try {
      const { status, data } = await postJson(
        DISCORD_TOKEN_PROXY_URL,
        { code: req.body.code },
        DISCORD_TOKEN_PROXY_SECRET ? { 'x-proxy-secret': DISCORD_TOKEN_PROXY_SECRET } : {},
      );
      if (status !== 200 || !data?.access_token) {
        console.error('[Discord] Proxy token exchange failed:', status, data);
      }
      return res.status(status || 502).json(data ?? { error: 'Proxy returned no body.' });
    } catch (err) {
      console.error('[Discord] Proxy token exchange error:', err);
      return res.status(502).json({ error: 'Proxy token exchange error.' });
    }
  }

  // Fallback path: call Discord directly from this server (needs creds here).
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Discord credentials not configured on the server.' });
  }
  try {
    const { status, data, raw } = await discordTokenExchangeWithRetry(req.body.code);
    if (status !== 200 || !data?.access_token) {
      console.error('[Discord] Token exchange failed:', status, data ?? raw);
      // Surface Discord's own status + error so failures are diagnosable from the
      // client (network tab) without needing server log access. `data.error` /
      // `error_description` are Discord's OAuth error fields (e.g. invalid_client).
      return res.status(502).json({
        error: 'Token exchange failed.',
        discordStatus: status,
        discordError: data?.error ?? null,
        discordErrorDescription: data?.error_description ?? (data ? null : raw?.slice(0, 200)),
      });
    }
    res.json({ access_token: data.access_token });
  } catch (err) {
    console.error('[Discord] Token exchange error:', err);
    res.status(500).json({ error: 'Token exchange error.' });
  }
});

// Serve the React production build when it exists (i.e. when deployed)
const buildDir = path.join(__dirname, '../build');
if (fs.existsSync(buildDir)) {
  // Hashed assets (e.g. /static/js/main.<hash>.js) are immutable — cache them hard.
  // index.html must NEVER be cached: the Discord Activity proxy (and browsers) can
  // otherwise pin an old index.html that references asset hashes Render no longer
  // has. The missing asset then falls through to the SPA fallback below and comes
  // back as HTML, which the browser tries to parse as JS →
  // "Uncaught SyntaxError: Unexpected token '<'". no-store prevents that.
  app.use(express.static(buildDir, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(`${path.sep}index.html`)) {
        res.setHeader('Cache-Control', 'no-store');
      }
    },
  }));

  // SPA fallback for client-side routes only. A request for a missing static asset
  // or an /api route must 404 honestly rather than be served index.html (which is
  // what produced the "Unexpected token '<'" failure inside Discord).
  app.get('*', (req, res) => {
    if (req.path.startsWith('/static/') || req.path.startsWith('/api/') || path.extname(req.path)) {
      return res.status(404).send('Not found');
    }
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(buildDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Game server running on port ${PORT}`));
