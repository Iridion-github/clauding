import { useState } from 'react';
import {
  Dialog, Box, Button, Typography, Stack, IconButton, Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { FlippingHusksCard } from './FlippingHusksCard';

// ── Card builders (match the shape FlippingHusksCard expects) ──────────────────
const num    = v => ({ type: 'number', value: v, label: String(v) });
const mod    = v => ({ type: 'modifier', value: v, label: `+${v}` });
const x2     = { type: 'multiplier', value: 2, label: 'x2' };
const freeze = { type: 'freeze', value: 0, label: 'Freeze' };
const flip3  = { type: 'flip_three', value: 0, label: 'Flip 3' };
const chance = { type: 'second_chance', value: 0, label: '2nd Chance' };

// ── Small layout helpers ───────────────────────────────────────────────────────
function CardRow({ cards, children }) {
  return (
    <Stack direction="row" spacing={1.2} sx={{ flexWrap: 'wrap', justifyContent: 'center', rowGap: 1.2 }}>
      {cards
        ? cards.map((c, i) => <FlippingHusksCard key={i} card={c} small />)
        : children}
    </Stack>
  );
}

// A card wrapped in a coloured glow — used to flag the "bad" duplicate, etc.
function GlowCard({ card, color }) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <FlippingHusksCard card={card} small />
      <Box sx={{
        position: 'absolute', inset: 0, borderRadius: '9px',
        border: `3px solid ${color}`, boxShadow: `0 0 16px ${color}`,
        pointerEvents: 'none',
      }} />
    </Box>
  );
}

function H({ children }) {
  return (
    <Typography variant="h5" color="primary" fontWeight="bold"
      sx={{ textShadow: '0 2px 16px rgba(240,192,64,0.3)' }}>
      {children}
    </Typography>
  );
}

function P({ children }) {
  return (
    <Typography variant="body1" color="text.primary" sx={{ maxWidth: 460, lineHeight: 1.6 }}>
      {children}
    </Typography>
  );
}

// ── The steps ──────────────────────────────────────────────────────────────────
const STEPS = [
  {
    title: 'The Goal',
    render: () => (
      <Stack spacing={2.5} alignItems="center">
        <H>Race to 200 points</H>
        <CardRow>
          <FlippingHusksCard card={num(0)} faceDown small />
        </CardRow>
        <P>
          Each round you <b>flip cards</b> to build a score. On your turn you choose
          to <b style={{ color: '#40c070' }}>Hit</b> (draw another card) or
          <b style={{ color: '#f0c040' }}> Stay</b> (lock in your points and sit out the rest of the round).
        </P>
        <P>The first player to reach <b>200 total points</b> across rounds wins the game.</P>
        <Stack direction="row" spacing={2}>
          <Chip label="HIT = draw a card" sx={{ bgcolor: 'rgba(64,192,112,0.18)', color: '#7fe0a5', fontWeight: 'bold' }} />
          <Chip label="STAY = bank your points" sx={{ bgcolor: 'rgba(240,192,64,0.18)', color: '#f0c040', fontWeight: 'bold' }} />
        </Stack>
      </Stack>
    ),
  },
  {
    title: 'Number Cards',
    render: () => (
      <Stack spacing={2.5} alignItems="center">
        <H>Numbers are your score</H>
        <CardRow cards={[num(3), num(7), num(12), num(0)]} />
        <P>
          Most cards are numbers from <b>0 to 12</b>. Every number you collect
          adds its value to your round score, so bigger numbers are worth more.
        </P>
        <P>The catch: the more you collect, the riskier the next flip becomes…</P>
      </Stack>
    ),
  },
  {
    title: 'Busting',
    render: () => (
      <Stack spacing={2.5} alignItems="center">
        <H>Beware of duplicates!</H>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <FlippingHusksCard card={num(7)} small />
          <Typography variant="h4" color="text.secondary">+</Typography>
          <GlowCard card={num(7)} color="#ff5252" />
        </Stack>
        <Chip label="BUST — 0 points this round" sx={{ bgcolor: 'rgba(255,82,82,0.2)', color: '#ff7b7b', fontWeight: 'bold' }} />
        <P>
          If you flip a number you <b>already have</b>, you <b style={{ color: '#ff7b7b' }}>bust</b> —
          you lose <b>all</b> points for the round. That's the press-your-luck tension:
          do you flip again, or stay safe?
        </P>
      </Stack>
    ),
  },
  {
    title: 'Flipping Husks!',
    render: () => (
      <Stack spacing={2.5} alignItems="center">
        <H>Collect 7 different numbers</H>
        <CardRow cards={[num(1), num(4), num(6), num(8), num(9), num(11), num(2)]} />
        <Chip label="FLIPPING HUSKS — +15 bonus!" sx={{ bgcolor: 'rgba(240,192,64,0.2)', color: '#f0c040', fontWeight: 'bold' }} />
        <P>
          Get <b>7 unique number cards</b> in one round and you score a
          <b style={{ color: '#f0c040' }}> +15 bonus</b> — and the round ends
          immediately for <b>everyone</b>. A huge swing if you can pull it off.
        </P>
      </Stack>
    ),
  },
  {
    title: 'Bonus Cards',
    render: () => (
      <Stack spacing={2.5} alignItems="center">
        <H>Boost your score</H>
        <CardRow cards={[mod(4), mod(10), x2]} />
        <P>
          <b style={{ color: '#f0c040' }}>+2 to +10</b> cards add straight to your total —
          and they can never make you bust, so they're always safe to keep.
        </P>
        <P>
          The <b style={{ color: '#f0c040' }}>×2</b> card <b>doubles</b> your number
          total. Combine it with a big hand for a massive round.
        </P>
      </Stack>
    ),
  },
  {
    title: 'Action Cards',
    render: () => (
      <Stack spacing={3} alignItems="center">
        <H>Cards that change the game</H>
        <Stack spacing={2.5} sx={{ width: '100%', maxWidth: 480 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <FlippingHusksCard card={freeze} small />
            <Box>
              <Typography fontWeight="bold" color="#7ec8ff">Freeze</Typography>
              <Typography variant="body2" color="text.secondary">
                Lock a player out for the round — pick anyone (even yourself) to
                instantly "stay" with their current score.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <FlippingHusksCard card={flip3} small />
            <Box>
              <Typography fontWeight="bold" color="#d6e02a">Flip Three</Typography>
              <Typography variant="body2" color="text.secondary">
                Force a player to flip <b>3 cards</b> in a row. A gift, or a trap that
                pushes a rival into a bust.
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <FlippingHusksCard card={chance} small />
            <Box>
              <Typography fontWeight="bold" color="#ff8a8a">Second Chance</Typography>
              <Typography variant="body2" color="text.secondary">
                Saves you from <b>one</b> bust — the duplicate is discarded and you
                play on. It's used up automatically when you need it.
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </Stack>
    ),
  },
  {
    title: 'Scoring Example',
    render: () => (
      <Stack spacing={2.5} alignItems="center">
        <H>How a round adds up</H>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', justifyContent: 'center', rowGap: 1 }}>
          <FlippingHusksCard card={num(3)} small />
          <FlippingHusksCard card={num(7)} small />
          <FlippingHusksCard card={num(5)} small />
          <Typography variant="h5" color="text.secondary">+</Typography>
          <FlippingHusksCard card={mod(4)} small />
          <Typography variant="h5" color="text.secondary">×</Typography>
          <FlippingHusksCard card={x2} small />
        </Stack>
        <Box sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 2, p: 2, maxWidth: 420, width: '100%' }}>
          <Stack spacing={0.5}>
            <Row label="Numbers 3 + 7 + 5" value="15" />
            <Row label="×2 doubles the numbers" value="30" />
            <Row label="then add the +4 bonus" value="34" />
            <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.15)', mt: 1, pt: 1 }}>
              <Row label="Round score" value="34" bold />
            </Box>
          </Stack>
        </Box>
        <P>The ×2 only multiplies your <b>numbers</b> — bonus cards are added afterward.</P>
      </Stack>
    ),
  },
  {
    title: 'You\'re Ready!',
    render: () => (
      <Stack spacing={2.5} alignItems="center">
        <H>That's the whole game</H>
        <Typography variant="h1" sx={{ fontSize: 64 }}>🌽</Typography>
        <P>
          <b>Hit</b> to chase points, <b>Stay</b> to keep them. Dodge duplicates,
          hunt for 7 unique numbers, and use action cards to swing the round.
        </P>
        <P>First to <b style={{ color: '#f0c040' }}>200</b> wins. Good luck!</P>
      </Stack>
    ),
  },
];

function Row({ label, value, bold }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline">
      <Typography variant="body2" color={bold ? 'text.primary' : 'text.secondary'} fontWeight={bold ? 'bold' : 'normal'}>
        {label}
      </Typography>
      <Typography variant={bold ? 'h6' : 'body1'} color={bold ? 'primary' : 'text.primary'} fontWeight="bold">
        {value}
      </Typography>
    </Stack>
  );
}

export function LearnToPlay({ open, onClose }) {
  const [step, setStep] = useState(0);
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;

  function handleClose() {
    onClose();
    // Reset to the start for next time, after the close animation.
    setTimeout(() => setStep(0), 250);
  }

  const current = STEPS[step];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen
      slotProps={{
        paper: {
          sx: {
            background: 'linear-gradient(160deg, #181818 0%, #111111 100%)',
            backgroundImage: 'linear-gradient(160deg, #181818 0%, #111111 100%)',
          },
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Stack direction="row" alignItems="center" justifyContent="space-between"
          sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <Typography variant="overline" color="text.secondary" letterSpacing={2}>
            How to Play · {step + 1} / {STEPS.length}
          </Typography>
          <IconButton onClick={handleClose} color="inherit" aria-label="Close tutorial">
            <CloseIcon />
          </IconButton>
        </Stack>

        {/* Content */}
        <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3, py: 4 }}>
          <Box sx={{ textAlign: 'center' }}>
            {current.render()}
          </Box>
        </Box>

        {/* Progress dots */}
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ pb: 1.5 }}>
          {STEPS.map((_, i) => (
            <Box key={i}
              onClick={() => setStep(i)}
              sx={{
                width: 9, height: 9, borderRadius: '50%', cursor: 'pointer',
                bgcolor: i === step ? 'primary.main' : 'rgba(255,255,255,0.22)',
                transition: 'background-color 0.2s',
              }}
            />
          ))}
        </Stack>

        {/* Footer nav */}
        <Stack direction="row" spacing={2} sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={isFirst}
            color="inherit"
            variant="outlined"
            sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.18)' }}
          >
            Back
          </Button>
          {isLast ? (
            <Button onClick={handleClose} variant="contained" color="secondary" sx={{ flex: 1 }}>
              Let's Play!
            </Button>
          ) : (
            <Button
              endIcon={<ArrowForwardIcon />}
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              variant="contained"
              color="primary"
              sx={{ flex: 1 }}
            >
              Next
            </Button>
          )}
        </Stack>
      </Box>
    </Dialog>
  );
}
