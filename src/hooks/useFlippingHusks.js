import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = process.env.NODE_ENV === 'production'
  ? `${window.location.origin}/flippinghusks`
  : 'http://localhost:3001/flippinghusks';

export function useFlippingHusks() {
  const socketRef    = useRef(null);
  const prevStateRef = useRef(null); // last-seen state, used to diff for animations
  const [connected, setConnected]     = useState(false);
  const [playerId, setPlayerId]       = useState(null);
  const [isHost, setIsHost]           = useState(false);
  const [roomPlayers, setRoomPlayers] = useState([]);
  const [hostId, setHostId]           = useState(null);
  const [gameState, setGameState]     = useState(null);
  const [error, setError]             = useState(null);
  const [actionError, setActionError] = useState(null);
  const [animQueue, setAnimQueue]     = useState([]); // [{card,isBust,isFlippingHusks,secondChanceCard?,savedPlayerId?}]
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
      setIsHost(socket.id === hid);
    });
    socket.on('fh_game_started', ({ state }) => {
      prevStateRef.current = state;
      setGameState(state);
      setError(null);
      setPlayAgainVotes({ votes: [], players: [] });
      setAnimQueue([]);
    });
    socket.on('fh_state_update', ({ state }) => {
      const prev = prevStateRef.current;

      // Play-again reset: wipe queue so no stale animations bleed into next game
      if (prev?.phase === 'finished' && state.phase === 'playing') {
        setPlayAgainVotes({ votes: [], players: [] });
        setAnimQueue([]);
        prevStateRef.current = state;
        setGameState(state);
        setActionError(null);
        return;
      }

      const newAnims = buildAnimQueue(prev, state);
      prevStateRef.current = state;
      setGameState(state);
      if (newAnims.length > 0) {
        setAnimQueue(q => [...q, ...newAnims]);
      }
      setActionError(null);
    });
    socket.on('fh_play_again_update', ({ votes, players }) => {
      setPlayAgainVotes({ votes, players });
    });
    socket.on('fh_action_rejected', ({ error: e }) => setActionError(e));
    socket.on('fh_error',          ({ message })   => setError(message));

    socket.connect();
    return () => socket.disconnect();
  }, []);

  const joinRoom      = useCallback((roomId, name) => socketRef.current?.emit('fh_join',    { roomId, playerName: name }), []);
  const startGame     = useCallback((roomId)       => socketRef.current?.emit('fh_start',   { roomId }), []);
  const sendAction    = useCallback((action)       => { setActionError(null); socketRef.current?.emit('fh_action', { action }); }, []);
  const advanceAnim   = useCallback(() => setAnimQueue(q => q.slice(1)), []);
  const clearAnimQueue = useCallback(() => setAnimQueue([]), []);
  const votePlayAgain  = useCallback(() => socketRef.current?.emit('fh_play_again'), []);

  const isMyTurn = gameState?.activePlayerId === playerId;
  const self     = gameState ? gameState.players[playerId] : null;

  return {
    connected, playerId, isHost, hostId,
    roomPlayers, gameState,
    isMyTurn, self,
    error, actionError,
    animQueue, advanceAnim, clearAnimQueue,
    playAgainVotes, votePlayAgain,
    joinRoom, startGame, sendAction,
  };
}

// Builds the ordered list of draw animations for one state transition.
//
// Deck reshuffle       → [{ type:'reshuffle' }, ...other animations]
//   Prepended whenever reshuffleEvent is set, so it always plays first.
// Freeze/Flip3 drawn   → [{ pa.card }]  (card lives in pendingAction, not in hand)
// Normal draw          → [{ card, isBust, isFlippingHusks }]
// flip_three resolved  → [{ draw1 }, { draw2 }, { draw3 }, ...]
//   pa.card is skipped for ALL pendingAction types on resolution — it was already
//   animated when it was drawn, so we don't animate it a second time here.
// second chance        → appended as { card: drawnCard, secondChanceCard, savedPlayerId }
//   (appended at the end so it composites correctly with any preceding forced draws)
function buildAnimQueue(prevState, newState) {
  if (!prevState || !newState) return [];

  // A pendingAction was just created: the Freeze/Flip3 card is in pendingAction.card,
  // not in any player's hand, so the card-diff loop below won't find it.
  // Animate it here, then let the modal appear once the animation finishes.
  if (newState.pendingAction && !prevState.pendingAction) {
    const result = [];
    if (newState.reshuffleEvent) result.push({ type: 'reshuffle' });
    result.push({ card: newState.pendingAction.card, isBust: false, isFlippingHusks: false });
    return result;
  }

  // A pendingAction was just resolved: pa.card has been placed into the target's hand.
  // Skip it — it was already animated when it was drawn; only animate forced draws.
  const paCardId = prevState.pendingAction ? prevState.pendingAction.card.id : null;

  const result = [];
  if (newState.reshuffleEvent) result.push({ type: 'reshuffle' });

  for (const pid of newState.playerOrder) {
    const prevCards = prevState.players[pid]?.cards ?? [];
    const newCards  = newState.players[pid]?.cards ?? [];
    if (newCards.length <= prevCards.length) continue;
    const prevIds = new Set(prevCards.map(c => c.id));
    let added = newCards.filter(c => !prevIds.has(c.id));
    if (paCardId) added = added.filter(c => c.id !== paCardId);
    if (added.length === 0) continue;

    const nowBusted = newState.players[pid].status === 'busted'
      && prevState.players[pid]?.status !== 'busted';
    const nowFH = newState.players[pid].status === 'flippinghusks'
      && prevState.players[pid]?.status !== 'flippinghusks';

    for (let i = 0; i < added.length; i++) {
      result.push({
        card: added[i],
        // bust / FH only fire on the last card, and not if SC saved the player
        isBust:          i === added.length - 1 && nowBusted && !newState.secondChanceEvent,
        isFlippingHusks: i === added.length - 1 && nowFH,
      });
    }
    break; // one player gains cards per action
  }

  // Second-chance: the duplicate was rejected (not added to hand) and the SC
  // card was removed, so it shows up as a net-negative diff. Append it after
  // any other animations so mid-sequence SC during flip_three is handled.
  if (newState.secondChanceEvent) {
    const { playerId: savedPlayerId, drawnCard, savedCard } = newState.secondChanceEvent;
    result.push({
      card: drawnCard,
      isBust: false,
      isFlippingHusks: false,
      secondChanceCard: savedCard,
      savedPlayerId,
    });
  }

  return result;
}
