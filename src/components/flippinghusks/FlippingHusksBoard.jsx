import { useEffect, useRef, useState } from 'react';
import { Chip, Stack, Typography, Box, useMediaQuery } from '@mui/material';
import { FlippingHusksCard } from './FlippingHusksCard';
import './FlippingHusksBoard.css';

const STATUS_COLOR = { active: 'default', stayed: 'success', busted: 'error', flippinghusks: 'primary' };
const STATUS_LABEL = { active: 'Playing', stayed: 'Stayed', busted: 'Bust!', flippinghusks: 'Flipping Husks!' };

// Live round score / unique count for a player (mirrors the server's scoring rules).
function calcDisplay(player) {
  if (player.status === 'busted') return { score: 0, uniq: 0, fh: false };
  const nums    = player.cards.filter(c => c.type === 'number');
  const numSum  = nums.reduce((s, c) => s + c.value, 0);
  const hasMult = player.cards.some(c => c.type === 'multiplier');
  const modSum  = player.cards.filter(c => c.type === 'modifier').reduce((s, c) => s + c.value, 0);
  const uniq    = new Set(nums.map(c => c.value)).size;
  const fh      = uniq >= 7;
  return { score: (hasMult ? numSum * 2 : numSum) + modSum + (fh ? 15 : 0), uniq, fh };
}

// Cap very long names so headers and (especially) the target buttons stay aligned.
function truncateName(name, max = 16) {
  if (!name) return '';
  return name.length > max ? name.slice(0, max - 1) + '…' : name;
}

export function FlippingHusksBoard({ gameState, playerId, connected = true, roomPlayers = [], isMyTurn, actionError, sendAction, playAgainVotes, votePlayAgain, nextRoundVotes, voteNextRound, nextRoundDeadline, leaveGameVotes = { votes: [], players: [] }, voteLeaveGame, withdrawLeaveGame, animating }) {
  const { players, playerOrder, activePlayerId, phase, round, drawPile, discardCount, log, winner, pendingAction } = gameState;
  const offlineIds = new Set(roomPlayers.filter(p => p.connected === false).map(p => p.id));
  const self = players[playerId];
  const opponents = playerOrder.filter(pid => pid !== playerId);
  const myPendingIsOpen = pendingAction != null && pendingAction.drawerId === playerId;
  const otherPending    = pendingAction != null && pendingAction.drawerId !== playerId;
  const hasVotedPlayAgain  = playAgainVotes.votes.includes(playerId);
  const hasVotedNextRound  = nextRoundVotes.votes.includes(playerId);
  const hasVotedLeave      = leaveGameVotes.votes.includes(playerId);
  // The "Leave Game" vote is only offered while a game is actively being played.
  const gameInProgress     = phase === 'playing' || phase === 'round_end';

  const isMobile = useMediaQuery('(orientation: portrait), (max-width: 640px)');
  const [logOpen, setLogOpen] = useState(false);

  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  return (
    <div className="fhboard">

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="fhboard-main">

        {/* Header */}
        <div className="fhboard-header">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <Chip label={`Round ${round}`} size="small" variant="outlined" />
              <Chip label={`Deck ${drawPile.length} · ${discardCount ?? 0} used`} size="small" variant="outlined" />
              {phase === 'round_end' && <Chip label="Round over" color="warning" size="small" />}
              {phase === 'finished'  && <Chip label={`${players[winner].name} wins!`} color="primary" />}
            </Stack>
            {/* Leave Game: top-right on desktop (the chips' flex:1 pushes it to the
                main column's right edge, just outside the log window); on mobile it
                sits to the left of the Log toggle. */}
            {gameInProgress && (
              <Chip
                className="fhleave-chip"
                label="Leave"
                size="small"
                onClick={voteLeaveGame}
                variant="outlined"
                sx={{ cursor: 'pointer', flexShrink: 0 }}
              />
            )}
            {isMobile && (
              <Chip
                className="fhlog-toggle"
                label={logOpen ? '✕ Log' : '📜 Log'}
                size="small"
                onClick={() => setLogOpen(o => !o)}
                color={logOpen ? 'primary' : 'default'}
                variant={logOpen ? 'filled' : 'outlined'}
                sx={{ cursor: 'pointer', flexShrink: 0 }}
              />
            )}
          </Box>
        </div>

        {/* Opponents */}
        {opponents.length > 0 && (
          <div className="fhboard-opponents">
            {opponents.map(pid => {
              const p = players[pid];
              const isActive = pid === activePlayerId && phase === 'playing';
              const { score, uniq } = calcDisplay(p);
              const toWin = Math.max(0, 200 - (p.totalScore ?? 0) - score);
              return (
                <div key={pid} className={`fhopponent${isActive ? ' active' : ''}`}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight="bold">{truncateName(p.name)}</Typography>
                    <Chip label={STATUS_LABEL[p.status]} color={STATUS_COLOR[p.status]} size="small" />
                    {offlineIds.has(pid) && <Chip label="offline" size="small" variant="outlined" />}
                    {isActive && <Chip label="▶" size="small" color="warning" variant="outlined" />}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                      {p.totalScore} pts
                    </Typography>
                  </Stack>
                  <div className="fhopponent-cards">
                    {p.cards.map(card => (
                      <div className="fhmini-card" key={card.id}>
                        <FlippingHusksCard card={card} small />
                      </div>
                    ))}
                    {p.cards.length === 0 && (
                      <Typography variant="caption" color="text.secondary" fontStyle="italic">No cards</Typography>
                    )}
                  </div>
                  <Typography variant="caption" color="text.secondary">
                    +{score} this round ({toWin} to 200) · {uniq}/7 unique
                    {p.secondChances > 0 && ` · ★×${p.secondChances}`}
                  </Typography>
                </div>
              );
            })}
          </div>
        )}

        {/* My area */}
        <div className="fhboard-me-wrap">
          <div className="fhboard-me">
            <div className="fhboard-me-header">
              <Typography variant="body1" fontWeight="bold" color="secondary.main">
                {truncateName(self?.name)} (you)
              </Typography>
              <Chip label={STATUS_LABEL[self?.status]} color={STATUS_COLOR[self?.status]} size="small" />
              {activePlayerId === playerId && phase === 'playing' && (
                <Chip label="▶ Your turn" size="small" color="warning" />
              )}
              <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                Total: <strong>{self?.totalScore ?? 0}</strong>
                {self && (() => {
                  const { score, uniq, fh } = calcDisplay(self);
                  const toWin = Math.max(0, 200 - (self.totalScore ?? 0) - score);
                  return <span style={{ marginLeft: 8 }}> · +{score} this round ({toWin} to 200) · {uniq}/7{fh ? ' 🎉' : ''}{self.secondChances > 0 ? ` · ★×${self.secondChances}` : ''}</span>;
                })()}
              </Typography>
            </div>
            <div className="fhboard-me-cards">
              {self?.cards.map(card => (
                <div className="fhme-card" key={card.id}>
                  <FlippingHusksCard card={card} />
                </div>
              ))}
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
      <div className={`fhboard-log-sidebar${isMobile && logOpen ? ' fhlog-open' : ''}`}>
        <div className="fhboard-log-title">Event Log</div>
        <div className="fhboard-log-entries" ref={logRef}>
          {[...log].reverse().map((entry, i) => (
            <div key={i} className="fhlog-entry">{entry}</div>
          ))}
        </div>
      </div>

      {/* ── "Your turn" banner at top ────────────────────────────────────── */}
      {isMyTurn && phase === 'playing' && !myPendingIsOpen && (
        <div className="fhturn-banner">⚡ Your Turn</div>
      )}

      {/* ── Connection-lost modal (blocks all interaction while reconnecting) ── */}
      {!connected && (
        <div className="fhreconnect-overlay">
          <div className="fhreconnect-box">
            <div className="fhreconnect-spinner" />
            <div className="fhreconnect-text">Attempting to reconnect</div>
          </div>
        </div>
      )}

      {/* ── Auto-advance countdown bar at top (round over → nobody can act) ─── */}
      {/* Rendered only once animations finish (the !animating gate), so the
          countdown starts *after* the round-ending animation, not during it. */}
      {phase === 'round_end' && !animating && (
        <NextRoundCountdown
          totalMs={5000}
          onExpire={voteNextRound}
        />
      )}

      {/* ── Fixed action bar (bottom of main column) ─────────────────────── */}
      {!myPendingIsOpen && (
        <FixedActionBar
          phase={phase} isMyTurn={isMyTurn} self={self}
          players={players} playerOrder={playerOrder}
          activePlayerId={activePlayerId} winner={winner}
          activePlayerOffline={offlineIds.has(activePlayerId)}
          sendAction={sendAction}
          hasVotedPlayAgain={hasVotedPlayAgain}
          votePlayAgain={votePlayAgain}
          playAgainVoteCount={playAgainVotes.votes.length}
          hasVotedNextRound={hasVotedNextRound}
          voteNextRound={voteNextRound}
          nextRoundVoteCount={nextRoundVotes.votes.length}
        />
      )}

      {/* ── Play Again modal ─────────────────────────────────────────────── */}
      {phase === 'finished' && hasVotedPlayAgain && (
        <PlayAgainModal
          votes={playAgainVotes.votes}
          players={playerOrder.map(pid => ({ id: pid, name: players[pid].name }))}
        />
      )}

      {/* ── Leave Game vote modal (button lives in the header) ───────────── */}
      {gameInProgress && hasVotedLeave && (
        <LeaveGameModal
          votes={leaveGameVotes.votes}
          players={playerOrder
            .filter(pid => !offlineIds.has(pid))
            .map(pid => ({ id: pid, name: players[pid].name }))}
          onClose={withdrawLeaveGame}
        />
      )}

      {/* ── Target picker (drawer chooses) ───────────────────────────────── */}
      {myPendingIsOpen && !animating && (
        <TargetPicker
          type={pendingAction.type}
          card={pendingAction.card}
          players={players}
          playerOrder={playerOrder}
          playerId={playerId}
          isMobile={isMobile}
          deckCount={drawPile.length}
          usedCount={discardCount ?? 0}
          onSelect={targetId => {
            const actionType = pendingAction.type === 'freeze' ? 'RESOLVE_FREEZE' : 'RESOLVE_FLIP_THREE';
            sendAction({ type: actionType, targetId });
          }}
        />
      )}

      {/* ── Observer modal (others watch while someone chooses) ───────────── */}
      {otherPending && !animating && (
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
function FixedActionBar({ phase, isMyTurn, self, players, playerOrder, activePlayerId, winner, activePlayerOffline, sendAction, hasVotedPlayAgain, votePlayAgain, playAgainVoteCount, hasVotedNextRound, voteNextRound, nextRoundVoteCount }) {
  if (phase === 'round_end') {
    return (
      <div className="fhaction-bar">
        <Scoreboard players={players} playerOrder={playerOrder} />
        <button
          className="fhaction-btn fhaction-btn-stay"
          onClick={voteNextRound}
          disabled={hasVotedNextRound}
        >
          <span className="fhaction-btn-icon">→</span>
          <span className="fhaction-btn-main">{hasVotedNextRound ? 'Waiting…' : 'Next Round'}</span>
          {hasVotedNextRound && (
            <span className="fhaction-btn-sub">{nextRoundVoteCount}/{playerOrder.length} ready</span>
          )}
        </button>
      </div>
    );
  }

  if (phase === 'finished') {
    return (
      <div className="fhaction-bar">
        <Scoreboard players={players} playerOrder={playerOrder} final />
        <button
          className="fhaction-btn fhaction-btn-stay"
          onClick={votePlayAgain}
          disabled={hasVotedPlayAgain}
        >
          <span className="fhaction-btn-icon">↺</span>
          <span className="fhaction-btn-main">{hasVotedPlayAgain ? 'Waiting…' : 'Play Again'}</span>
          <span className="fhaction-btn-sub">
            {hasVotedPlayAgain
              ? `${playAgainVoteCount}/${playerOrder.length} ready`
              : 'Start a new game'}
          </span>
        </button>
      </div>
    );
  }

  if (!isMyTurn) {
    return (
      <div className="fhaction-bar">
        <Typography className="fhaction-status">
          Waiting for {truncateName(players[activePlayerId]?.name) || '…'} to act…
          {activePlayerOffline && ' (reconnecting…)'}
        </Typography>
      </div>
    );
  }

  // My turn
  return (
    <div className="fhaction-bar">
      <button
        className="fhaction-btn fhaction-btn-hit"
        onClick={() => sendAction({ type: 'HIT' })}
      >
        <span className="fhaction-btn-main">Card</span>
      </button>
      <button
        className="fhaction-btn fhaction-btn-stay"
        disabled={self?.status !== 'active'}
        onClick={() => { new Audio('/sounds/chicken.mp3').play().catch(() => {}); sendAction({ type: 'STAY' }); }}
      >
        <span className="fhaction-btn-main">Stay</span>
      </button>
    </div>
  );
}

// ── Scoreboard ────────────────────────────────────────────────────────────────
function Scoreboard({ players, playerOrder, final = false }) {
  const sorted = [...playerOrder].sort((a, b) => players[b].totalScore - players[a].totalScore);
  return (
    <Box className="fhscoreboard">
      <Typography variant="body2" fontWeight="bold" mb={0.5}>
        {final ? '🏆 Final Scores' : 'Round scores:'}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {sorted.map((pid, i) => {
          const p = players[pid];
          return (
            <Chip key={pid}
              label={`${i + 1}. ${truncateName(p.name)}  +${p.roundScore ?? 0} → ${p.totalScore}`}
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

// ── Play Again modal ──────────────────────────────────────────────────────────
function PlayAgainModal({ votes, players }) {
  return (
    <div className="fhplay-again-overlay">
      <div className="fhplay-again-modal">
        <Typography variant="h6" sx={{ textAlign: 'center', mb: 2, fontWeight: 'bold' }}>
          ↺ Play Again?
        </Typography>
        <Stack spacing={1.5}>
          {players.map(p => {
            const ready = votes.includes(p.id);
            return (
              <div key={p.id} className={`fhplay-again-row ${ready ? 'ready' : 'waiting'}`}>
                <span className="fhplay-again-icon">{ready ? '✓' : '⏳'}</span>
                <span className="fhplay-again-name">{p.name}</span>
                <span className="fhplay-again-status">{ready ? 'Ready!' : 'Waiting…'}</span>
              </div>
            );
          })}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          {votes.length} / {players.length} ready
        </Typography>
      </div>
    </div>
  );
}

// ── Leave Game modal ──────────────────────────────────────────────────────────
// Mirrors the Play Again modal, but closable: closing withdraws this player's vote.
// When every online player has voted, the server tears the room down for everyone.
function LeaveGameModal({ votes, players, onClose }) {
  return (
    <div className="fhplay-again-overlay" onClick={onClose}>
      <div className="fhplay-again-modal fhleave-modal" onClick={e => e.stopPropagation()}>
        <button className="fhleave-close" onClick={onClose} aria-label="Close">×</button>
        <Typography variant="h6" sx={{ textAlign: 'center', mb: 2, fontWeight: 'bold' }}>
          🚪 Leave Game?
        </Typography>
        <Stack spacing={1.5}>
          {players.map(p => {
            const ready = votes.includes(p.id);
            return (
              <div key={p.id} className={`fhplay-again-row ${ready ? 'ready' : 'waiting'}`}>
                <span className="fhplay-again-icon">{ready ? '✓' : '⏳'}</span>
                <span className="fhplay-again-name">{p.name}</span>
                <span className="fhplay-again-status">{ready ? 'Wants to leave' : 'Still playing'}</span>
              </div>
            );
          })}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
          {votes.length} / {players.length} want to leave
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
          Everyone must agree. Close to keep playing.
        </Typography>
      </div>
    </div>
  );
}

// ── Next Round countdown bar ────────────────────────────────────────────────────
// Mounted only once the round-ending animations have finished, so the countdown
// starts from THIS moment (animation-end) rather than from when the round ended on
// the server. When it reaches zero it calls onExpire (casts this player's "Next
// Round" vote): once every client has expired/voted the server advances the round.
// Clients animate the same things, so their post-animation countdowns stay in sync.
function NextRoundCountdown({ totalMs, onExpire }) {
  const [target] = useState(() => Date.now() + totalMs);
  const [now, setNow] = useState(() => Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const msLeft  = Math.max(0, target - now);
  const seconds = Math.ceil(msLeft / 1000);
  const pct     = Math.max(0, Math.min(100, (msLeft / totalMs) * 100));

  useEffect(() => {
    if (msLeft === 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    }
  }, [msLeft, onExpire]);

  return (
    <div className="fhcountdown-bar" role="status" aria-live="polite">
      <div className="fhcountdown-fill" style={{ width: `${pct}%` }} />
      <span className="fhcountdown-text">
        {msLeft > 0
          ? `${seconds} second${seconds === 1 ? '' : 's'} to next round`
          : 'Starting next round…'}
      </span>
    </div>
  );
}

function TargetPicker({ type, card, players, playerOrder, playerId, isMobile, deckCount, usedCount, onSelect }) {
  const theme = PICKER_THEME[type] ?? PICKER_THEME.freeze;
  const onlySelf = playerOrder.filter(pid => players[pid].status === 'active').every(pid => pid === playerId);

  return (
    <div
      className="fhtarget-picker"
      style={{ '--picker-border': theme.border, '--picker-glow': theme.glow }}
    >
      {/* Deck status — first info at the top of the modal */}
      <div className="fhtarget-picker-deck">
        <span>Cards in deck: <b>{deckCount}</b></span>
        <span>Cards used: <b>{usedCount}</b></span>
      </div>

      <div className="fhtarget-picker-inner">

        {/* Card column — card centered, no standalone icon */}
        <div className="fhtarget-picker-card-col">
          {card && <FlippingHusksCard card={card} small={isMobile} />}
        </div>

        {/* Content column */}
        <div className="fhtarget-picker-content">
          <div className="fhtarget-picker-title" style={{ color: theme.accent }}>
            {theme.label}!
            <Typography variant="body2" color="text.secondary" sx={{ ml: 1, fontStyle: 'italic' }}>
              {onlySelf ? 'No other targets — you must target yourself' : 'Choose a target'}
            </Typography>
          </div>
          <p className="fhtarget-picker-hint">{theme.hint}</p>

          <div className="fhtarget-btns">
            {playerOrder.map(pid => {
              const p = players[pid];
              const isSelf = pid === playerId;
              const done   = p.status !== 'active';
              const round  = calcDisplay(p).score;
              return (
                <button
                  key={pid}
                  className="fhtarget-btn"
                  onClick={() => onSelect(pid)}
                  disabled={done}
                  style={{
                    borderColor: done ? '#555' : theme.border,
                    background: done ? '#2a2a2a' : isSelf ? 'transparent' : theme.border + 'cc',
                    color: done ? '#666' : theme.accent,
                  }}
                >
                  <span className="fhtarget-btn-head">
                    <span className="fhtarget-btn-icon">{theme.icon}</span>
                    <span className="fhtarget-btn-name">
                      {truncateName(p.name)}{isSelf && ' (you)'}
                    </span>
                    {done && (
                      <span className="fhtarget-btn-status">
                        {p.status === 'stayed' ? '✓ stayed' : '✗ bust'}
                      </span>
                    )}
                  </span>
                  <span className="fhtarget-btn-scores">
                    <span className="fhtarget-btn-score">Total Points: <b>{p.totalScore}</b></span>
                    <span className="fhtarget-btn-score">Round Points: <b>{round}</b></span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Observer modal ────────────────────────────────────────────────────────────
const TYPE_LABEL = { freeze: 'Freeze ❄', flip_three: 'Flip Three ↺' };

function ObserverModal({ drawerName, type, card }) {
  return (
    <div className="fhobserver-modal">
      <div className="fhobserver-inner">
        {card && <FlippingHusksCard card={card} small />}
        <Box>
          <Typography variant="body2" fontWeight="bold" color="warning.main">
            {truncateName(drawerName)} drew {TYPE_LABEL[type] ?? type}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            …and is choosing who to target.
          </Typography>
        </Box>
      </div>
    </div>
  );
}
