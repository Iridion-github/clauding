import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Stack, Typography, CircularProgress, Button, Fab } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { useFlippingHusks } from '../hooks/useFlippingHusks';
import { FlippingHusksLobby } from '../components/flippinghusks/FlippingHusksLobby';
import { FlippingHusksBoard } from '../components/flippinghusks/FlippingHusksBoard';
import { CardDrawAnimation } from '../components/flippinghusks/CardDrawAnimation';
import { ReshuffleAnimation } from '../components/flippinghusks/ReshuffleAnimation';
import { isDiscordActivity, setupDiscord, discordRoomId, discordPlayerName } from '../discord/discord';
import { CardThemeProvider } from '../components/flippinghusks/CardThemeContext';
import { loadSettings, musicSrcFor, BGM_VOLUME } from '../components/flippinghusks/settingsStore';

export function FlippingHusksApp() {
  // Provide the saved card theme to every card rendered in the lobby, board and animations.
  return (
    <CardThemeProvider>
      <FlippingHusksAppInner />
    </CardThemeProvider>
  );
}

function FlippingHusksAppInner() {
  const [currentRoomId, setCurrentRoomId] = useState('');
  // Discord handshake state: not-in-Discord is treated as "ready" so the normal
  // website flow renders immediately.
  const [discordReady, setDiscordReady] = useState(!isDiscordActivity);
  const [discordError, setDiscordError] = useState(null);
  // The handshake can stall silently when Render's free tier is cold-starting:
  // the SDK's own server-reachability probe hangs on a 503, so setupDiscord()
  // neither resolves nor rejects. Flip this after a grace period so the user gets
  // an explanation + a reload instead of an eternal spinner.
  const [discordSlow, setDiscordSlow] = useState(false);
  const DISCORD_SLOW_MS = 20000;

  const {
    connected, playerId, isHost, hostId,
    roomPlayers, gameState,
    isMyTurn,
    error, actionError,
    animQueue, advanceAnim,
    playAgainVotes, votePlayAgain,
    nextRoundVotes, voteNextRound, nextRoundDeadline,
    joinRoom, startGame, sendAction,
  } = useFlippingHusks();

  // When launched as a Discord Activity, do the SDK/OAuth handshake then auto-join
  // a room keyed to the voice channel, using the Discord username. Everyone who
  // opens the Activity in the same channel lands in the same room — no codes typed.
  useEffect(() => {
    if (!isDiscordActivity) return;
    let cancelled = false;
    const slowTimer = setTimeout(() => { if (!cancelled) setDiscordSlow(true); }, DISCORD_SLOW_MS);
    setupDiscord()
      .then(info => {
        if (cancelled || !info) return;
        const roomId = discordRoomId(info);
        setCurrentRoomId(roomId);
        joinRoom(roomId, discordPlayerName(info));
        setDiscordReady(true);
      })
      .catch(err => {
        if (!cancelled) setDiscordError(err.message || String(err));
      })
      .finally(() => clearTimeout(slowTimer));
    return () => { cancelled = true; clearTimeout(slowTimer); };
  }, [joinRoom]);

  useEffect(() => {
    if (gameState?.phase === 'finished') {
      new Audio('/sounds/victory.mp3').play().catch(() => {});
    }
  }, [gameState?.phase]);

  // Background music: starts once the game begins (first cards are dealt in the
  // 'playing' phase), loops quietly for the whole game, and stops when it ends.
  const bgmRef = useRef(null);
  const [bgmPlaying, setBgmPlaying] = useState(false);
  const [bgmMuted, setBgmMuted] = useState(false);

  useEffect(() => {
    const phase = gameState?.phase;

    if (phase === 'playing' && !bgmRef.current) {
      // Read the player's saved settings on game entry.
      const settings = loadSettings();
      const audio = new Audio(musicSrcFor(settings.musicTrack));
      audio.loop = true;
      // If Background Music is disabled, the track still loads but starts muted
      // (volume 0) — the player can unmute it via the on-screen button.
      const muted = !settings.backgroundMusic;
      audio.volume = muted ? 0 : BGM_VOLUME;
      // Only show the mute button once playback actually starts (autoplay may be blocked).
      audio.play().then(() => setBgmPlaying(true)).catch(() => {});
      bgmRef.current = audio;
      setBgmMuted(muted);
    }

    if (phase === 'finished' && bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current = null;
      setBgmPlaying(false);
    }
  }, [gameState?.phase]);

  // Toggle mute by swapping the volume between 0 and the normal level.
  function toggleBgmMute() {
    const audio = bgmRef.current;
    if (!audio) return;
    const muted = audio.volume === 0;
    audio.volume = muted ? BGM_VOLUME : 0;
    setBgmMuted(!muted);
  }

  // Stop the music if we leave the game (unmount / navigate away).
  useEffect(() => () => {
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current = null;
    }
  }, []);

  function handleJoin(roomId, name) {
    setCurrentRoomId(roomId);
    joinRoom(roomId, name);
  }

  const currentAnim = animQueue[0] ?? null;

  // While animations are queued, adjust the displayed state so the board doesn't
  // spoil cards or outcomes before each animation in the sequence reveals them.
  const displayedGameState = useMemo(() => {
    if (!gameState || animQueue.length === 0) return gameState;
    const cur     = animQueue[0];
    const players = { ...gameState.players };

    // Second-chance animation: restore the saved SC card visually while it plays.
    if (cur.secondChanceCard) {
      const pid = cur.savedPlayerId;
      const p   = players[pid];
      if (p) {
        players[pid] = {
          ...p,
          cards: [...p.cards, cur.secondChanceCard],
          secondChances: p.secondChances + 1,
        };
      }
    }

    // Hide every queued non-SC, non-reshuffle card from the board until its animation plays.
    const queuedIds = new Set(
      animQueue.filter(a => a.card && !a.secondChanceCard).map(a => a.card.id)
    );
    if (queuedIds.size === 0) return { ...gameState, players };

    const queueHasBust = animQueue.some(a => a.isBust);
    const queueHasFH   = animQueue.some(a => a.isFlippingHusks);

    for (const pid of gameState.playerOrder) {
      const p        = players[pid];
      const filtered = p.cards.filter(c => !queuedIds.has(c.id));
      if (filtered.length === p.cards.length) continue;
      players[pid] = {
        ...p,
        cards: filtered,
        status:
          queueHasBust && p.status === 'busted'        ? 'active' :
          queueHasFH   && p.status === 'flippinghusks' ? 'active' :
          p.status,
      };
    }
    return { ...gameState, players };
  }, [gameState, animQueue]);

  if (gameState) {
    return (
      <>
        <FlippingHusksBoard
          gameState={displayedGameState}
          playerId={playerId}
          connected={connected}
          roomPlayers={roomPlayers}
          isMyTurn={isMyTurn}
          actionError={actionError}
          sendAction={sendAction}
          playAgainVotes={playAgainVotes}
          votePlayAgain={votePlayAgain}
          nextRoundVotes={nextRoundVotes}
          voteNextRound={voteNextRound}
          nextRoundDeadline={nextRoundDeadline}
          animating={currentAnim !== null}
        />
        {currentAnim?.type === 'reshuffle' && (
          <ReshuffleAnimation key="reshuffle" onDone={advanceAnim} />
        )}
        {currentAnim && currentAnim.type !== 'reshuffle' && (
          <CardDrawAnimation
            key={currentAnim.card.id}
            card={currentAnim.card}
            isBust={currentAnim.isBust}
            isFlippingHusks={currentAnim.isFlippingHusks ?? false}
            secondChanceCard={currentAnim.secondChanceCard ?? null}
            onDone={advanceAnim}
          />
        )}
        {bgmPlaying && (
          <Fab
            size="small"
            onClick={toggleBgmMute}
            aria-label={bgmMuted ? 'Unmute music' : 'Mute music'}
            sx={{ position: 'fixed', top: '50%', right: 16, transform: 'translateY(-50%)', zIndex: 1300 }}
          >
            {bgmMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
          </Fab>
        )}
      </>
    );
  }

  // Hold the lobby back until the Discord handshake finishes (or surface its error).
  if (isDiscordActivity && !discordReady) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
        <Stack spacing={2} sx={{ alignItems: 'center', textAlign: 'center' }}>
          {discordError ? (
            <>
              <Typography variant="h6" color="error">Couldn't connect to Discord</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
                {discordError}
              </Typography>
              <Button variant="contained" onClick={() => window.location.reload()}>Reload</Button>
            </>
          ) : (
            <>
              <CircularProgress color="primary" />
              <Typography variant="body2" color="text.secondary">Connecting to Discord…</Typography>
              {discordSlow && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
                    The server may be waking up — this can take up to a minute on the
                    first launch. Hang tight, or reload to retry.
                  </Typography>
                  <Button variant="outlined" onClick={() => window.location.reload()}>Reload</Button>
                </>
              )}
            </>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <FlippingHusksLobby
      connected={connected}
      playerId={playerId}
      isHost={isHost}
      hostId={hostId}
      roomPlayers={roomPlayers}
      roomId={currentRoomId}
      error={error}
      onJoin={handleJoin}
      onStart={() => startGame(currentRoomId)}
    />
  );
}
