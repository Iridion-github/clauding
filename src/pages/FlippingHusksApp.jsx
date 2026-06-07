import { useEffect, useMemo, useState } from 'react';
import { useFlippingHusks } from '../hooks/useFlippingHusks';
import { FlippingHusksLobby } from '../components/flippinghusks/FlippingHusksLobby';
import { FlippingHusksBoard } from '../components/flippinghusks/FlippingHusksBoard';
import { CardDrawAnimation } from '../components/flippinghusks/CardDrawAnimation';
import { ReshuffleAnimation } from '../components/flippinghusks/ReshuffleAnimation';

export function FlippingHusksApp() {
  const [currentRoomId, setCurrentRoomId] = useState('');

  const {
    connected, playerId, isHost, hostId,
    roomPlayers, gameState,
    isMyTurn, self,
    error, actionError,
    animQueue, advanceAnim,
    playAgainVotes, votePlayAgain,
    nextRoundVotes, voteNextRound,
    joinRoom, startGame, sendAction,
  } = useFlippingHusks();

  useEffect(() => {
    if (gameState?.phase === 'finished') {
      new Audio('/sounds/victory.mp3').play().catch(() => {});
    }
  }, [gameState?.phase]);

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
          isMyTurn={isMyTurn}
          actionError={actionError}
          sendAction={sendAction}
          playAgainVotes={playAgainVotes}
          votePlayAgain={votePlayAgain}
          nextRoundVotes={nextRoundVotes}
          voteNextRound={voteNextRound}
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
      </>
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
