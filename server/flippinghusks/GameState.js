const { buildDeck, shuffle } = require('./Cards');

// Soundboard economy: players start each game with SP_START Sound Points, earn
// SP_PER_DRAW every time they draw a card (the opening deal doesn't count), and get
// SP_ON_TARGETED whenever they're hit by a Freeze or Flip Three.
const SP_START = 10;
const SP_PER_DRAW = 5;
const SP_ON_TARGETED = 10;

function createPlayer(id, name) {
  return {
    id, name,
    cards: [],
    status: 'active',
    secondChances: 0,
    totalScore: 0,
    roundScore: null,
    sp: SP_START,
  };
}

function createGame(players) {
  const deck = buildDeck();
  shuffle(deck);

  const playerMap = {};
  for (const p of players) playerMap[p.id] = createPlayer(p.id, p.name);

  const state = {
    phase: 'playing',
    round: 1,
    playerOrder: players.map(p => p.id),
    players: playerMap,
    drawPile: deck,
    discardPile: [],     // persists across rounds; reshuffled into drawPile when deck runs out
    activePlayerId: null,
    pendingAction: null, // { type:'freeze'|'flip_three', drawerId, card }
    dealQueue: [],       // players still waiting for their initial card
    winner: null,
    log: [],
  };

  // Kick off initial deal — may pause mid-way if a special card is drawn
  state.dealQueue = [...state.playerOrder];
  continueDeal(state);
  if (!state.pendingAction) {
    state.activePlayerId = nextActive(state, null);
  }

  return state;
}

// ── Initial deal ──────────────────────────────────────────────────────────────
function dealOneInitial(state) {
  if (state.dealQueue.length === 0) return;
  const playerId = state.dealQueue.shift();
  if (state.players[playerId].cards.length > 0) return;
  if (state.drawPile.length === 0) replenish(state);
  const card = state.drawPile.shift();
  applyCard(state, playerId, card, { initial: true });
}

function continueDeal(state) {
  while (state.dealQueue.length > 0 && !state.pendingAction && state.phase === 'playing') {
    dealOneInitial(state);
  }
  if (state.pendingAction) {
    state.activePlayerId = state.pendingAction.drawerId;
  }
}

// ── Normal turn draw ──────────────────────────────────────────────────────────
function drawAndProcess(state, playerId) {
  if (state.drawPile.length === 0) replenish(state);
  const card = state.drawPile.shift();
  applyCard(state, playerId, card, {});
}

// ── Core card resolution ──────────────────────────────────────────────────────
function applyCard(state, playerId, card, opts = {}) {
  const player = state.players[playerId];
  const auto   = opts.auto === true;

  // Drawing a card earns Sound Points (the automatic opening deal is excluded so
  // everyone verifiably starts a game with exactly SP_START).
  if (!opts.initial) player.sp += SP_PER_DRAW;

  switch (card.type) {

    case 'number': {
      const dup = player.cards.some(c => c.type === 'number' && c.value === card.value);
      if (dup) {
        if (player.secondChances > 0) {
          const idx = player.cards.findIndex(c => c.type === 'second_chance');
          const savedCard = idx !== -1 ? player.cards[idx] : null;
          if (idx !== -1) player.cards.splice(idx, 1);
          player.secondChances--;
          // Both the rejected duplicate and the consumed SC card leave the game immediately
          state.discardPile.push(card);
          if (savedCard) state.discardPile.push(savedCard);
          state.secondChanceEvent = { playerId, drawnCard: card, savedCard };
          log(state, `${player.name} used Second Chance — saved from busting on ${card.label}!`);
          return;
        }
        player.cards.push(card);
        player.status = 'busted';
        log(state, `${player.name} busted on ${card.label}!`);
        return;
      }
      player.cards.push(card);
      const uniqueNums = new Set(player.cards.filter(c => c.type === 'number').map(c => c.value));
      if (uniqueNums.size >= 7) {
        player.status = 'flippinghusks';
        log(state, `${player.name} achieved Flipping Husks! Round ends for everyone!`);
        endRound(state);
        return;
      }
      log(state, `${player.name} drew ${card.label}.`);
      return;
    }

    case 'modifier':
      player.cards.push(card);
      log(state, `${player.name} drew ${card.label}.`);
      return;

    case 'multiplier':
      player.cards.push(card);
      log(state, `${player.name} drew ×2!`);
      return;

    case 'second_chance':
      player.cards.push(card);
      player.secondChances++;
      log(state, `${player.name} drew Second Chance (now has ${player.secondChances}).`);
      return;

    case 'freeze':
      if (auto) {
        player.cards.push(card);
        player.status = 'stayed';
        log(state, `${player.name} drew Freeze and is immediately frozen.`);
      } else {
        state.pendingAction = { type: 'freeze', drawerId: playerId, card };
        log(state, `${player.name} drew Freeze — choose a target!`);
      }
      return;

    case 'flip_three':
      if (auto) {
        log(state, `${player.name} drew Flip Three — drawing 3 more!`);
        drawN(state, playerId, 3, { auto: true });
        state.discardPile.push(card); // spent — discard, don't keep it in the hand
      } else {
        state.pendingAction = { type: 'flip_three', drawerId: playerId, card };
        log(state, `${player.name} drew Flip Three — choose a target!`);
      }
      return;

    default:
      return;
  }
}

// Draw up to n cards for playerId, stopping if they leave active status,
// the round ends, or a pendingAction is set mid-draw.
function drawN(state, playerId, n, opts = {}) {
  for (let i = 0; i < n; i++) {
    if (state.phase !== 'playing') return;
    if (state.pendingAction) return;
    if (state.players[playerId].status !== 'active') return;
    if (state.drawPile.length === 0) replenish(state);
    applyCard(state, playerId, state.drawPile.shift(), opts);
  }
}

// ── Freeze resolution ─────────────────────────────────────────────────────────
function resolveFreeze(state, drawerId, targetId) {
  const pa = state.pendingAction;
  if (!pa || pa.type !== 'freeze' || pa.drawerId !== drawerId) return false;
  const target = state.players[targetId];
  if (!target || target.status !== 'active') return false;

  target.sp += SP_ON_TARGETED; // being targeted by Freeze grants SP
  target.cards.push(pa.card);
  target.status = 'stayed';

  const who = drawerId === targetId ? 'themselves' : target.name;
  log(state, `${state.players[drawerId].name} froze ${who}.`);

  state.pendingAction = null;
  return true;
}

// ── Flip Three resolution ─────────────────────────────────────────────────────
function resolveFlipThree(state, drawerId, targetId) {
  const pa = state.pendingAction;
  if (!pa || pa.type !== 'flip_three' || pa.drawerId !== drawerId) return false;
  const target = state.players[targetId];
  if (!target || target.status !== 'active') return false;

  target.sp += SP_ON_TARGETED; // being targeted by Flip Three grants SP
  state.pendingAction = null;

  const who = drawerId === targetId ? 'themselves' : target.name;
  log(state, `${state.players[drawerId].name} played Flip Three on ${who} — 3 forced cards!`);

  drawN(state, targetId, 3, { auto: true });

  // The Flip Three card is spent once its effect resolves — discard it instead of
  // leaving it in front of the player who received the effect.
  state.discardPile.push(pa.card);

  return true;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function nextActive(state, currentId) {
  const order = state.playerOrder;
  const start  = currentId != null ? (order.indexOf(currentId) + 1) % order.length : 0;
  for (let i = 0; i < order.length; i++) {
    const pid = order[(start + i) % order.length];
    if (state.players[pid].status === 'active') return pid;
  }
  return null;
}

function allDone(state) {
  return state.playerOrder.every(pid => state.players[pid].status !== 'active');
}

function calcScore(player) {
  if (player.status === 'busted') return 0;
  const nums    = player.cards.filter(c => c.type === 'number');
  const numSum  = nums.reduce((s, c) => s + c.value, 0);
  const hasMult = player.cards.some(c => c.type === 'multiplier');
  const modSum  = player.cards.filter(c => c.type === 'modifier').reduce((s, c) => s + c.value, 0);
  const fhBonus = new Set(nums.map(c => c.value)).size >= 7 ? 15 : 0;
  return (hasMult ? numSum * 2 : numSum) + modSum + fhBonus;
}

function endRound(state) {
  if (state.phase !== 'playing') return;
  // Discard the pending-action card before clearing it
  if (state.pendingAction?.card) {
    state.discardPile.push(state.pendingAction.card);
  }
  state.pendingAction = null;
  state.dealQueue     = [];
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    p.roundScore = calcScore(p);
    p.totalScore += p.roundScore;
  }
  const winners = state.playerOrder.filter(pid => state.players[pid].totalScore >= 200);
  if (winners.length > 0) {
    state.winner = winners.reduce((best, pid) =>
      state.players[pid].totalScore > state.players[best].totalScore ? pid : best,
    winners[0]);
    state.phase = 'finished';
    log(state, `Game over! ${state.players[state.winner].name} wins!`);
    return;
  }
  state.phase = 'round_end';
}

function startNextRound(state) {
  // Move all player cards to the discard pile — deck persists across rounds
  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    state.discardPile.push(...p.cards);
    p.cards         = [];
    p.status        = 'active';
    p.secondChances = 0;
    p.roundScore    = null;
  }

  state.round        += 1;
  state.phase         = 'playing';
  state.pendingAction = null;
  state.log           = [];

  const first = state.playerOrder.shift();
  state.playerOrder.push(first);

  state.dealQueue = [...state.playerOrder];
  continueDeal(state);
  if (!state.pendingAction) {
    state.activePlayerId = nextActive(state, null);
  }
}

function resetGame(state) {
  const deck = buildDeck();
  shuffle(deck);

  state.drawPile          = deck;
  state.discardPile       = [];
  state.reshuffleEvent    = null;
  state.round             = 1;
  state.phase             = 'playing';
  state.pendingAction     = null;
  state.secondChanceEvent = null;
  state.winner            = null;
  state.log               = [];

  for (const pid of state.playerOrder) {
    const p = state.players[pid];
    p.cards         = [];
    p.status        = 'active';
    p.secondChances = 0;
    p.roundScore    = null;
    p.totalScore    = 0;
    p.sp            = SP_START;
  }

  state.dealQueue = [...state.playerOrder];
  continueDeal(state);
  if (!state.pendingAction) {
    state.activePlayerId = nextActive(state, null);
  }
}

// Reshuffle the discard pile back into the draw pile.
// Sets reshuffleEvent so the engine can signal clients to play the animation.
function replenish(state) {
  if (state.discardPile && state.discardPile.length > 0) {
    const fresh = [...state.discardPile];
    shuffle(fresh);
    state.drawPile    = fresh;
    state.discardPile = [];
  } else {
    // Safety fallback — shouldn't happen in normal play
    const fresh = buildDeck();
    shuffle(fresh);
    state.drawPile = fresh;
  }
  state.reshuffleEvent = true;
  log(state, '⟳ Deck exhausted — discard pile reshuffled back in.');
}

function log(state, msg) {
  state.log.unshift(msg);
  if (state.log.length > 12) state.log.pop();
}

module.exports = {
  createGame, drawAndProcess, continueDeal,
  resolveFreeze, resolveFlipThree,
  nextActive, allDone, endRound, startNextRound, calcScore, resetGame,
};
