import { Box, Button, Fab, Slide, Typography } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';

// The debug actions, in display order. `bust` / `flip7` are purely-local animation
// previews; the rest are forced server outcomes (see DebugPanel's onAction routing).
const DEBUG_ACTIONS = [
  { key: 'bust',          label: 'Bust',       color: '#c62828' },
  { key: 'flip7',         label: 'Flip 7',     color: '#f0a020' },
  { key: 'reshuffle',     label: 'Reshuffle',  color: '#c8900a' },
  { key: 'freeze',        label: 'Freeze',     color: '#1565c0' },
  { key: 'flip3',         label: 'Flip 3',     color: '#6a1b9a' },
  { key: 'second_chance', label: '2nd Chance', color: '#2e7d32' },
  { key: 'win',           label: 'Win',        color: '#b8860b' },
];

// Solo-only debug menu: a small round button (mirrors the Soundboard's look, sitting
// just below it) that toggles a little panel of preview/force buttons. Bust and Flip 7
// just play their animation; Freeze / Flip 3 / 2nd Chance force that card to be drawn;
// Win jumps straight to the end screen. The parent wires `onAction(key)`.
export function DebugPanel({ onAction, open = false, onToggle, onClose }) {
  return (
    <>
      <Fab
        size="small"
        onClick={onToggle}
        aria-label={open ? 'Close debug menu' : 'Open debug menu'}
        sx={{
          // Sit just below the Soundboard button (which is vertically centred on the left).
          position: 'fixed', left: 16, top: '50%', transform: 'translateY(calc(-50% + 56px))',
          zIndex: 2600,
          color: '#1a1c20',
          background: 'linear-gradient(145deg, #ffe9a8 0%, #f0c040 42%, #b8860b 100%)',
          border: '1px solid rgba(255,255,255,0.5)',
          boxShadow:
            'inset 0 1px 1px rgba(255,255,255,0.85), inset 0 -2px 3px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.5)',
          '&:hover': {
            background: 'linear-gradient(145deg, #fff0c0 0%, #f6cd55 42%, #c8961a 100%)',
            boxShadow:
              'inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -2px 3px rgba(0,0,0,0.35), 0 5px 14px rgba(0,0,0,0.55)',
          },
          '&:active': {
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.5)',
          },
        }}
      >
        <BugReportIcon sx={{ filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.6))' }} />
      </Fab>

      {/* Transparent click-away catcher — keeps the game visible. */}
      {open && (
        <Box onClick={onClose} sx={{ position: 'fixed', inset: 0, zIndex: 2590 }} />
      )}

      {/* Panel pinned to the right of the button, vertically aligned with it. */}
      <Box
        sx={{
          position: 'fixed',
          left: 64,
          top: '50%',
          transform: 'translateY(calc(-50% + 56px))',
          zIndex: 2620,
        }}
      >
        <Slide direction="right" in={open} mountOnEnter unmountOnExit>
          <Box
            className="fh-bg"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              width: 140,
              px: 1.5,
              py: 1.25,
              borderRadius: 4,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.14)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
            }}
          >
            <Typography
              variant="overline"
              sx={{ color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, textAlign: 'center', lineHeight: 1.4 }}
            >
              Debug
            </Typography>

            {DEBUG_ACTIONS.map(({ key, label, color }) => (
              <Button
                key={key}
                fullWidth
                size="small"
                onClick={() => onAction?.(key)}
                sx={{
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  color: '#fff',
                  borderRadius: 2,
                  py: 0.6,
                  background: `linear-gradient(180deg, ${color} 0%, ${shade(color)} 100%)`,
                  border: '1px solid rgba(255,255,255,0.22)',
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.4), 0 3px 8px rgba(0,0,0,0.45)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                  transition: 'transform 120ms ease, box-shadow 120ms ease, filter 120ms ease',
                  '&:hover': {
                    filter: 'brightness(1.1)',
                    boxShadow: `inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -2px 4px rgba(0,0,0,0.4), 0 5px 12px rgba(0,0,0,0.5), 0 0 14px ${color}99`,
                  },
                  '&:active': {
                    transform: 'translateY(1px)',
                    boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.4)',
                  },
                }}
              >
                {label}
              </Button>
            ))}
          </Box>
        </Slide>
      </Box>
    </>
  );
}

// Darken a #rrggbb hex by ~35% for the button gradient's bottom stop.
function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 0xff) * 0.65);
  const g = Math.round(((n >> 8) & 0xff) * 0.65);
  const b = Math.round((n & 0xff) * 0.65);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
