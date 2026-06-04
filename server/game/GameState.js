const PHASES = ['untap', 'upkeep', 'draw', 'main1', 'combat', 'main2', 'end'];
const ZONES = ['library', 'hand', 'battlefield', 'graveyard', 'exile'];
const COLORS = ['white', 'blue', 'black', 'red', 'green', 'colorless'];

function emptyMana() {
  return { white: 0, blue: 0, black: 0, red: 0, green: 0, colorless: 0 };
}

function createPlayer(id, name, deck) {
  return {
    id,
    name,
    life: 20,
    mana: emptyMana(),
    maxMana: emptyMana(),
    library: [...deck],
    hand: [],
    battlefield: [],
    graveyard: [],
    exile: [],
    hasPlayedLand: false,
  };
}

function createGameState(player1Id, player1Name, deck1, player2Id, player2Name, deck2) {
  const p1 = createPlayer(player1Id, player1Name, deck1);
  const p2 = createPlayer(player2Id, player2Name, deck2);

  shuffle(p1.library);
  shuffle(p2.library);

  p1.hand = p1.library.splice(0, 7);
  p2.hand = p2.library.splice(0, 7);

  return {
    id: generateId(),
    phase: 'main1',
    turn: 1,
    activePlayerId: player1Id,
    priorityPlayerId: player1Id,
    players: { [player1Id]: p1, [player2Id]: p2 },
    playerOrder: [player1Id, player2Id],
    stack: [],
    winner: null,
  };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function getOpponentId(state, playerId) {
  return state.playerOrder.find(id => id !== playerId);
}

function nextPhase(state) {
  const idx = PHASES.indexOf(state.phase);
  if (idx === PHASES.length - 1) return nextTurn(state);

  const next = { ...state, phase: PHASES[idx + 1] };
  if (next.phase === 'untap') untapAll(next);
  return next;
}

function nextTurn(state) {
  const nextActiveId = getOpponentId(state, state.activePlayerId);
  const nextState = {
    ...state,
    phase: 'untap',
    turn: state.turn + 1,
    activePlayerId: nextActiveId,
    priorityPlayerId: nextActiveId,
  };

  nextState.players[nextActiveId].hasPlayedLand = false;

  // Empty mana pools (mana doesn't persist between phases in MtG)
  for (const id of nextState.playerOrder) {
    nextState.players[id].mana = emptyMana();
  }

  untapAll(nextState);
  drawCard(nextState, nextActiveId);

  return nextState;
}

function untapAll(state) {
  const player = state.players[state.activePlayerId];
  player.battlefield = player.battlefield.map(card => ({
    ...card,
    tapped: false,
    summoningSickness: false, // cleared on your untap step
  }));
  rebuildMaxMana(state, state.activePlayerId);
}

function rebuildMaxMana(state, playerId) {
  const player = state.players[playerId];
  const max = emptyMana();
  for (const card of player.battlefield) {
    if (card.type === 'land' && card.produces) {
      max[card.produces] = (max[card.produces] || 0) + 1;
    }
  }
  player.maxMana = max;
}

function drawCard(state, playerId) {
  const player = state.players[playerId];
  if (player.library.length === 0) {
    state.winner = getOpponentId(state, playerId);
    return;
  }
  const [drawn, ...rest] = player.library;
  player.library = rest;
  player.hand = [...player.hand, drawn];
}

module.exports = {
  createGameState, nextPhase, nextTurn, drawCard,
  getOpponentId, generateId, rebuildMaxMana, emptyMana,
  PHASES, ZONES, COLORS,
};
