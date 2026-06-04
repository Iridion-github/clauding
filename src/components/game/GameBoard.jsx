import { useState } from 'react';
import { Button, Chip, Alert, Stack } from '@mui/material';
import { PlayerZone } from './PlayerZone';
import { formatCost } from './Card';
import './GameBoard.css';

const PHASE_LABELS = {
  untap: 'Untap', upkeep: 'Upkeep', draw: 'Draw',
  main1: 'Main 1', combat: 'Combat', main2: 'Main 2', end: 'End',
};

export function GameBoard({ gameState, playerId, isMyTurn, hasPriority, actionError, sendAction }) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [mode, setMode] = useState('select'); // 'select' | 'attack' | 'block'
  const [attackerIds, setAttackerIds] = useState([]);
  const [blockers, setBlockers] = useState({});

  const self = gameState.players[playerId];
  const opponentId = gameState.playerOrder.find(id => id !== playerId);
  const opponent = gameState.players[opponentId];

  // ── Card click routing ────────────────────────────────────────────────────

  function handleCardClick(card) {
    if (mode === 'attack') { toggleAttacker(card); return; }
    if (mode === 'block')  { handleBlockerAssign(card); return; }
    setSelectedCard(prev => prev?.id === card.id ? null : card);
  }

  function toggleAttacker(card) {
    if (card.tapped || card.type !== 'creature' || card.summoningSickness) return;
    setAttackerIds(prev =>
      prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]
    );
  }

  function handleBlockerAssign(card) {
    if (!selectedCard) {
      if (card.type === 'creature' && !card.tapped && self.battlefield.includes(card)) setSelectedCard(card);
      const onMyField = self.battlefield.some(c => c.id === card.id);
      if (card.type === 'creature' && !card.tapped && onMyField) setSelectedCard(card);
    } else {
      if (card.attacking) {
        setBlockers(prev => ({
          ...prev,
          [card.id]: [...(prev[card.id] || []), selectedCard.id],
        }));
        setSelectedCard(null);
      }
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function playLand() {
    sendAction({ type: 'PLAY_LAND', cardId: selectedCard.id });
    setSelectedCard(null);
  }

  function tapLandSelected() {
    sendAction({ type: 'TAP_LAND', cardId: selectedCard.id });
    setSelectedCard(null);
  }

  function tapCreatureSelected() {
    sendAction({ type: 'TAP_CREATURE', cardId: selectedCard.id });
    setSelectedCard(null);
  }

  function castSelected() {
    sendAction({ type: 'CAST_SPELL', cardId: selectedCard.id });
    setSelectedCard(null);
  }

  function confirmAttack() {
    sendAction({ type: 'ATTACK', attackerIds });
    setAttackerIds([]); setMode('select');
  }

  function confirmBlock() {
    sendAction({ type: 'BLOCK', blockers });
    setBlockers({}); setMode('select');
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const inHand       = self.hand.some(c => c.id === selectedCard?.id);
  const onMyField    = self.battlefield.some(c => c.id === selectedCard?.id);
  const inMainPhase  = ['main1', 'main2'].includes(gameState.phase);

  const isLandInHand   = inHand && selectedCard?.type === 'land';
  const isSpellInHand  = inHand && selectedCard?.type !== 'land';
  const isLandOnField  = onMyField && selectedCard?.type === 'land' && !selectedCard?.tapped;
  const isManaCreature = onMyField && selectedCard?.keywords?.includes('mana_ability') && !selectedCard?.tapped;

  const canPlayLand  = isMyTurn && hasPriority && inMainPhase && isLandInHand && !self.hasPlayedLand;
  const canCast      = hasPriority && isSpellInHand && (isMyTurn ? inMainPhase : selectedCard?.subtype?.includes('Instant'));
  const canTapLand   = isLandOnField;
  const canTapMana   = isManaCreature;

  return (
    <div className="game-board">
      {/* Status bar */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }} className="board-status">
        <PhaseTracker phase={gameState.phase} turn={gameState.turn} />
        <Chip
          label={isMyTurn ? 'Your turn' : `${opponent.name}'s turn`}
          size="small"
          color={isMyTurn ? 'secondary' : 'default'}
          variant="outlined"
        />
        {hasPriority && <Chip label="Priority" size="small" color="primary" />}
        {gameState.winner && (
          <Chip
            label={gameState.winner === playerId ? 'You win!' : `${opponent.name} wins!`}
            color="primary"
            sx={{ fontWeight: 'bold', fontSize: 14 }}
          />
        )}
      </Stack>

      {actionError && <Alert severity="warning" sx={{ py: 0 }}>{actionError}</Alert>}

      {/* Opponent side */}
      <PlayerZone
        player={opponent}
        isMe={false}
        selectedCard={selectedCard}
        onCardClick={handleCardClick}
        blockerIds={mode === 'block' ? Object.values(blockers).flat() : []}
      />

      {/* Action bar */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} className="board-actions">
        {mode === 'select' && <>
          {canPlayLand && <Button variant="contained" color="secondary" size="small" onClick={playLand}>Play {selectedCard.name}</Button>}
          {canTapLand  && <Button variant="outlined" size="small" onClick={tapLandSelected}>Tap for Mana</Button>}
          {canTapMana  && <Button variant="outlined" size="small" onClick={tapCreatureSelected}>Tap {selectedCard.name}</Button>}
          {canCast && (
            <Button variant="contained" color="secondary" size="small" onClick={castSelected}>
              Cast {selectedCard.name} ({formatCost(selectedCard.cost)})
            </Button>
          )}
          {isMyTurn && gameState.phase === 'combat' && !gameState.combatState && (
            <Button variant="outlined" size="small" onClick={() => setMode('attack')}>Declare Attackers</Button>
          )}
          {!isMyTurn && gameState.phase === 'combat' && gameState.combatState && (
            <Button variant="outlined" size="small" onClick={() => setMode('block')}>Declare Blockers</Button>
          )}
          {isMyTurn && gameState.combatState && (
            <Button variant="outlined" color="warning" size="small" onClick={() => sendAction({ type: 'RESOLVE_COMBAT' })}>Resolve Combat</Button>
          )}
          {hasPriority && !gameState.winner && <>
            {isMyTurn && <Button variant="outlined" size="small" onClick={() => { sendAction({ type: 'NEXT_PHASE' }); setSelectedCard(null); }}>Next Phase</Button>}
            <Button variant="outlined" size="small" onClick={() => { sendAction({ type: 'PASS_PRIORITY' }); setSelectedCard(null); }}>Pass Priority</Button>
          </>}
          <Button variant="outlined" color="error" size="small" onClick={() => sendAction({ type: 'CONCEDE' })}>Concede</Button>
        </>}

        {mode === 'attack' && <>
          <span className="mode-hint">Click your creatures to toggle attackers</span>
          <Button variant="contained" color="warning" size="small" onClick={confirmAttack} disabled={attackerIds.length === 0}>
            Confirm Attack ({attackerIds.length})
          </Button>
          <Button variant="outlined" size="small" onClick={() => { setMode('select'); setAttackerIds([]); }}>Cancel</Button>
        </>}

        {mode === 'block' && <>
          <span className="mode-hint">Select a blocker, then click an attacker to assign</span>
          <Button variant="contained" color="warning" size="small" onClick={confirmBlock}>Confirm Blocks</Button>
          <Button variant="outlined" size="small" onClick={() => { setMode('select'); setBlockers({}); setSelectedCard(null); }}>Cancel</Button>
        </>}
      </Stack>

      {/* My side */}
      <PlayerZone
        player={self}
        isMe={true}
        selectedCard={selectedCard}
        onCardClick={handleCardClick}
        attackerIds={mode === 'attack' ? attackerIds : []}
      />
    </div>
  );
}

function PhaseTracker({ phase, turn }) {
  return (
    <div className="phase-tracker">
      <span className="phase-turn">Turn {turn}</span>
      {Object.entries(PHASE_LABELS).map(([p, label]) => (
        <span key={p} className={`phase-pip${p === phase ? ' active' : ''}`}>{label}</span>
      ))}
    </div>
  );
}
