import { useEffect, useMemo, useState } from 'react';
import { useFlippingHusks } from '../hooks/useFlippingHusks';
import { FlippingHusksLobby } from '../components/flippinghusks/FlippingHusksLobby';
import { FlippingHusksBoard } from '../components/flippinghusks/FlippingHusksBoard';
import { CardDrawAnimation } from '../components/flippinghusks/CardDrawAnimation';

export function FlippingHusksApp() {
  const [currentRoomId, setCurrentRoomId] = useState('');

  const {
    connected, playerId, isHost, hostId,
    roomPlayers, gameState,
    isMyTurn, self,
    error, actionError,
    drawnCardAnim, clearDrawnCardAnim,
    playAgainVotes, votePlayAgain,
    joinRoom, startGame, sendAction,
  } = useFlippingHusks();

  useEffect(() => {
    if (gameState?.phase === 'finished') {
      new Audio('/sounds/victory.mp3').play().catch(() => {});
    }
  }, [gameState?.phase]);

  // If an animation is playing when a target-picker modal opens for this player,
  // cancel it immediately so the modal isn't buried under the animation layer.
  useEffect(() => {
    if (gameState?.pendingAction?.drawerId === playerId && drawnCardAnim) {
      clearDrawnCardAnim();
    }
  }, [gameState, playerId, drawnCardAnim, clearDrawnCardAnim]);

  function handleJoin(roomId, name) {
    setCurrentRoomId(roomId);
    joinRoom(roomId, name);
  }

  // While a card-draw animation is playing, adjust the displayed state so the
  // board doesn't spoil the outcome before the animation reveals it.
  const displayedGameState = useMemo(() => {
    if (!gameState || !drawnCardAnim) return gameState;
    const players = { ...gameState.players };

    if (drawnCardAnim.secondChanceCard) {
      // Second-chance save: the sc card was already removed from the player's hand
      // in the real state — put it back visually until the animation is done.
      const pid = drawnCardAnim.savedPlayerId;
      const p   = players[pid];
      if (p) {
        players[pid] = {
          ...p,
          cards: [...p.cards, drawnCardAnim.secondChanceCard],
          secondChances: p.secondChances + 1,
        };
      }
      return { ...gameState, players };
    }

    // Normal draw: hide the drawn card (and mask bust status) until revealed.
    const cardId = drawnCardAnim.card.id;
    for (const pid of gameState.playerOrder) {
      const p = players[pid];
      if (!p.cards.some(c => c.id === cardId)) continue;
      players[pid] = {
        ...p,
        cards: p.cards.filter(c => c.id !== cardId),
        status: drawnCardAnim.isBust ? 'active' : p.status,
      };
      break;
    }
    return { ...gameState, players };
  }, [gameState, drawnCardAnim]);

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
        />
        {drawnCardAnim && (
          <CardDrawAnimation
            key={drawnCardAnim.card.id}
            card={drawnCardAnim.card}
            isBust={drawnCardAnim.isBust}
            isFlippingHusks={drawnCardAnim.isFlippingHusks ?? false}
            secondChanceCard={drawnCardAnim.secondChanceCard ?? null}
            onDone={clearDrawnCardAnim}
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
