import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Stack, Typography, CircularProgress, Button, Fab } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import { useFlippingHusks } from '../hooks/useFlippingHusks';
import { FlippingHusksLobby } from '../components/flippinghusks/FlippingHusksLobby';
import { FlippingHusksBoard } from '../components/flippinghusks/FlippingHusksBoard';
import { CardDrawAnimation } from '../components/flippinghusks/CardDrawAnimation';
import { ReshuffleAnimation } from '../components/flippinghusks/ReshuffleAnimation';
import { isDiscordActivity, setupDiscord, discordRoomId, discordPlayerName, discordAvatarUrl } from '../discord/discord';
import { CardThemeProvider } from '../components/flippinghusks/CardThemeContext';
import { Soundboard } from '../components/flippinghusks/Soundboard';
import { DebugPanel } from '../components/flippinghusks/DebugPanel';
import { VictoryAnimation } from '../components/flippinghusks/VictoryAnimation';
import { loadSettings, musicSrcFor, BGM_VOLUME, applyAnimationSpeed, applyBackground } from '../components/flippinghusks/settingsStore';

export function FlippingHusksApp() {
  // Apply the saved animation speed + themed background once up front so their CSS
  // variables are set before anything renders (Settings → Save updates them live too).
  useEffect(() => {
    const s = loadSettings();
    applyAnimationSpeed(s.animationSpeed);
    applyBackground(s.theme);
  }, []);
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
  // Room code + display name learned from Discord; pre-fills (and locks) the lobby.
  const [discordInfo, setDiscordInfo] = useState(null);
  const DISCORD_SLOW_MS = 20000;

  const {
    connected, playerId, isHost, isSpectator, hostId,
    roomPlayers, spectators, gameState,
    isMyTurn,
    error, actionError,
    animQueue, advanceAnim,
    playAgainVotes, votePlayAgain,
    nextRoundVotes, voteNextRound, nextRoundDeadline,
    leaveGameVotes, voteLeaveGame, withdrawLeaveGame,
    joinRoom, startGame, sendAction, leaveRoom,
    playSound, stopSound, soundPlaying, iStartedSound, cheatAddSp,
    sendDebug, enqueueAnims,
  } = useFlippingHusks();

  // When launched as a Discord Activity, do the SDK/OAuth handshake and learn the
  // room key (voice channel) + display name — but DON'T auto-join. Instead the lobby
  // shows the normal start screen with those values pre-filled and locked, so the
  // player can open Settings / Learn to Play before clicking Join. Everyone in the
  // same channel still converges on the same room (same key), no codes typed.
  useEffect(() => {
    if (!isDiscordActivity) return;
    let cancelled = false;
    const slowTimer = setTimeout(() => { if (!cancelled) setDiscordSlow(true); }, DISCORD_SLOW_MS);
    setupDiscord()
      .then(info => {
        if (cancelled || !info) return;
        setDiscordInfo({ roomId: discordRoomId(info), name: discordPlayerName(info), avatar: discordAvatarUrl(info) });
        setDiscordReady(true);
      })
      .catch(err => {
        if (!cancelled) setDiscordError(err.message || String(err));
      })
      .finally(() => clearTimeout(slowTimer));
    return () => { cancelled = true; clearTimeout(slowTimer); };
  }, []);

  // Victory flourish: shown over the end screen when a game finishes, then dismissed
  // (auto after a few seconds, or on tap) to reveal the Play Again / Leave buttons.
  const [showVictory, setShowVictory] = useState(false);
  useEffect(() => {
    if (gameState?.phase === 'finished') {
      new Audio('/sounds/victory.mp3').play().catch(() => {});
      setShowVictory(true);
    } else {
      setShowVictory(false);
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

    // Stop when the game ends or we leave it entirely (room closed → no gameState).
    if ((phase === 'finished' || !phase) && bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current = null;
      setBgmPlaying(false);
    }
  }, [gameState?.phase]);

  // Toggle mute — the volume effect below applies the actual level.
  function toggleBgmMute() {
    setBgmMuted(m => !m);
  }

  // Drive the BGM volume from the mute + Soundboard state: normal when idle, halved
  // while a Soundboard sound plays (so the clip is clearly audible), 0 when muted.
  useEffect(() => {
    const audio = bgmRef.current;
    if (!audio) return;
    const base = bgmMuted ? 0 : BGM_VOLUME;
    audio.volume = soundPlaying ? base / 2 : base;
  }, [soundPlaying, bgmMuted, bgmPlaying]);

  // Stop the music if we leave the game (unmount / navigate away).
  useEffect(() => () => {
    if (bgmRef.current) {
      bgmRef.current.pause();
      bgmRef.current = null;
    }
  }, []);

  function handleJoin(roomId, name, asSpectator = false) {
    setCurrentRoomId(roomId);
    joinRoom(roomId, name, asSpectator, discordInfo?.avatar ?? null);
  }

  const currentAnim = animQueue[0] ?? null;

  // The card currently flying into a hand is rendered (invisibly) in its REAL slot so the
  // fly animation can measure the exact landing spot instead of guessing. Only genuine
  // fly cards qualify (mirrors CardDrawAnimation's canFly): lands in a hand, not bust / FH /
  // Second Chance (draw or activation) / special.
  const incomingCardId = (
    currentAnim && currentAnim.type !== 'reshuffle' && currentAnim.card
    && currentAnim.targetPlayerId != null
    && !currentAnim.isBust && !currentAnim.isFlippingHusks && !currentAnim.secondChanceCard
    && currentAnim.card.type !== 'second_chance'
  ) ? currentAnim.card.id : null;

  // Debug tools (solo play only). Bust / Flip 7 are pure local animation previews
  // queued straight onto the anim pipeline; the rest are forced server outcomes.
  const isSolo = (gameState?.playerOrder?.length ?? 0) === 1;
  function handleDebugAction(key) {
    if (key === 'bust') {
      enqueueAnims([{ card: { id: `dbg-bust-${Date.now()}`, type: 'number', value: 12, label: '12' }, isBust: true, preview: true }]);
    } else if (key === 'flip7') {
      // Skip the per-card draws — jump straight to the Flipped 7 flourish on one reveal.
      enqueueAnims([{ card: { id: `dbg-f7-${Date.now()}`, type: 'number', value: 6, label: '6' }, isFlippingHusks: true, preview: true }]);
    } else if (key === 'reshuffle') {
      enqueueAnims([{ type: 'reshuffle' }]);
    } else {
      sendDebug(key); // freeze / flip3 / second_chance / win
    }
  }

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

    // Hide every queued non-SC, non-reshuffle card from the board until its animation
    // plays. Debug previews (`preview`) are purely cosmetic — they have no real card in
    // any hand and must never influence the board's cards or statuses, so skip them.
    // ...but keep the currently-flying card visible-in-DOM (it's rendered invisibly in its
    // real slot by the board) so the fly animation can measure where it actually lands.
    const queuedIds = new Set(
      animQueue.filter(a => a.card && !a.secondChanceCard && !a.preview && a.card.id !== incomingCardId).map(a => a.card.id)
    );
    if (queuedIds.size === 0) return { ...gameState, players };

    const queueHasBust = animQueue.some(a => a.isBust && !a.preview);
    const queueHasFH   = animQueue.some(a => a.isFlippingHusks && !a.preview);

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
  }, [gameState, animQueue, incomingCardId]);

  if (gameState) {
    return (
      <>
        <FlippingHusksBoard
          gameState={displayedGameState}
          playerId={playerId}
          connected={connected}
          roomPlayers={roomPlayers}
          spectators={spectators}
          isSpectator={isSpectator}
          isMyTurn={isMyTurn}
          actionError={actionError}
          sendAction={sendAction}
          playAgainVotes={playAgainVotes}
          votePlayAgain={votePlayAgain}
          nextRoundVotes={nextRoundVotes}
          voteNextRound={voteNextRound}
          nextRoundDeadline={nextRoundDeadline}
          leaveGameVotes={leaveGameVotes}
          voteLeaveGame={voteLeaveGame}
          withdrawLeaveGame={withdrawLeaveGame}
          onLeaveGame={leaveRoom}
          animating={currentAnim !== null}
          incomingCardId={incomingCardId}
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
            targetId={currentAnim.targetPlayerId ?? null}
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
        {gameState.soundboardEnabled && !isSpectator && (
          <Soundboard
            playSound={playSound}
            stopSound={stopSound}
            canStop={soundPlaying && iStartedSound}
            sp={gameState.players[playerId]?.sp ?? 0}
            soundPlaying={soundPlaying}
            onCheat={cheatAddSp}
          />
        )}
        {isSolo && !isSpectator && <DebugPanel onAction={handleDebugAction} />}
        {showVictory && gameState.winner && (
          <VictoryAnimation
            name={gameState.players[gameState.winner]?.name ?? 'Winner'}
            avatar={roomPlayers.find(p => p.id === gameState.winner)?.avatar ?? null}
            winnerId={gameState.winner}
            standings={gameState.playerOrder
              .map(pid => ({ id: pid, name: gameState.players[pid]?.name ?? '—', score: gameState.players[pid]?.totalScore ?? 0 }))
              .sort((a, b) => b.score - a.score)}
            onDone={() => setShowVictory(false)}
          />
        )}
      </>
    );
  }

  // Hold the lobby back until the Discord handshake finishes (or surface its error).
  if (isDiscordActivity && !discordReady) {
    return (
      <Box className="fh-bg" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3 }}>
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
      isSpectator={isSpectator}
      hostId={hostId}
      roomPlayers={roomPlayers}
      spectators={spectators}
      roomId={currentRoomId}
      error={error}
      discord={discordInfo}
      onJoin={handleJoin}
      onStart={(soundboardEnabled) => startGame(currentRoomId, soundboardEnabled)}
      onLeaveRoom={leaveRoom}
    />
  );
}
