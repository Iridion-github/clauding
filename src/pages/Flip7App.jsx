import { useMemo, useState } from 'react';
import { useFlip7 } from '../hooks/useFlip7';
import { Flip7Lobby } from '../components/flip7/Flip7Lobby';
import { Flip7Board } from '../components/flip7/Flip7Board';
import { CardDrawAnimation } from '../components/flip7/CardDrawAnimation';

export function Flip7App() {
  const [currentRoomId, setCurrentRoomId] = useState('');

  const {
    connected, playerId, isHost, hostId,
    roomPlayers, gameState,
    isMyTurn, self,
    error, actionError,
    drawnCardAnim, clearDrawnCardAnim,
    joinRoom, startGame, sendAction,
  } = useFlip7();

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
        <Flip7Board
          gameState={displayedGameState}
          playerId={playerId}
          isMyTurn={isMyTurn}
          actionError={actionError}
          sendAction={sendAction}
        />
        {drawnCardAnim && (
          <CardDrawAnimation
            key={drawnCardAnim.card.id}
            card={drawnCardAnim.card}
            isBust={drawnCardAnim.isBust}
            secondChanceCard={drawnCardAnim.secondChanceCard ?? null}
            onDone={clearDrawnCardAnim}
          />
        )}
      </>
    );
  }

  return (
    <Flip7Lobby
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
