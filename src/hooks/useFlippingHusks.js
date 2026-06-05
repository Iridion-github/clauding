import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.NODE_ENV === 'production'
  ? `${window.location.origin}/flippinghusks`
  : 'http://localhost:3001/flippinghusks';

export function useFlippingHusks() {
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
  const [playAgainVotes, setPlayAgainVotes] = useState({ votes: [], players: [] });

  useEffect(() => {
    const socket = io(SERVER_URL, { autoConnect: false });
    socketRef.current = socket;

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('fh_joined', ({ playerId: pid, isHost: h }) => {
      setPlayerId(pid);
      setIsHost(h);
    });
    socket.on('fh_room_update', ({ players, hostId: hid }) => {
      setRoomPlayers(players);
      setHostId(hid);
    });
    socket.on('fh_game_started',  ({ state }) => { setGameState(state); setError(null); setPlayAgainVotes({ votes: [], players: [] }); });
    socket.on('fh_state_update',  ({ state }) => {
      setGameState(prev => {
        if (prev?.phase === 'finished' && state.phase === 'playing') {
          setPlayAgainVotes({ votes: [], players: [] });
          return state;
        }
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
    socket.on('fh_play_again_update', ({ votes, players }) => {
      setPlayAgainVotes({ votes, players });
    });
    socket.on('fh_action_rejected', ({ error: e }) => setActionError(e));
    socket.on('fh_error',         ({ message }) => setError(message));
    socket.on('fh_player_left',   ({ playerId: pid }) => {
      setRoomPlayers(prev => prev.filter(p => p.id !== pid));
    });

    socket.connect();
    return () => socket.disconnect();
  }, []);

  const joinRoom  = useCallback((roomId, name) => socketRef.current?.emit('fh_join',   { roomId, playerName: name }), []);
  const startGame = useCallback((roomId)        => socketRef.current?.emit('fh_start',  { roomId }), []);
  const sendAction = useCallback((action)       => { setActionError(null); socketRef.current?.emit('fh_action', { action }); }, []);
  const clearDrawnCardAnim = useCallback(() => setDrawnCardAnim(null), []);
  const votePlayAgain = useCallback(() => socketRef.current?.emit('fh_play_again'), []);

  const isMyTurn = gameState?.activePlayerId === playerId;
  const self     = gameState ? gameState.players[playerId] : null;

  return {
    connected, playerId, isHost, hostId,
    roomPlayers, gameState,
    isMyTurn, self,
    error, actionError,
    drawnCardAnim, clearDrawnCardAnim,
    playAgainVotes, votePlayAgain,
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
    const isBust          = newState.players[pid].status === 'busted'        && prevState.players[pid]?.status !== 'busted';
    const isFlippingHusks = newState.players[pid].status === 'flippinghusks' && prevState.players[pid]?.status !== 'flippinghusks';
    return { card, isBust, isFlippingHusks };
  }
  return null;
}
