const {
  drawAndProcess, continueDeal, resolveFreeze, resolveFlipThree,
  nextActive, allDone, endRound, startNextRound,
} = require('./GameState');

function applyAction(state, playerId, action) {
  if (state.phase === 'finished') return err('Game is over.');

  // ── Pending action must be resolved first ─────────────────────────────────
  if (state.pendingAction) {
    const pa = state.pendingAction;

    if (pa.drawerId !== playerId) {
      return err(`Waiting for ${state.players[pa.drawerId].name} to resolve their ${pa.type}.`);
    }

    if (action.type === 'RESOLVE_FREEZE' && pa.type === 'freeze') {
      if (!action.targetId) return err('No target specified.');
      const next = clone(state);
      if (!resolveFreeze(next, playerId, action.targetId)) return err('Invalid freeze target.');
      advance(next);
      return ok(next);
    }

    if (action.type === 'RESOLVE_FLIP_THREE' && pa.type === 'flip_three') {
      if (!action.targetId) return err('No target specified.');
      const next = clone(state);
      if (!resolveFlipThree(next, playerId, action.targetId)) return err('Invalid Flip Three target.');
      advance(next);
      return ok(next);
    }

    return err(`Must resolve the pending ${pa.type} first.`);
  }

  // ── Normal actions ─────────────────────────────────────────────────────────
  if (action.type === 'NEXT_ROUND') {
    if (state.phase !== 'round_end') return err('Round is not over yet.');
    const next = clone(state);
    startNextRound(next);
    return ok(next);
  }

  if (state.phase !== 'playing')                    return err('Game is not in playing phase.');
  if (state.activePlayerId !== playerId)            return err('Not your turn.');
  if (state.players[playerId].status !== 'active') return err('You are not active.');

  const next = clone(state);

  if (action.type === 'HIT') {
    drawAndProcess(next, playerId);
    if (!next.pendingAction) advance(next);
  } else if (action.type === 'STAY') {
    next.players[playerId].status = 'stayed';
    next.log.unshift(`${next.players[playerId].name} stays.`);
    advance(next);
  } else {
    return err(`Unknown action: ${action.type}`);
  }

  return ok(next);
}

function advance(state) {
  if (state.phase !== 'playing') return;

  // If the initial deal was interrupted by a pending action, resume it now.
  if (state.dealQueue && state.dealQueue.length > 0) {
    continueDeal(state);
    // continueDeal sets activePlayerId if a new pendingAction arose;
    // otherwise find the first active player to start normal play.
    if (!state.pendingAction) {
      state.activePlayerId = nextActive(state, null);
    }
    return;
  }

  if (allDone(state)) {
    endRound(state);
  } else {
    state.activePlayerId = nextActive(state, state.activePlayerId);
  }
}

function clone(state) {
  const c = JSON.parse(JSON.stringify(state));
  c.secondChanceEvent = null; // never carry events into the next action
  c.reshuffleEvent    = null;
  return c;
}
function ok(state)    { return { ok: true, state }; }
function err(error)   { return { ok: false, error }; }

// ── Debug tools (solo play only — gated by the server) ──────────────────────────
// Force a specific outcome so the player can preview cards/animations on demand.
let _dbgUid = 0;
function dbgCard(type, value, label) {
  // Unique, non-colliding id (deck card ids are `c<n>`).
  return { id: `dbg${++_dbgUid}_${Date.now().toString(36)}`, type, value, label };
}

const DEBUG_DRAW_CARDS = {
  freeze:        () => dbgCard('freeze', 0, 'Freeze'),
  flip3:         () => dbgCard('flip_three', 0, 'Flip 3'),
  second_chance: () => dbgCard('second_chance', 0, '2nd Chance'),
};

function applyDebug(state, playerId, kind) {
  // Jump straight to a win: bank 200 pts and finish the game with this player on top.
  if (kind === 'win') {
    const next = clone(state);
    const p = next.players[playerId];
    if (!p) return err('No such player.');
    p.totalScore  = 200;
    p.roundScore  = p.roundScore ?? 0;
    next.pendingAction = null;
    next.dealQueue     = [];
    next.winner = playerId;
    next.phase  = 'finished';
    next.log.unshift(`Game over! ${p.name} wins!`);
    return ok(next);
  }

  // Card-draw kinds: force the chosen card onto the pile, then run the same path a
  // normal HIT takes (so freeze/flip_three raise their pendingAction target picker).
  const make = DEBUG_DRAW_CARDS[kind];
  if (!make) return err(`Unknown debug kind: ${kind}`);

  const next = clone(state);
  if (next.phase !== 'playing') return err('Game is not in playing phase.');
  const p = next.players[playerId];
  if (!p) return err('No such player.');

  // Make sure it's this player's active turn so the forced draw always applies.
  next.activePlayerId = playerId;
  p.status            = 'active';
  next.pendingAction  = null;

  next.drawPile.unshift(make());
  drawAndProcess(next, playerId);
  if (!next.pendingAction) advance(next);
  return ok(next);
}

module.exports = { applyAction, applyDebug };
