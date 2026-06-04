import { useGame } from '../hooks/useGame';
import { Lobby } from '../components/game/Lobby';
import { GameBoard } from '../components/game/GameBoard';

export function MTGApp() {
  const {
    connected, gameState, playerId,
    roomPlayers, isMyTurn, hasPriority,
    error, actionError, joinRoom, sendAction,
  } = useGame();

  if (!gameState) {
    return (
      <Lobby
        connected={connected}
        roomPlayers={roomPlayers}
        error={error}
        onJoin={joinRoom}
      />
    );
  }

  return (
    <GameBoard
      gameState={gameState}
      playerId={playerId}
      isMyTurn={isMyTurn}
      hasPriority={hasPriority}
      actionError={actionError}
      sendAction={sendAction}
    />
  );
}
