import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.NODE_ENV === 'production'
  ? `${window.location.origin}/flip7`
  : 'http://localhost:3001/flip7';

export function useFlip7() {
  const socketRef = useRef(null);
  const [connected, setConnected]     = useState(false);
  const [playerId, setPlayerId]       = useState(null);
  const [isHost, setIsHost]           = useState(false);
  const [roomPlayers, setRoomPlayers] = useState([]);
  const [hostId, setHostId]           = useState(null);
  const [gameState, setGameState]     = useState(null);
  const [error, setError]             = useState(null);
  const [actionError, setActionError] = useState(null);
  const [drawnCardAnim, setDrawnCardAnim] = useState(null); // { card, isBust, secondChanceCard?, savedPlayerId? } | null

  useEffect(() => {
    const socket = io(SERVER_URL, { autoConnect: false });
    socketRef.current = socket;

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('f7_joined', ({ playerId: pid, isHost: h }) => {
      setPlayerId(pid);
      setIsHost(h);
    });
    socket.on('f7_room_update', ({ players, hostId: hid }) => {
      setRoomPlayers(players);
      setHostId(hid);
    });
    socket.on('f7_game_started',  ({ state }) => { setGameState(state); setError(null); });
    socket.on('f7_state_update',  ({ state }) => {
      setGameState(prev => {
        let drawn = null;
        if (state.secondChanceEvent) {
          const { playerId: savedPlayerId, drawnCard, savedCard } = state.secondChanceEvent;
          drawn = { card: drawnCard, isBust: false, secondChanceCard: savedCard, savedPlayerId };
        } else {
          drawn = detectDrawnCard(prev, state);
        }
        if (drawn) setDrawnCardAnim(drawn);
        return state;
      });
      setActionError(null);
    });
    socket.on('f7_action_rejected', ({ error: e }) => setActionError(e));
    socket.on('f7_error',         ({ message }) => setError(message));
    socket.on('f7_player_left',   ({ playerId: pid }) => {
      setRoomPlayers(prev => prev.filter(p => p.id !== pid));
    });

    socket.connect();
    return () => socket.disconnect();
  }, []);

  const joinRoom  = useCallback((roomId, name) => socketRef.current?.emit('f7_join',   { roomId, playerName: name }), []);
  const startGame = useCallback((roomId)        => socketRef.current?.emit('f7_start',  { roomId }), []);
  const sendAction = useCallback((action)       => { setActionError(null); socketRef.current?.emit('f7_action', { action }); }, []);
  const clearDrawnCardAnim = useCallback(() => setDrawnCardAnim(null), []);

  const isMyTurn = gameState?.activePlayerId === playerId;
  const self     = gameState ? gameState.players[playerId] : null;

  return {
    connected, playerId, isHost, hostId,
    roomPlayers, gameState,
    isMyTurn, self,
    error, actionError,
    drawnCardAnim, clearDrawnCardAnim,
    joinRoom, startGame, sendAction,
  };
}

function detectDrawnCard(prevState, newState) {
  if (!prevState || !newState) return null;
  for (const pid of newState.playerOrder) {
    const prevCards = prevState.players[pid]?.cards ?? [];
    const newCards  = newState.players[pid]?.cards ?? [];
    if (newCards.length <= prevCards.length) continue;
    const prevIds = new Set(prevCards.map(c => c.id));
    const added   = newCards.filter(c => !prevIds.has(c.id));
    if (added.length === 0) continue;
    const card   = added[added.length - 1];
    const isBust = newState.players[pid].status === 'busted' &&
                   prevState.players[pid]?.status !== 'busted';
    return { card, isBust };
  }
  return null;
}
