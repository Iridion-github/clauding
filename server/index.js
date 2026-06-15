const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs   = require('fs');
const path = require('path');
const { createGameState } = require('./game/GameState');
const { applyAction } = require('./game/GameEngine');
const { buildDeck } = require('./game/Cards');
const { createGame: createFlippingHusksGame, resetGame: resetFlippingHusksGame } = require('./flippinghusks/GameState');
const { applyAction: applyFlippingHusksAction } = require('./flippinghusks/GameEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// rooms: { roomId: { players: [{id, name, color}], state } }
const rooms = {};
// socketToRoom: { socketId: { roomId, playerId } }
const socketToRoom = {};

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // Join or create a room
  socket.on('join_room', ({ roomId, playerName, deckName }) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { players: [], state: null };
    }
    const room = rooms[roomId];

    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full.' });
      return;
    }

    const alreadyIn = room.players.find(p => p.socketId === socket.id);
    if (alreadyIn) {
      socket.emit('error', { message: 'Already in room.' });
      return;
    }

    const playerId = socket.id;
    room.players.push({ socketId: socket.id, id: playerId, name: playerName, deckName: deckName || 'mono_red' });
    socketToRoom[socket.id] = { roomId, playerId };
    socket.join(roomId);

    socket.emit('joined_room', { roomId, playerId });
    io.to(roomId).emit('room_update', { players: room.players.map(p => ({ id: p.id, name: p.name })) });

    // Start game when both players are in
    if (room.players.length === 2) {
      const [p1, p2] = room.players;
      room.state = createGameState(
        p1.id, p1.name, buildDeck(p1.deckName),
        p2.id, p2.name, buildDeck(p2.deckName),
      );
      io.to(roomId).emit('game_started', { state: sanitizeState(room.state) });
    }
  });

  socket.on('game_action', ({ action }) => {
    const meta = socketToRoom[socket.id];
    if (!meta) { socket.emit('error', { message: 'Not in a room.' }); return; }

    const room = rooms[meta.roomId];
    if (!room || !room.state) { socket.emit('error', { message: 'Game not started.' }); return; }

    const result = applyAction(room.state, meta.playerId, action);
    if (!result.ok) {
      socket.emit('action_rejected', { error: result.error });
      return;
    }

    room.state = result.state;
    io.to(meta.roomId).emit('state_update', { state: sanitizeState(room.state) });
  });

  socket.on('disconnect', () => {
    const meta = socketToRoom[socket.id];
    if (meta) {
      const room = rooms[meta.roomId];
      if (room) {
        room.players = room.players.filter(p => p.socketId !== socket.id);
        io.to(meta.roomId).emit('player_disconnected', { playerId: meta.playerId });
        if (room.players.length === 0) delete rooms[meta.roomId];
      }
      delete socketToRoom[socket.id];
    }
    console.log('Disconnected:', socket.id);
  });
});

// Hide opponent's hand and library contents from each player's state view
function sanitizeState(state) {
  return state; // Full state for now; add per-player views when needed
}

// ── Flipping Husks namespace ────────────────────────────────────────────────────────
// fhRooms: { roomId: { hostId, players:[{socketId,id,name}], state } }
const fhRooms = {};
const fhSocketToRoom = {};

const fh = io.of('/flippinghusks');

// When a round ends, every player no longer has to press "Next Round" for the
// game to continue: a shared countdown auto-advances the round. All clients get
// the same absolute `deadline` so they can render a synchronized countdown bar.
const NEXT_ROUND_COUNTDOWN_MS = 10000;

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

fh.on('connection', (socket) => {
  console.log('[FlippingHusks] Connected:', socket.id);

  socket.on('fh_join', ({ roomId, playerName }) => {
    if (!fhRooms[roomId]) {
      fhRooms[roomId] = { hostId: socket.id, players: [], state: null, playAgainVotes: new Set(), nextRoundVotes: new Set(), nextRoundTimer: null, nextRoundDeadline: null };
    }
    const room = fhRooms[roomId];

    if (room.state) { socket.emit('fh_error', { message: 'Game already started.' }); return; }
    if (room.players.length >= 6) { socket.emit('fh_error', { message: 'Room is full (max 6).' }); return; }
    if (room.players.find(p => p.socketId === socket.id)) { socket.emit('fh_error', { message: 'Already in room.' }); return; }

    room.players.push({ socketId: socket.id, id: socket.id, name: playerName });
    fhSocketToRoom[socket.id] = { roomId, playerId: socket.id };
    socket.join(roomId);

    socket.emit('fh_joined', { roomId, playerId: socket.id, isHost: room.hostId === socket.id });
    fh.to(roomId).emit('fh_room_update', {
      players: room.players.map(p => ({ id: p.id, name: p.name })),
      hostId: room.hostId,
    });
  });

  socket.on('fh_start', ({ roomId }) => {
    const room = fhRooms[roomId];
    if (!room) { socket.emit('fh_error', { message: 'Room not found.' }); return; }
    if (room.hostId !== socket.id) { socket.emit('fh_error', { message: 'Only the host can start.' }); return; }
    if (room.players.length < 1) { socket.emit('fh_error', { message: 'No players in room.' }); return; }

    room.state = createFlippingHusksGame(room.players.map(p => ({ id: p.id, name: p.name })));
    fh.to(roomId).emit('fh_game_started', { state: fhClientState(room.state) });
  });

  socket.on('fh_action', ({ action }) => {
    const meta = fhSocketToRoom[socket.id];
    if (!meta) { socket.emit('fh_error', { message: 'Not in a room.' }); return; }
    const room = fhRooms[meta.roomId];
    if (!room?.state) { socket.emit('fh_error', { message: 'Game not started.' }); return; }

    const result = applyFlippingHusksAction(room.state, meta.playerId, action);
    if (!result.ok) { socket.emit('fh_action_rejected', { error: result.error }); return; }

    room.state = result.state;
    fh.to(meta.roomId).emit('fh_state_update', { state: fhClientState(room.state) });

    // The round just ended → kick off the shared auto-advance countdown.
    if (room.state.phase === 'round_end' && !room.nextRoundTimer) {
      scheduleNextRound(meta.roomId);
    }
  });

  socket.on('fh_next_round_vote', () => {
    const meta = fhSocketToRoom[socket.id];
    if (!meta) return;
    const room = fhRooms[meta.roomId];
    if (!room?.state || room.state.phase !== 'round_end') return;

    room.nextRoundVotes.add(meta.playerId);

    fh.to(meta.roomId).emit('fh_next_round_update', {
      votes: [...room.nextRoundVotes],
      players: room.players.map(p => ({ id: p.id, name: p.name })),
    });

    // Everyone readied up → skip the countdown and advance immediately.
    if (room.nextRoundVotes.size >= room.players.length) {
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
      players: room.players.map(p => ({ id: p.id, name: p.name })),
    });

    if (room.playAgainVotes.size >= room.players.length) {
      room.playAgainVotes.clear();
      resetFlippingHusksGame(room.state);
      fh.to(meta.roomId).emit('fh_state_update', { state: fhClientState(room.state) });
    }
  });

  socket.on('disconnect', () => {
    const meta = fhSocketToRoom[socket.id];
    if (meta) {
      const room = fhRooms[meta.roomId];
      if (room) {
        room.players = room.players.filter(p => p.socketId !== socket.id);
        room.playAgainVotes.delete(meta.playerId);
        room.nextRoundVotes.delete(meta.playerId);
        if (room.players.length === 0) {
          clearNextRoundTimer(room);
          delete fhRooms[meta.roomId];
        } else {
          if (room.hostId === socket.id) {
            room.hostId = room.players[0].socketId;
          }
          fh.to(meta.roomId).emit('fh_room_update', {
            players: room.players.map(p => ({ id: p.id, name: p.name })),
            hostId: room.hostId,
          });
          // A departure may have made the remaining players unanimous → advance.
          if (room.state?.phase === 'round_end' && room.nextRoundVotes.size >= room.players.length) {
            advanceToNextRound(meta.roomId);
          }
        }
      }
      delete fhSocketToRoom[socket.id];
    }
    console.log('[FlippingHusks] Disconnected:', socket.id);
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
