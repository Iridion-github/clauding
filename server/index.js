const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs   = require('fs');
const path = require('path');
const { createGameState } = require('./game/GameState');
const { applyAction } = require('./game/GameEngine');
const { buildDeck } = require('./game/Cards');
const { createGame: createFlip7Game } = require('./flip7/GameState');
const { applyAction: applyFlip7Action } = require('./flip7/GameEngine');

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

// ── Flip 7 namespace ────────────────────────────────────────────────────────
// f7Rooms: { roomId: { hostId, players:[{socketId,id,name}], state } }
const f7Rooms = {};
const f7SocketToRoom = {};

const f7 = io.of('/flip7');

f7.on('connection', (socket) => {
  console.log('[Flip7] Connected:', socket.id);

  socket.on('f7_join', ({ roomId, playerName }) => {
    if (!f7Rooms[roomId]) {
      f7Rooms[roomId] = { hostId: socket.id, players: [], state: null };
    }
    const room = f7Rooms[roomId];

    if (room.state) { socket.emit('f7_error', { message: 'Game already started.' }); return; }
    if (room.players.length >= 6) { socket.emit('f7_error', { message: 'Room is full (max 6).' }); return; }
    if (room.players.find(p => p.socketId === socket.id)) { socket.emit('f7_error', { message: 'Already in room.' }); return; }

    room.players.push({ socketId: socket.id, id: socket.id, name: playerName });
    f7SocketToRoom[socket.id] = { roomId, playerId: socket.id };
    socket.join(roomId);

    socket.emit('f7_joined', { roomId, playerId: socket.id, isHost: room.hostId === socket.id });
    f7.to(roomId).emit('f7_room_update', {
      players: room.players.map(p => ({ id: p.id, name: p.name })),
      hostId: room.hostId,
    });
  });

  socket.on('f7_start', ({ roomId }) => {
    const room = f7Rooms[roomId];
    if (!room) { socket.emit('f7_error', { message: 'Room not found.' }); return; }
    if (room.hostId !== socket.id) { socket.emit('f7_error', { message: 'Only the host can start.' }); return; }
    if (room.players.length < 2) { socket.emit('f7_error', { message: 'Need at least 2 players.' }); return; }

    room.state = createFlip7Game(room.players.map(p => ({ id: p.id, name: p.name })));
    f7.to(roomId).emit('f7_game_started', { state: room.state });
  });

  socket.on('f7_action', ({ action }) => {
    const meta = f7SocketToRoom[socket.id];
    if (!meta) { socket.emit('f7_error', { message: 'Not in a room.' }); return; }
    const room = f7Rooms[meta.roomId];
    if (!room?.state) { socket.emit('f7_error', { message: 'Game not started.' }); return; }

    const result = applyFlip7Action(room.state, meta.playerId, action);
    if (!result.ok) { socket.emit('f7_action_rejected', { error: result.error }); return; }

    room.state = result.state;
    f7.to(meta.roomId).emit('f7_state_update', { state: room.state });
  });

  socket.on('disconnect', () => {
    const meta = f7SocketToRoom[socket.id];
    if (meta) {
      const room = f7Rooms[meta.roomId];
      if (room) {
        room.players = room.players.filter(p => p.socketId !== socket.id);
        f7.to(meta.roomId).emit('f7_player_left', { playerId: meta.playerId });
        if (room.players.length === 0) delete f7Rooms[meta.roomId];
      }
      delete f7SocketToRoom[socket.id];
    }
    console.log('[Flip7] Disconnected:', socket.id);
  });
});

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
