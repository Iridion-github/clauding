import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { playSoundUrl, stopSoundAudio } from '../components/flippinghusks/emotes';

const SERVER_URL = process.env.NODE_ENV === 'production'
  ? `${window.location.origin}/flippinghusks`
  : 'http://localhost:3001/flippinghusks';

const ACTION_RETRY_MS = 2500; // re-send an unacknowledged action every ~2.5s

// A stable PER-TAB identity. Socket ids change on every reconnect, so we key the
// player on this instead — that's what lets a dropped player reconnect and be
// recognized as the SAME player rather than a new one.
//
// Must be sessionStorage, NOT localStorage: localStorage is shared across all
// tabs of a browser, so two tabs would share one id and the server would treat
// the second join as a reconnect of the first — collapsing both into a single
// player (each "alone" in the room). sessionStorage is scoped to one tab and
// still survives socket drops and page refreshes, so reconnection keeps working.
function getPersistentPlayerId() {
  const fresh = () => 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  try {
    let id = sessionStorage.getItem('fh_playerId');
    if (!id) { id = fresh(); sessionStorage.setItem('fh_playerId', id); }
    return id;
  } catch {
    return fresh();
  }
}

export function useFlippingHusks() {
  const socketRef    = useRef(null);
  const prevStateRef = useRef(null); // last-seen state, used to diff for animations
  const clientIdRef  = useRef(getPersistentPlayerId());
  const joinInfoRef  = useRef(null); // { roomId, name } — replayed on every (re)connect
  const sessionRef   = useRef(Math.random().toString(36).slice(2, 8)); // unique per page-load
  const actionSeqRef = useRef(0);
  const pendingActionRef = useRef(null); // { actionId, cancelled, timer } for the retry loop

  const [connected, setConnected]     = useState(false);
  const [playerId, setPlayerId]       = useState(null);
  const [isHost, setIsHost]           = useState(false);
  const [roomPlayers, setRoomPlayers] = useState([]);
  const [hostId, setHostId]           = useState(null);
  const [gameState, setGameState]     = useState(null);
  const [error, setError]             = useState(null);
  const [actionError, setActionError] = useState(null);
  const [animQueue, setAnimQueue]     = useState([]); // [{card,isBust,isFlippingHusks,secondChanceCard?,savedPlayerId?}]
  const [playAgainVotes, setPlayAgainVotes]   = useState({ votes: [], players: [] });
  const [nextRoundVotes, setNextRoundVotes]   = useState({ votes: [], players: [] });
  const [leaveGameVotes, setLeaveGameVotes]   = useState({ votes: [], players: [] });
  const [nextRoundDeadline, setNextRoundDeadline] = useState(null); // epoch ms; null = no countdown
  const [soundPlaying, setSoundPlaying]   = useState(false); // a Soundboard sound is playing somewhere in the room
  const [iStartedSound, setIStartedSound] = useState(false); // the current sound was triggered by THIS player (only they can STOP it)

  useEffect(() => {
    const clientId = clientIdRef.current;
    const socket = io(SERVER_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 2000,    // first reconnect attempt after ~2s
      reconnectionDelayMax: 3000, // subsequent attempts every ~2-3s
      timeout: 8000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      // (Re)join automatically so a reconnecting player resyncs to live state.
      const j = joinInfoRef.current;
      if (j) socket.emit('fh_join', { roomId: j.roomId, playerName: j.name, playerId: clientId });
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('fh_joined', ({ playerId: pid, isHost: h }) => {
      setPlayerId(pid);
      setIsHost(h);
    });
    socket.on('fh_room_update', ({ players, hostId: hid }) => {
      setRoomPlayers(players);
      setHostId(hid);
      setIsHost(clientId === hid);
    });
    socket.on('fh_game_started', ({ state }) => {
      prevStateRef.current = state;
      setGameState(state);
      setError(null);
      setPlayAgainVotes({ votes: [], players: [] });
      setNextRoundVotes({ votes: [], players: [] });
      setLeaveGameVotes({ votes: [], players: [] });
      setNextRoundDeadline(null);
      setAnimQueue([]);
    });

    // Full authoritative state replacement after a reconnect: jump straight to the
    // current state WITHOUT replaying the animations missed while offline.
    socket.on('fh_resync', ({ state, nextRoundDeadline: nrd, nextRoundVotes: nrv, playAgainVotes: pav, leaveGameVotes: lgv }) => {
      prevStateRef.current = state;
      setGameState(state);
      setAnimQueue([]);
      setActionError(null);
      setError(null);
      setSoundPlaying(false);
      setIStartedSound(false);
      setNextRoundDeadline(nrd ?? null);
      if (nrv) setNextRoundVotes(nrv);
      if (pav) setPlayAgainVotes(pav);
      if (lgv) setLeaveGameVotes(lgv);
    });

    socket.on('fh_state_update', ({ state }) => {
      const prev = prevStateRef.current;

      // Play-again reset: wipe queue so no stale animations bleed into next game
      if (prev?.phase === 'finished' && state.phase === 'playing') {
        setPlayAgainVotes({ votes: [], players: [] });
        setLeaveGameVotes({ votes: [], players: [] });
        setNextRoundDeadline(null);
        setAnimQueue([]);
        prevStateRef.current = state;
        setGameState(state);
        setActionError(null);
        return;
      }

      // Clear next-round votes + countdown when the new round starts
      if (prev?.phase === 'round_end' && state.phase !== 'round_end') {
        setNextRoundVotes({ votes: [], players: [] });
        setNextRoundDeadline(null);
      }

      const newAnims = buildAnimQueue(prev, state);
      prevStateRef.current = state;
      setGameState(state);
      if (newAnims.length > 0) {
        setAnimQueue(q => [...q, ...newAnims]);
      }
      setActionError(null);
    });
    socket.on('fh_play_again_update',  ({ votes, players }) => setPlayAgainVotes({ votes, players }));
    socket.on('fh_next_round_update',   ({ votes, players }) => setNextRoundVotes({ votes, players }));
    socket.on('fh_leave_update',        ({ votes, players }) => setLeaveGameVotes({ votes, players }));
    socket.on('fh_next_round_countdown', ({ deadline }) => setNextRoundDeadline(deadline));
    socket.on('fh_action_rejected', ({ error: e }) => setActionError(e));
    socket.on('fh_error',          ({ message })   => setError(message));

    // Soundboard: the server approved a sound (someone spent SP). EVERYONE in the
    // room — including the player who played it — gets this and plays the sound, and
    // marks the board "busy" so only one sound plays room-wide at a time. The player
    // who triggered it reports back when it finishes so the server can free the lock.
    socket.on('fh_sound', ({ sound, playerId: from }) => {
      setSoundPlaying(true);
      setIStartedSound(from === clientId); // only the initiator may STOP it
      // The shared player auto-replaces any clip already playing. Only the initiator
      // reports the finish back so the server can free the room's single-sound lock.
      playSoundUrl(sound, from === clientId ? () => socketRef.current?.emit('fh_sound_ended') : null);
    });
    // The initiator pressed STOP → instantly halt the local clip for everyone in the room.
    socket.on('fh_sound_stop', () => {
      stopSoundAudio();
      setSoundPlaying(false);
      setIStartedSound(false);
    });
    // The room-wide sound finished (or its lock timed out) → board is free again.
    socket.on('fh_sound_done', () => {
      stopSoundAudio();
      setSoundPlaying(false);
      setIStartedSound(false);
    });

    // The whole room voted to leave: the room is gone server-side. Drop all game
    // state so the player lands back on the room-code screen, and forget the room
    // so a reconnect doesn't try to auto-rejoin it.
    socket.on('fh_room_closed', () => {
      joinInfoRef.current = null;
      prevStateRef.current = null;
      setGameState(null);
      setRoomPlayers([]);
      setHostId(null);
      setIsHost(false);
      setAnimQueue([]);
      setPlayAgainVotes({ votes: [], players: [] });
      setNextRoundVotes({ votes: [], players: [] });
      setLeaveGameVotes({ votes: [], players: [] });
      setNextRoundDeadline(null);
      setActionError(null);
      setError(null);
    });

    socket.connect();
    return () => {
      const p = pendingActionRef.current;
      if (p) { clearTimeout(p.timer); p.cancelled = true; }
      socket.disconnect();
    };
  }, []);

  const joinRoom = useCallback((roomId, name) => {
    joinInfoRef.current = { roomId, name }; // remembered so reconnects auto-rejoin
    socketRef.current?.emit('fh_join', { roomId, playerName: name, playerId: clientIdRef.current });
  }, []);

  const startGame = useCallback((roomId) => socketRef.current?.emit('fh_start', { roomId }), []);

  // Send an action reliably. We wait for a server acknowledgement; if none arrives
  // (lost packet / temporary disconnect) we retry every ~2.5s until it lands. Each
  // logical action carries a stable actionId, so a retry that reaches the server
  // after the original already applied is ignored — no double draws.
  const sendAction = useCallback((action) => {
    setActionError(null);

    // Supersede any still-retrying earlier action (turn-based: one at a time).
    if (pendingActionRef.current) {
      clearTimeout(pendingActionRef.current.timer);
      pendingActionRef.current.cancelled = true;
    }

    // Session nonce keeps ids unique across page reloads, so a fresh action can
    // never be mistaken for a pre-reload duplicate.
    const actionId = `${clientIdRef.current}:${sessionRef.current}:${++actionSeqRef.current}`;
    const entry = { actionId, cancelled: false, timer: null };
    pendingActionRef.current = entry;

    const attempt = () => {
      if (entry.cancelled) return;
      const socket = socketRef.current;
      if (!socket || !socket.connected) {
        // Offline — don't pile up buffered packets; just try again shortly.
        entry.timer = setTimeout(attempt, ACTION_RETRY_MS);
        return;
      }
      socket.timeout(ACTION_RETRY_MS).emit('fh_action', { action, actionId }, (err, res) => {
        if (entry.cancelled) return;
        if (err) {
          // No acknowledgement within the window → the query went wrong; retry.
          entry.timer = setTimeout(attempt, ACTION_RETRY_MS);
        } else if (res && res.ok === false) {
          // Server received and rejected it on the merits — stop retrying.
          setActionError(res.error);
          if (pendingActionRef.current === entry) pendingActionRef.current = null;
        } else {
          // Applied (or recognized as a duplicate) — done.
          if (pendingActionRef.current === entry) pendingActionRef.current = null;
        }
      });
    };
    attempt();
  }, []);

  // Ask the server to play a Soundboard sound for the whole room. The server checks
  // SP + the room-wide single-sound lock, then broadcasts fh_sound back to everyone.
  const playSound = useCallback((key) => socketRef.current?.emit('fh_play_sound', { emote: key }), []);

  // STOP (initiator only): halt our own clip immediately for instant feedback, then
  // tell the server to free the room lock and cut the clip on everyone else's client.
  const stopSound = useCallback(() => {
    stopSoundAudio();
    setSoundPlaying(false);
    setIStartedSound(false);
    socketRef.current?.emit('fh_stop_sound');
  }, []);

  // Soundboard cheat: ask the server to grant SP (the hidden "+" button).
  const cheatAddSp = useCallback(() => socketRef.current?.emit('fh_cheat_sp'), []);

  const advanceAnim   = useCallback(() => setAnimQueue(q => q.slice(1)), []);
  const votePlayAgain   = useCallback(() => socketRef.current?.emit('fh_play_again'), []);
  const voteNextRound   = useCallback(() => socketRef.current?.emit('fh_next_round_vote'), []);
  const voteLeaveGame     = useCallback(() => socketRef.current?.emit('fh_leave_vote', { leaving: true }), []);
  const withdrawLeaveGame = useCallback(() => socketRef.current?.emit('fh_leave_vote', { leaving: false }), []);

  // Leave the pre-game lobby and return to the start screen (the lobby "Back" button).
  const leaveRoom = useCallback(() => {
    socketRef.current?.emit('fh_leave_room');
    joinInfoRef.current = null; // don't auto-rejoin on a reconnect
    prevStateRef.current = null;
    setGameState(null);
    setRoomPlayers([]);
    setHostId(null);
    setIsHost(false);
    setAnimQueue([]);
    setPlayAgainVotes({ votes: [], players: [] });
    setNextRoundVotes({ votes: [], players: [] });
    setLeaveGameVotes({ votes: [], players: [] });
    setNextRoundDeadline(null);
    setError(null);
  }, []);

  const isMyTurn = gameState?.activePlayerId === playerId;
  const self     = gameState ? gameState.players[playerId] : null;

  return {
    connected, playerId, isHost, hostId,
    roomPlayers, gameState,
    isMyTurn, self,
    error, actionError,
    animQueue, advanceAnim,
    playAgainVotes, votePlayAgain,
    nextRoundVotes, voteNextRound, nextRoundDeadline,
    leaveGameVotes, voteLeaveGame, withdrawLeaveGame,
    joinRoom, startGame, sendAction, leaveRoom,
    playSound, stopSound, soundPlaying, iStartedSound, cheatAddSp,
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
