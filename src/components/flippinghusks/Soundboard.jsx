import { useEffect, useRef, useState } from 'react';
import { Box, Button, Fab, Slide, Tooltip, Typography } from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import CampaignIcon from '@mui/icons-material/Campaign';
import AddIcon from '@mui/icons-material/Add';
import { EMOTES, SOUND_COST } from './emotes';

// Hidden cheat: pressing the CHEAT_KEY this many times within this window reveals a
// "+" button in the Soundboard that grants free SP.
const CHEAT_KEY = 'p';
const CHEAT_PRESSES = 5;
const CHEAT_WINDOW_MS = 3000;

// In-game Soundboard: a small round button that toggles a little bottom panel of
// sound buttons. Playing a sound costs SP and is heard by everyone in the room, but
// only one sound can play room-wide at a time (the server enforces both). The SP
// counter is only shown here, so it's only visible while the panel is open. The
// panel uses the same themed backdrop as the playing field (the `fh-bg` class).
export function Soundboard({ playSound, stopSound, canStop = false, sp = 0, soundPlaying = false, onCheat }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false); // optimistic local lock between click and approval
  const [cheatUnlocked, setCheatUnlocked] = useState(false);
  const pendingTimer = useRef(null);

  // Once a sound actually starts (or on unmount), drop the optimistic lock.
  useEffect(() => {
    if (soundPlaying) { clearTimeout(pendingTimer.current); setPending(false); }
  }, [soundPlaying]);
  useEffect(() => () => clearTimeout(pendingTimer.current), []);

  // Cheat detection: watch for the CHEAT_KEY pressed CHEAT_PRESSES times within
  // CHEAT_WINDOW_MS. Auto-repeat (holding the key) and typing in fields don't count.
  // Once unlocked it stays unlocked for the rest of the game.
  const cheatTimesRef = useRef([]);
  useEffect(() => {
    if (cheatUnlocked) return;
    function onKeyDown(e) {
      if (e.repeat) return;
      if (e.key.toLowerCase() !== CHEAT_KEY) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      const now = Date.now();
      const times = [...cheatTimesRef.current, now].filter(t => now - t <= CHEAT_WINDOW_MS);
      cheatTimesRef.current = times;
      if (times.length >= CHEAT_PRESSES) setCheatUnlocked(true);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cheatUnlocked]);

  const canAfford = sp >= SOUND_COST;
  const locked = soundPlaying || pending || !canAfford;

  function trigger(key) {
    if (soundPlaying || pending || !canAfford) return;
    setPending(true);
    playSound(key);
    // Safety: if no sound starts (e.g. the request was rejected in a race), unlock.
    clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => setPending(false), 2000);
  }

  return (
    <>
      <Fab
        size="small"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close soundboard' : 'Open soundboard'}
        sx={{
          position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 1300,
          color: '#2a2d33',
          // Brushed-metal look: a vertical light→dark steel gradient for the body,
          // a bright top edge + dark bottom edge (bevel), and a soft inner sheen.
          background: 'linear-gradient(145deg, #fafbfc 0%, #c3c8d0 38%, #8b929c 62%, #5b616b 100%)',
          border: '1px solid rgba(255,255,255,0.55)',
          boxShadow:
            'inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -2px 3px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.5)',
          '&:hover': {
            background: 'linear-gradient(145deg, #ffffff 0%, #ced3db 38%, #969da7 62%, #656b75 100%)',
            boxShadow:
              'inset 0 1px 1px rgba(255,255,255,0.95), inset 0 -2px 3px rgba(0,0,0,0.35), 0 5px 14px rgba(0,0,0,0.55)',
          },
          '&:active': {
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.5)',
          },
        }}
      >
        <CampaignIcon sx={{ filter: 'drop-shadow(0 1px 1px rgba(255,255,255,0.6))' }} />
      </Fab>

      {/* Click-away catcher (transparent — keeps the game visible). */}
      {open && (
        <Box
          onClick={() => setOpen(false)}
          sx={{ position: 'fixed', inset: 0, zIndex: 1290 }}
        />
      )}

      {/* Positioning wrapper: pins the panel just to the RIGHT of the button and
          vertically centred on it. Slide animates the inner panel in from the left
          (and back out to the left on close); keeping the wrapper's translateY(-50%)
          off the animated child avoids fighting Slide's own transform. */}
      <Box
        sx={{
          position: 'fixed',
          left: 64, // right of the small Fab (left:16 + ~40px wide + gap)
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1300,
        }}
      >
        <Slide direction="right" in={open} mountOnEnter unmountOnExit>
          {/* Panel: themed backdrop (fh-bg) + SP counter + circular buttons. */}
          <Box
            className="fh-bg"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              // Fixed width so the panel doesn't resize as the SP number's digit
              // count changes — sized a touch wider than the longest usual counter.
              width: 132,
              px: 2,
              py: 1.25,
              borderRadius: 4,
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.14)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
            }}
          >
            {/* SP counter — only ever visible while this panel is open. */}
            <Typography
              variant="caption"
              sx={{
                fontWeight: 'bold', letterSpacing: 0.5, whiteSpace: 'nowrap',
                color: canAfford ? '#ffe08a' : '#ff8a8a',
                textShadow: '0 1px 4px rgba(0,0,0,0.85)',
              }}
            >
              {sp} SP · {SOUND_COST} each
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {EMOTES.map(({ key, label, icon, color }) => (
                <Tooltip key={key} title={label} placement="top">
                  {/* span wrapper so the Tooltip still works while the Fab is disabled */}
                  <span>
                    <Fab
                      size="medium"
                      aria-label={label}
                      disabled={locked}
                      onClick={() => trigger(key)}
                      sx={{
                        color: '#fff',
                        fontSize: 24,        // size of the emoji glyph
                        lineHeight: 1,
                        // Glossy "button cap": a radial highlight up top fading into the
                        // button's colour, a crisp rim, an inner sheen + colour glow.
                        background: `radial-gradient(120% 120% at 30% 22%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 26%, ${color} 60%, ${color} 100%)`,
                        border: '1px solid rgba(255,255,255,0.35)',
                        boxShadow: `inset 0 1px 2px rgba(255,255,255,0.55), inset 0 -3px 5px rgba(0,0,0,0.35), 0 3px 8px rgba(0,0,0,0.45), 0 0 10px ${color}66`,
                        textShadow: '0 1px 2px rgba(0,0,0,0.55)',
                        transition: 'transform 120ms ease, box-shadow 120ms ease, filter 120ms ease',
                        // Glassy top sheen overlay (upper half).
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          inset: 1,
                          borderRadius: '50%',
                          background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 52%)',
                          pointerEvents: 'none',
                        },
                        '&:hover': {
                          filter: 'brightness(1.12)',
                          transform: 'translateY(-1px)',
                          boxShadow: `inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -3px 5px rgba(0,0,0,0.35), 0 5px 12px rgba(0,0,0,0.5), 0 0 16px ${color}99`,
                        },
                        '&:active': {
                          transform: 'translateY(1px)',
                          boxShadow: `inset 0 2px 5px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.4)`,
                        },
                        '&.Mui-disabled': {
                          background: `radial-gradient(120% 120% at 30% 22%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 26%, ${color} 60%)`,
                          filter: 'grayscale(0.5) brightness(0.7)',
                          color: 'rgba(255,255,255,0.7)',
                        },
                      }}
                    >
                      <span aria-hidden="true">{icon}</span>
                    </Fab>
                  </span>
                </Tooltip>
              ))}

              {/* Hidden cheat button: appears only once unlocked; grants free SP. */}
              {cheatUnlocked && (
                <Tooltip title="+10 SP" placement="top">
                  <Fab
                    size="medium"
                    aria-label="Cheat: gain 10 SP"
                    onClick={() => onCheat?.()}
                    sx={{
                      color: '#fff',
                      background: 'radial-gradient(120% 120% at 30% 22%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 26%, #2e7d32 60%, #2e7d32 100%)',
                      border: '1px solid rgba(255,255,255,0.35)',
                      boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.55), inset 0 -3px 5px rgba(0,0,0,0.35), 0 3px 8px rgba(0,0,0,0.45), 0 0 10px #2e7d3266',
                      transition: 'transform 120ms ease, box-shadow 120ms ease, filter 120ms ease',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        inset: 1,
                        borderRadius: '50%',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 52%)',
                        pointerEvents: 'none',
                      },
                      '&:hover': {
                        filter: 'brightness(1.12)',
                        transform: 'translateY(-1px)',
                        boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.6), inset 0 -3px 5px rgba(0,0,0,0.35), 0 5px 12px rgba(0,0,0,0.5), 0 0 16px #2e7d3299',
                      },
                      '&:active': {
                        transform: 'translateY(1px)',
                        boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.45), 0 1px 4px rgba(0,0,0,0.4)',
                      },
                    }}
                  >
                    <AddIcon />
                  </Fab>
                </Tooltip>
              )}
            </Box>

            {/* STOP: cuts the current sound short for the whole room. Only the player
                who STARTED the sound can use it (canStop). */}
            <Button
              fullWidth
              startIcon={<StopIcon />}
              disabled={!canStop}
              onClick={() => stopSound?.()}
              aria-label="Stop the playing sound"
              sx={{
                mt: 0.5,
                fontWeight: 800,
                letterSpacing: 1.5,
                color: '#fff',
                borderRadius: 2,
                py: 0.75,
                background: 'linear-gradient(180deg, #b71c1c 0%, #7f0e0e 100%)',
                border: '1px solid rgba(255,255,255,0.22)',
                boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.35), inset 0 -2px 4px rgba(0,0,0,0.4), 0 3px 8px rgba(0,0,0,0.45)',
                textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                transition: 'transform 120ms ease, box-shadow 120ms ease, filter 120ms ease',
                '&:hover': {
                  background: 'linear-gradient(180deg, #c62828 0%, #8b0f0f 100%)',
                  filter: 'brightness(1.08)',
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.4), 0 5px 12px rgba(0,0,0,0.5), 0 0 14px rgba(183,28,28,0.6)',
                },
                '&:active': {
                  transform: 'translateY(1px)',
                  boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.4)',
                },
                '&.Mui-disabled': {
                  background: 'linear-gradient(180deg, #5a2222 0%, #3d1414 100%)',
                  color: 'rgba(255,255,255,0.4)',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                },
              }}
            >
              Stop
            </Button>
          </Box>
        </Slide>
      </Box>
    </>
  );
}
