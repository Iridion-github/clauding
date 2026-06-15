const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs   = require('fs');
const path = require('path');
const { createGame: createFlippingHusksGame, resetGame: resetFlippingHusksGame } = require('./flippinghusks/GameState');
const { applyAction: applyFlippingHusksAction } = require('./flippinghusks/GameEngine');

const app = express();
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
    delete fhRooms[roomId];
    console.log('[FlippingHusks] Room cleaned up (all players offline):', roomId);
  }, ROOM_CLEANUP_MS);
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
        nextRoundTimer: null, nextRoundDeadline: null,
        cleanupTimer: null, lastActionIds: {},
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

  socket.on('fh_start', ({ roomId }) => {
    const room = fhRooms[roomId];
    if (!room) { socket.emit('fh_error', { message: 'Room not found.' }); return; }
    const meta = fhSocketToRoom[socket.id];
    if (!meta || room.hostId !== meta.playerId) { socket.emit('fh_error', { message: 'Only the host can start.' }); return; }
    if (room.players.length < 1) { socket.emit('fh_error', { message: 'No players in room.' }); return; }

    room.lastActionIds = {};
    room.state = createFlippingHusksGame(room.players.map(p => ({ id: p.id, name: p.name })));
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
      room.lastActionIds = {};
      resetFlippingHusksGame(room.state);
      fh.to(meta.roomId).emit('fh_state_update', { state: fhClientState(room.state) });
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

// Serve the React production build when it exists (i.e. when deployed)
const buildDir = path.join(__dirname, '../build');
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.get('*', (req, res) =>
    res.sendFile(path.join(buildDir, 'index.html'))
  );
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Game server running on port ${PORT}`));
