import { useEffect, useRef } from 'react';
import { Button, Chip, Stack, Typography, Box } from '@mui/material';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { Flip7Card } from './Flip7Card';
import './Flip7Board.css';

const STATUS_COLOR = { active: 'default', stayed: 'success', busted: 'error', flip7: 'primary' };
const STATUS_LABEL = { active: 'Playing', stayed: 'Stayed', busted: 'Bust!', flip7: 'Flip 7!' };

export function Flip7Board({ gameState, playerId, isMyTurn, actionError, sendAction }) {
  const { players, playerOrder, activePlayerId, phase, round, drawPile, log, winner, pendingAction } = gameState;
  const self = players[playerId];
  const opponents = playerOrder.filter(pid => pid !== playerId);
  const myPendingIsOpen = pendingAction != null && pendingAction.drawerId === playerId;
  const otherPending    = pendingAction != null && pendingAction.drawerId !== playerId;

  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function calcDisplay(player) {
    if (player.status === 'busted') return { score: 0, uniq: 0, f7: false };
    const nums    = player.cards.filter(c => c.type === 'number');
    const numSum  = nums.reduce((s, c) => s + c.value, 0);
    const hasMult = player.cards.some(c => c.type === 'multiplier');
    const modSum  = player.cards.filter(c => c.type === 'modifier').reduce((s, c) => s + c.value, 0);
    const uniq    = new Set(nums.map(c => c.value)).size;
    const f7      = uniq >= 7;
    return { score: (hasMult ? numSum * 2 : numSum) + modSum + (f7 ? 15 : 0), uniq, f7 };
  }

  return (
    <div className="f7board">

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="f7board-main">

        {/* Header */}
        <div className="f7board-header">
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h6" color="primary" fontWeight="bold">Flip 7</Typography>
            <Chip label={`Round ${round}`} size="small" variant="outlined" />
            <Chip label={`Deck: ${drawPile.length}`} size="small" variant="outlined" />
            {phase === 'round_end' && <Chip label="Round over" color="warning" size="small" />}
            {phase === 'finished'  && <Chip label={`${players[winner].name} wins!`} color="primary" />}
          </Stack>
        </div>

        {/* Opponents */}
        {opponents.length > 0 && (
          <div className="f7board-opponents">
            {opponents.map(pid => {
              const p = players[pid];
              const isActive = pid === activePlayerId && phase === 'playing';
              const { score, uniq } = calcDisplay(p);
              return (
                <div key={pid} className={`f7opponent${isActive ? ' active' : ''}`}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight="bold">{p.name}</Typography>
                    <Chip label={STATUS_LABEL[p.status]} color={STATUS_COLOR[p.status]} size="small" />
                    {isActive && <Chip label="▶" size="small" color="warning" variant="outlined" />}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                      {p.totalScore} pts
                    </Typography>
                  </Stack>
                  <div className="f7opponent-cards">
                    {p.cards.map(card => <Flip7Card key={card.id} card={card} small />)}
                    {p.cards.length === 0 && (
                      <Typography variant="caption" color="text.secondary" fontStyle="italic">No cards</Typography>
                    )}
                  </div>
                  <Typography variant="caption" color="text.secondary">
                    ~{score} pts · {uniq}/7 unique
                    {p.secondChances > 0 && ` · ★×${p.secondChances}`}
                  </Typography>
                </div>
              );
            })}
          </div>
        )}

        {/* My area */}
        <div className="f7board-me-wrap">
          <div className="f7board-me">
            <div className="f7board-me-header">
              <Typography variant="body1" fontWeight="bold" color="secondary.main">
                {self?.name} (you)
              </Typography>
              <Chip label={STATUS_LABEL[self?.status]} color={STATUS_COLOR[self?.status]} size="small" />
              {activePlayerId === playerId && phase === 'playing' && (
                <Chip label="▶ Your turn" size="small" color="warning" />
              )}
              <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                Total: <strong>{self?.totalScore ?? 0}</strong>
                {self && (() => {
                  const { score, uniq, f7 } = calcDisplay(self);
                  return <span style={{ marginLeft: 8 }}>· ~{score} this round · {uniq}/7{f7 ? ' 🎉' : ''}{self.secondChances > 0 ? ` · ★×${self.secondChances}` : ''}</span>;
                })()}
              </Typography>
            </div>
            <div className="f7board-me-cards">
              {self?.cards.map(card => <Flip7Card key={card.id} card={card} />)}
              {self?.cards.length === 0 && (
                <Typography variant="caption" color="text.secondary" fontStyle="italic">
                  No cards yet this round
                </Typography>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Log sidebar ─────────────────────────────────────────────────── */}
      <div className="f7board-log-sidebar">
        <div className="f7board-log-title">Event Log</div>
        <div className="f7board-log-entries" ref={logRef}>
          {[...log].reverse().map((entry, i) => (
            <div key={i} className="f7log-entry">{entry}</div>
          ))}
        </div>
      </div>

      {/* ── "Your turn" banner at top ────────────────────────────────────── */}
      {isMyTurn && phase === 'playing' && !myPendingIsOpen && (
        <div className="f7turn-banner">⚡ Your Turn</div>
      )}

      {/* ── Fixed action bar (bottom of main column) ─────────────────────── */}
      {!myPendingIsOpen && (
        <FixedActionBar
          phase={phase} isMyTurn={isMyTurn} self={self}
          players={players} playerOrder={playerOrder}
          activePlayerId={activePlayerId} winner={winner}
          sendAction={sendAction}
        />
      )}

      {/* ── Target picker (drawer chooses) ───────────────────────────────── */}
      {myPendingIsOpen && (
        <TargetPicker
          type={pendingAction.type}
          card={pendingAction.card}
          players={players}
          playerOrder={playerOrder}
          playerId={playerId}
          onSelect={targetId => {
            const actionType = pendingAction.type === 'freeze' ? 'RESOLVE_FREEZE' : 'RESOLVE_FLIP_THREE';
            sendAction({ type: actionType, targetId });
          }}
        />
      )}

      {/* ── Observer modal (others watch while someone chooses) ───────────── */}
      {otherPending && (
        <ObserverModal
          drawerName={players[pendingAction.drawerId]?.name}
          type={pendingAction.type}
          card={pendingAction.card}
        />
      )}

    </div>
  );
}

// ── Fixed bottom action bar ───────────────────────────────────────────────────
function FixedActionBar({ phase, isMyTurn, self, players, playerOrder, activePlayerId, winner, sendAction }) {
  if (phase === 'round_end') {
    return (
      <div className="f7action-bar">
        <Scoreboard players={players} playerOrder={playerOrder} />
        <Button variant="contained" color="primary" size="large"
          onClick={() => sendAction({ type: 'NEXT_ROUND' })}>
          Next Round →
        </Button>
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="f7action-bar">
        <Scoreboard players={players} playerOrder={playerOrder} final />
      </div>
    );
  }

  if (!isMyTurn) {
    return (
      <div className="f7action-bar">
        <Typography className="f7action-status">
          Waiting for {players[activePlayerId]?.name ?? '…'} to act…
        </Typography>
      </div>
    );
  }

  // My turn
  return (
    <div className="f7action-bar">
      <button
        className="f7action-btn f7action-btn-hit"
        onClick={() => sendAction({ type: 'HIT' })}
      >
        <span className="f7action-btn-icon">🃏</span>
        <span className="f7action-btn-main">Hit</span>
        <span className="f7action-btn-sub">Draw a card</span>
      </button>
      <button
        className="f7action-btn f7action-btn-stay"
        disabled={self?.status !== 'active'}
        onClick={() => sendAction({ type: 'STAY' })}
      >
        <span className="f7action-btn-icon">✋</span>
        <span className="f7action-btn-main">Stay</span>
        <span className="f7action-btn-sub">Bank your points</span>
      </button>
    </div>
  );
}

// ── Scoreboard ────────────────────────────────────────────────────────────────
function Scoreboard({ players, playerOrder, final = false }) {
  const sorted = [...playerOrder].sort((a, b) => players[b].totalScore - players[a].totalScore);
  return (
    <Box>
      <Typography variant="body2" fontWeight="bold" mb={0.5}>
        {final ? '🏆 Final Scores' : 'Round scores:'}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {sorted.map((pid, i) => {
          const p = players[pid];
          return (
            <Chip key={pid}
              label={`${i + 1}. ${p.name}  +${p.roundScore ?? 0} → ${p.totalScore}`}
              color={i === 0 ? 'primary' : 'default'}
              variant={i === 0 ? 'filled' : 'outlined'}
              size="small"
            />
          );
        })}
      </Stack>
    </Box>
  );
}

// ── Target picker ─────────────────────────────────────────────────────────────
const PICKER_THEME = {
  freeze:    { border: '#1565c0', glow: 'rgba(21,101,192,0.6)', accent: '#64b5f6', icon: '❄', label: 'FREEZE', hint: 'Target is forced to stay. You can target yourself to bank your score.' },
  flip_three:{ border: '#6a1b9a', glow: 'rgba(106,27,154,0.6)', accent: '#ce93d8', icon: '↺', label: 'FLIP THREE', hint: 'Target draws 3 forced cards. You can target yourself.' },
};

function TargetPicker({ type, card, players, playerOrder, playerId, onSelect }) {
  const theme = PICKER_THEME[type] ?? PICKER_THEME.freeze;

  return (
    <div
      className="f7target-picker"
      style={{ '--picker-border': theme.border, '--picker-glow': theme.glow }}
    >
      <div className="f7target-picker-inner">

        {/* Card + icon column */}
        <div className="f7target-picker-card-col">
          <Typography sx={{ color: theme.accent, fontSize: 28, lineHeight: 1 }}>{theme.icon}</Typography>
          {card && <Flip7Card card={card} />}
        </div>

        {/* Content column */}
        <div className="f7target-picker-content">
          <div className="f7target-picker-title" style={{ color: theme.accent }}>
            {theme.label}!
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1, fontStyle: 'italic' }}>
              Choose a target
            </Typography>
          </div>
          <p className="f7target-picker-hint">{theme.hint}</p>

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            {playerOrder.map(pid => {
              const p = players[pid];
              const isSelf = pid === playerId;
              const done   = p.status !== 'active';
              return (
                <button
                  key={pid}
                  className="f7target-btn"
                  onClick={() => onSelect(pid)}
                  style={{
                    borderColor: theme.border,
                    background: isSelf ? 'transparent' : theme.border + 'cc',
                    color: theme.accent,
                  }}
                >
                  {theme.icon}
                  {p.name}
                  {isSelf && ' (you)'}
                  {done && <span className="f7target-btn-status"> {p.status === 'stayed' ? '✓stayed' : '✗bust'}</span>}
                </button>
              );
            })}
          </Stack>
        </div>

      </div>
    </div>
  );
}

// ── Observer modal ────────────────────────────────────────────────────────────
const TYPE_LABEL = { freeze: 'Freeze ❄', flip_three: 'Flip Three ↺' };

function ObserverModal({ drawerName, type, card }) {
  return (
    <div className="f7observer-modal">
      <div className="f7observer-inner">
        {card && <Flip7Card card={card} small />}
        <Box>
          <Typography variant="body2" fontWeight="bold" color="warning.main">
            {drawerName} drew {TYPE_LABEL[type] ?? type}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            …and is choosing who to target.
          </Typography>
        </Box>
      </div>
    </div>
  );
}
