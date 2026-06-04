const { nextPhase, drawCard, getOpponentId, rebuildMaxMana, PHASES } = require('./GameState');

function applyAction(state, playerId, action) {
  if (state.winner) return err('Game is already over.');
  if (state.priorityPlayerId !== playerId) return err("Not your priority.");

  switch (action.type) {
    case 'PLAY_LAND':       return playLand(state, playerId, action);
    case 'TAP_LAND':        return tapPermanent(state, playerId, action);
    case 'TAP_CREATURE':    return tapCreatureForMana(state, playerId, action);
    case 'CAST_SPELL':      return castSpell(state, playerId, action);
    case 'ATTACK':          return declareAttackers(state, playerId, action);
    case 'BLOCK':           return declareBlockers(state, playerId, action);
    case 'RESOLVE_COMBAT':  return resolveCombat(state, playerId);
    case 'PASS_PRIORITY':   return passPriority(state, playerId);
    case 'NEXT_PHASE':      return advancePhase(state, playerId);
    case 'CONCEDE':         return concede(state, playerId);
    default:                return err(`Unknown action: ${action.type}`);
  }
}

// ── Land actions ────────────────────────────────────────────────────────────

function playLand(state, playerId, action) {
  const player = state.players[playerId];
  if (!['main1', 'main2'].includes(state.phase)) return err('Can only play lands during main phases.');
  if (state.activePlayerId !== playerId) return err('Not your turn.');
  if (player.hasPlayedLand) return err('Already played a land this turn.');

  const cardIdx = player.hand.findIndex(c => c.id === action.cardId);
  if (cardIdx === -1) return err('Card not in hand.');
  const card = player.hand[cardIdx];
  if (card.type !== 'land') return err('Not a land card.');

  const newState = cloneState(state);
  const p = newState.players[playerId];
  p.hand.splice(cardIdx, 1);
  p.battlefield.push({ ...card, tapped: false });
  p.hasPlayedLand = true;
  rebuildMaxMana(newState, playerId);

  return ok(newState);
}

function tapPermanent(state, playerId, action) {
  const player = state.players[playerId];
  const idx = player.battlefield.findIndex(c => c.id === action.cardId);
  if (idx === -1) return err('Card not on your battlefield.');
  const card = player.battlefield[idx];
  if (card.tapped) return err('Already tapped.');
  if (card.type !== 'land') return err('Not a land.');

  const newState = cloneState(state);
  const p = newState.players[playerId];
  p.battlefield[idx] = { ...card, tapped: true };
  if (card.produces) {
    p.mana[card.produces] = (p.mana[card.produces] || 0) + 1;
  }
  return ok(newState);
}

function tapCreatureForMana(state, playerId, action) {
  const player = state.players[playerId];
  const idx = player.battlefield.findIndex(c => c.id === action.cardId);
  if (idx === -1) return err('Card not on your battlefield.');
  const card = player.battlefield[idx];
  if (card.tapped) return err('Already tapped.');
  if (!card.keywords?.includes('mana_ability')) return err('This creature cannot tap for mana.');

  const newState = cloneState(state);
  const p = newState.players[playerId];
  p.battlefield[idx] = { ...card, tapped: true };
  if (card.produces) {
    p.mana[card.produces] = (p.mana[card.produces] || 0) + 1;
  }
  return ok(newState);
}

// ── Spell casting ────────────────────────────────────────────────────────────

function castSpell(state, playerId, action) {
  const player = state.players[playerId];
  const isInstant = action.instantSpeed === true;

  if (state.activePlayerId !== playerId && !isInstant) {
    return err("Can only cast instants on opponent's turn.");
  }

  const cardIdx = player.hand.findIndex(c => c.id === action.cardId);
  if (cardIdx === -1) return err('Card not in hand.');
  const card = player.hand[cardIdx];

  const affordable = canAfford(player.mana, card.cost);
  if (!affordable.ok) return err(affordable.error);

  const newState = cloneState(state);
  const p = newState.players[playerId];
  spendMana(p, card.cost);
  p.hand.splice(cardIdx, 1);

  newState.stack.push({ card, playerId, targetId: action.targetId });
  resolveTop(newState); // simplified: no stack waiting

  return ok(newState);
}

function resolveTop(state) {
  if (state.stack.length === 0) return;
  const { card, playerId, targetId } = state.stack.pop();

  if (card.type === 'creature') {
    state.players[playerId].battlefield.push({
      ...card,
      summoningSickness: !card.keywords?.includes('haste'),
      tapped: false,
    });
    triggerETB(state, playerId, card);
  } else if (card.type === 'spell') {
    resolveSpellEffect(state, card, playerId, targetId);
    state.players[playerId].graveyard.push(card);
  }
}

function triggerETB(state, playerId, card) {
  // ETB effects
  switch (card.definitionId) {
    case 'llanowar_elves':
      // No ETB, just a mana ability
      break;
    case 'burning_tree_emissary': {
      // Adds RG to mana pool
      const p = state.players[playerId];
      p.mana.red = (p.mana.red || 0) + 1;
      p.mana.green = (p.mana.green || 0) + 1;
      break;
    }
    default:
      break;
  }
}

function resolveSpellEffect(state, card, playerId, targetId) {
  const opponentId = getOpponentId(state, playerId);

  switch (card.definitionId) {
    case 'lightning_bolt':
    case 'lava_spike':
    case 'rift_bolt':
    case 'shard_volley':
    case 'chain_lightning':
      applyDamage(state, targetId || opponentId, 3);
      break;
    case 'skullcrack':
      applyDamage(state, targetId || opponentId, 3);
      // Life gain prevention: state flag (not yet tracked)
      break;
    case 'searing_blaze':
      applyDamage(state, opponentId, 1);
      if (targetId) applyDamage(state, targetId, 3);
      break;
    case 'light_up_the_stage':
      drawCard(state, playerId);
      drawCard(state, playerId);
      break;
    case 'aspect_of_hydra': {
      // +X/+X where X = green devotion (count green pips on permanents)
      const devotion = countDevotion(state, playerId, 'green');
      applyPump(state, playerId, targetId, devotion, devotion);
      break;
    }
    case 'vines_of_vastwood':
      applyPump(state, playerId, targetId, 4, 4);
      break;
    case 'giant_growth':
      applyPump(state, playerId, targetId, 3, 3);
      break;
    default:
      break;
  }
}

function applyPump(state, playerId, targetId, power, toughness) {
  if (!targetId) return;
  for (const pid of state.playerOrder) {
    const idx = state.players[pid].battlefield.findIndex(c => c.id === targetId);
    if (idx !== -1) {
      const c = state.players[pid].battlefield[idx];
      state.players[pid].battlefield[idx] = {
        ...c,
        power: (c.power || 0) + power,
        toughness: (c.toughness || 0) + toughness,
        tempPowerBonus: (c.tempPowerBonus || 0) + power,
        tempToughnessBonus: (c.tempToughnessBonus || 0) + toughness,
      };
      return;
    }
  }
}

function countDevotion(state, playerId, color) {
  let count = 0;
  for (const card of state.players[playerId].battlefield) {
    if (card.cost && typeof card.cost === 'object') {
      count += card.cost[color] || 0;
    }
  }
  return count;
}

// ── Damage & death ───────────────────────────────────────────────────────────

function applyDamage(state, targetId, amount, sourceKeywords = []) {
  // Target is a player
  if (state.players[targetId]) {
    state.players[targetId].life -= amount;
    if (state.players[targetId].life <= 0) {
      state.winner = getOpponentId(state, targetId);
    }
    return;
  }
  // Target is a creature on the battlefield
  for (const pid of state.playerOrder) {
    const idx = state.players[pid].battlefield.findIndex(c => c.id === targetId);
    if (idx !== -1) {
      const creature = state.players[pid].battlefield[idx];
      if (creature.keywords?.includes('indestructible')) return; // immune to damage-based destruction
      creature.damage += amount;
      const isLethal = sourceKeywords.includes('deathtouch')
        ? creature.damage > 0
        : creature.damage >= creature.toughness;
      if (isLethal) {
        state.players[pid].battlefield.splice(idx, 1);
        handleDeath(state, pid, creature);
      }
      return;
    }
  }
}

function handleDeath(state, playerId, card) {
  // Death triggers
  switch (card.definitionId) {
    case 'rancor':
      state.players[playerId].hand.push({ ...card, tapped: false, damage: 0, summoningSickness: false });
      return;
    default:
      break;
  }
  state.players[playerId].graveyard.push(card);
}

// ── Combat ───────────────────────────────────────────────────────────────────

function declareAttackers(state, playerId, action) {
  if (state.phase !== 'combat') return err('Not combat phase.');
  if (state.activePlayerId !== playerId) return err('Not your turn.');

  const newState = cloneState(state);
  const p = newState.players[playerId];

  for (const cardId of action.attackerIds) {
    const idx = p.battlefield.findIndex(c => c.id === cardId);
    if (idx === -1) return err(`Attacker not found.`);
    const card = p.battlefield[idx];
    if (card.type !== 'creature') return err('Can only attack with creatures.');
    if (card.summoningSickness) return err(`${card.name} has summoning sickness.`);
    if (card.tapped) return err(`${card.name} is already tapped.`);

    const doesntTap = card.keywords?.includes('vigilance');
    p.battlefield[idx] = { ...card, attacking: true, tapped: !doesntTap };
  }

  newState.combatState = { attackerIds: action.attackerIds, blockers: {} };
  newState.priorityPlayerId = getOpponentId(newState, playerId);
  return ok(newState);
}

function declareBlockers(state, playerId, action) {
  if (!state.combatState) return err('No attackers declared.');
  const newState = cloneState(state);

  // Validate: Steel Leaf Champion can't be blocked by power 2 or less
  const attackingId = getOpponentId(newState, playerId);
  for (const [attackerId, blockerIds] of Object.entries(action.blockers)) {
    const attacker = findCreature(newState, attackingId, attackerId);
    if (attacker?.keywords?.includes('unblockable_by_small')) {
      for (const bId of blockerIds) {
        const blocker = findCreature(newState, playerId, bId);
        if (blocker && blocker.power <= 2) {
          return err(`${attacker.name} can't be blocked by creatures with power 2 or less.`);
        }
      }
    }
  }

  newState.combatState.blockers = action.blockers;
  return ok(newState);
}

function resolveCombat(state, playerId) {
  if (!state.combatState) return err('No combat to resolve.');
  if (state.activePlayerId !== playerId) return err('Not your turn.');

  const newState = cloneState(state);
  const attackingId = newState.activePlayerId;
  const defendingId = getOpponentId(newState, attackingId);
  const { attackerIds, blockers } = newState.combatState;

  for (const aId of attackerIds) {
    const attacker = findCreature(newState, attackingId, aId);
    if (!attacker) continue;

    const blockersForThis = (blockers[aId] || [])
      .map(bId => findCreature(newState, defendingId, bId))
      .filter(Boolean);

    if (blockersForThis.length === 0) {
      // Unblocked
      applyDamage(newState, defendingId, attacker.power, attacker.keywords || []);
    } else {
      const hasTramp = attacker.keywords?.includes('trample');
      let attackerPowerLeft = attacker.power;

      // Assign attacker damage to blockers
      for (const blocker of blockersForThis) {
        const dmg = Math.min(attackerPowerLeft, blocker.toughness - blocker.damage);
        applyDamage(newState, blocker.id, dmg, attacker.keywords || []);
        attackerPowerLeft -= dmg;
      }

      // Trample overflow
      if (hasTramp && attackerPowerLeft > 0) {
        applyDamage(newState, defendingId, attackerPowerLeft, attacker.keywords || []);
      }

      // Blockers deal damage back to attacker
      for (const blocker of blockersForThis) {
        if (findCreature(newState, defendingId, blocker.id)) { // still alive
          applyDamage(newState, aId, blocker.power, blocker.keywords || []);
        }
      }
    }

    markCreature(newState, attackingId, aId, { attacking: false });
  }

  // Clear damage at end of combat (damage is not persistent between combats in MtG)
  for (const pid of newState.playerOrder) {
    newState.players[pid].battlefield = newState.players[pid].battlefield.map(c =>
      c.type === 'creature' ? { ...c, damage: 0 } : c
    );
  }

  newState.combatState = null;
  newState.priorityPlayerId = newState.activePlayerId;
  return ok(newState);
}

// ── Priority / phases ────────────────────────────────────────────────────────

function passPriority(state, playerId) {
  const newState = cloneState(state);
  if (newState.stack.length > 0) resolveTop(newState);
  newState.priorityPlayerId = getOpponentId(newState, playerId);
  return ok(newState);
}

function advancePhase(state, playerId) {
  if (state.activePlayerId !== playerId) return err('Not your turn.');
  return ok(nextPhase(cloneState(state)));
}

function concede(state, playerId) {
  const newState = cloneState(state);
  newState.winner = getOpponentId(newState, playerId);
  return ok(newState);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function canAfford(mana, cost) {
  if (!cost) return { ok: true };
  for (const [color, amount] of Object.entries(cost)) {
    if ((mana[color] || 0) < amount) {
      return { ok: false, error: `Not enough ${color} mana (need ${amount}, have ${mana[color] || 0}).` };
    }
  }
  return { ok: true };
}

function spendMana(player, cost) {
  if (!cost) return;
  for (const [color, amount] of Object.entries(cost)) {
    player.mana[color] = (player.mana[color] || 0) - amount;
  }
}

function findCreature(state, playerId, cardId) {
  return state.players[playerId].battlefield.find(c => c.id === cardId) || null;
}

function markCreature(state, playerId, cardId, updates) {
  const idx = state.players[playerId].battlefield.findIndex(c => c.id === cardId);
  if (idx !== -1) {
    state.players[playerId].battlefield[idx] = {
      ...state.players[playerId].battlefield[idx],
      ...updates,
    };
  }
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function ok(state) { return { ok: true, state }; }
function err(error) { return { ok: false, error }; }

module.exports = { applyAction };
