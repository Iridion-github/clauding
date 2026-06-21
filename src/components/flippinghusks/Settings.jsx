import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, Box, Button, Typography, Stack,
  FormControlLabel, Checkbox, Collapse,
  FormControl, InputLabel, Select, MenuItem, Slider,
} from '@mui/material';
import { FlippingHusksCard } from './FlippingHusksCard';
import {
  loadSettings, saveSettings, musicSrcFor, BGM_VOLUME,
  ANIMATION_SPEEDS, applyAnimationSpeed, applyBackground,
} from './settingsStore';
import { useSetCardTheme } from './CardThemeContext';

// Every distinct card in the 94-card deck (one of each), in deck order:
// numbers 0–12, modifiers +2…+10, ×2, then the three action cards.
const UNIQUE_CARDS = [
  ...Array.from({ length: 13 }, (_, n) => ({ type: 'number', value: n, label: String(n) })),
  ...[2, 4, 6, 8, 10].map(v => ({ type: 'modifier', value: v, label: `+${v}` })),
  { type: 'multiplier', value: 2, label: 'x2' },
  { type: 'freeze', value: 0, label: 'Freeze' },
  { type: 'flip_three', value: 0, label: 'Flip 3' },
  { type: 'second_chance', value: 0, label: '2nd Chance' },
];

// The preview grid: every unique front, then one extra slot showing the card back
// (faceDown). The back ignores card content, so any card stands in for it.
const PREVIEW_CARDS = [
  ...UNIQUE_CARDS.map(card => ({ card, faceDown: false })),
  { card: UNIQUE_CARDS[0], faceDown: true },
];

// Scale factor applied to the 72px "small" card so that exactly 3 fit per row
// in the settings column (72 × 1.45 ≈ 104px).
const CARD_SCALE = 1.45;

const MUSIC_TRACKS = [
  { value: 'default', label: 'Default' },
  { value: 'classic_fantasy', label: 'Classic Fantasy' },
];

const THEMES = [
  { value: 'default', label: 'Default' },
  { value: 'classic_fantasy', label: 'Classic Fantasy' },
];

export function Settings({ open, onClose }) {
  // Local draft so Cancel can discard unsaved edits.
  const [settings, setSettings] = useState(loadSettings);
  const setCardTheme = useSetCardTheme();
  const previewAudioRef = useRef(null);

  // Re-sync from storage each time the page is opened, so it reflects what was last saved.
  useEffect(() => {
    if (open) setSettings(loadSettings());
  }, [open]);

  // Preview the themed background live as the theme is changed (it's a global,
  // so the change is visible behind this dialog too). handleClose reverts it to
  // the saved theme when the dialog is dismissed without saving.
  useEffect(() => {
    if (open) applyBackground(settings.theme);
  }, [open, settings.theme]);

  // Stop the preview player when Background Music is switched off (the player is
  // hidden by the Collapse, so it must not keep playing in the background).
  useEffect(() => {
    if (!settings.backgroundMusic && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
  }, [settings.backgroundMusic]);

  // Callback ref: set the preview player's volume to match the in-game volume the
  // moment the element attaches (volume is a DOM property, not a JSX attribute, and
  // a fresh <audio> defaults to 1.0). Done here rather than in an effect so it can't
  // run before the node exists.
  const setPreviewAudio = useCallback((node) => {
    previewAudioRef.current = node;
    if (node) node.volume = BGM_VOLUME;
  }, []);

  function set(key, value) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  function handleSave() {
    saveSettings(settings);
    setCardTheme(settings.theme); // apply the chosen card theme immediately
    applyBackground(settings.theme); // swap the themed background to match
    applyAnimationSpeed(settings.animationSpeed); // update the live animation-speed variable
    onClose();
  }

  // Cancel / dismiss: drop the live background preview back to the saved theme.
  function handleClose() {
    applyBackground(loadSettings().theme);
    onClose();
  }

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
      <Box className="fh-bg" sx={{
        display: 'flex', flexDirection: 'column', height: '100%',
        pt: 'env(safe-area-inset-top)',
        pb: 'env(safe-area-inset-bottom)',
      }}>
        {/* Content — centered both horizontally and vertically */}
        <Box sx={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-start', alignItems: 'center',
          px: { xs: 1.5, sm: 3 }, py: { xs: 3, sm: 4 },
        }}>
          <Stack spacing={4} sx={{ width: '100%', maxWidth: 360, alignItems: 'center' }}>
            <Typography variant="h4" color="primary" fontWeight="bold"
              sx={{ textShadow: '0 2px 16px rgba(240,192,64,0.3)' }}>
              Settings
            </Typography>

            <Stack spacing={3} sx={{ width: '100%' }}>
              {/* Animations Speed — discrete slider: Default → Faster → Fastest.
                  Each step halves the duration of every game animation. */}
              <Box sx={{ width: '100%' }}>
                <Typography sx={{ mb: 1 }}>Animations Speed</Typography>
                <Box sx={{ px: 1.5 }}>
                  <Slider
                    value={Math.max(0, ANIMATION_SPEEDS.findIndex(s => s.value === settings.animationSpeed))}
                    onChange={(e, idx) => set('animationSpeed', ANIMATION_SPEEDS[idx].value)}
                    min={0}
                    max={ANIMATION_SPEEDS.length - 1}
                    step={null}
                    marks={ANIMATION_SPEEDS.map((s, i) => ({ value: i, label: s.label }))}
                    color="primary"
                  />
                </Box>
              </Box>

              {/* Background Music */}
              <Box sx={{ width: '100%' }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={settings.backgroundMusic}
                      onChange={e => set('backgroundMusic', e.target.checked)}
                      color="primary"
                    />
                  }
                  label="Background Music"
                />
                <Collapse in={settings.backgroundMusic}>
                  <Box sx={{ pt: 1, display: 'flex', justifyContent: 'flex-start' }}>
                    <FormControl
                      size="small"
                      sx={{
                        minWidth: 150,
                        // Roughly a third smaller than the Theme select, height and text included.
                        '& .MuiInputBase-input': { py: 0.55, fontSize: '0.8rem' },
                        '& .MuiInputLabel-root': { fontSize: '0.8rem' },
                        '& .MuiSvgIcon-root': { fontSize: '1.1rem' },
                      }}
                    >
                      <InputLabel id="music-track-label">Track</InputLabel>
                      <Select
                        labelId="music-track-label"
                        label="Track"
                        value={settings.musicTrack}
                        onChange={e => set('musicTrack', e.target.value)}
                        MenuProps={{ sx: { '& .MuiMenuItem-root': { fontSize: '0.8rem' } } }}
                      >
                        {MUSIC_TRACKS.map(t => (
                          <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  {/* Preview player for the selected track. */}
                  <Box
                    component="audio"
                    ref={setPreviewAudio}
                    controls
                    preload="metadata"
                    src={musicSrcFor(settings.musicTrack)}
                    sx={{ mt: 1.5, width: '100%', display: 'block' }}
                  />
                </Collapse>
              </Box>

              {/* Theme */}
              <Box sx={{ width: '100%' }}>
                <Typography sx={{ mb: 1 }}>Cards Theme</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={settings.theme}
                    onChange={e => set('theme', e.target.value)}
                  >
                    {THEMES.map(t => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Preview of every unique card in the deck for the chosen theme,
                    plus one face-down card so the card back is shown too.
                    Cards are scaled up from the 72px "small" size so exactly 3 fit per row. */}
                <Stack
                  direction="row"
                  sx={{ flexWrap: 'wrap', justifyContent: 'center', gap: 0.75, mt: 2 }}
                >
                  {PREVIEW_CARDS.map(({ card, faceDown }, i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 72 * CARD_SCALE,
                        height: 104 * CARD_SCALE,
                        '& > .fhcard': { transform: `scale(${CARD_SCALE})`, transformOrigin: 'top left' },
                        '& > .fhcard:hover': { transform: `scale(${CARD_SCALE}) translateY(-3px)` },
                      }}
                    >
                      <FlippingHusksCard card={card} faceDown={faceDown} small theme={settings.theme} />
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Stack>
          </Stack>
        </Box>

        {/* Footer: Cancel / Save */}
        <Stack direction="row" spacing={1.5} sx={{ px: { xs: 2, sm: 3 }, py: 2, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Button
            onClick={handleClose}
            color="inherit"
            variant="outlined"
            sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.18)' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            color="secondary"
            sx={{ flex: 1 }}
          >
            Save
          </Button>
        </Stack>
      </Box>
    </Dialog>
  );
}
