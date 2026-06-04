import { useCallback, useEffect, useState } from 'react';
import { useSocket } from './useSocket';

export function useGame() {
  const { connected, emit, on, off } = useSocket();
  const [gameState, setGameState] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [roomPlayers, setRoomPlayers] = useState([]);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    const handlers = {
      joined_room: ({ playerId: pid }) => setPlayerId(pid),
      room_update: ({ players }) => setRoomPlayers(players),
      game_started: ({ state }) => { setGameState(state); setError(null); },
      state_update: ({ state }) => { setGameState(state); setActionError(null); },
      action_rejected: ({ error: e }) => setActionError(e),
      error: ({ message }) => setError(message),
    };

    const cleanups = Object.entries(handlers).map(([event, handler]) => on(event, handler));
    return () => cleanups.forEach(fn => fn());
  }, [on]);

  const joinRoom = useCallback((roomId, playerName, deckName) => {
    emit('join_room', { roomId, playerName, deckName });
  }, [emit]);

  const sendAction = useCallback((action) => {
    setActionError(null);
    emit('game_action', { action });
  }, [emit]);

  const opponent = gameState
    ? Object.values(gameState.players).find(p => p.id !== playerId)
    : null;

  const self = gameState ? gameState.players[playerId] : null;
  const isMyTurn = gameState?.activePlayerId === playerId;
  const hasPriority = gameState?.priorityPlayerId === playerId;

  return {
    connected,
    gameState,
    playerId,
    self,
    opponent,
    roomPlayers,
    isMyTurn,
    hasPriority,
    error,
    actionError,
    joinRoom,
    sendAction,
  };
}
