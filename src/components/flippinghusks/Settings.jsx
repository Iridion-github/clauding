import { useState, useEffect } from 'react';
import {
  Dialog, Box, Button, Typography, Stack,
  FormControlLabel, Checkbox, Collapse,
  FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import { FlippingHusksCard } from './FlippingHusksCard';
import { loadSettings, saveSettings } from './settingsStore';
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

  // Re-sync from storage each time the page is opened, so it reflects what was last saved.
  useEffect(() => {
    if (open) setSettings(loadSettings());
  }, [open]);

  function set(key, value) {
    setSettings(s => ({ ...s, [key]: value }));
  }

  function handleSave() {
    saveSettings(settings);
    setCardTheme(settings.theme); // apply the chosen card theme immediately
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
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
      <Box sx={{
        display: 'flex', flexDirection: 'column', height: '100%',
        pt: 'env(safe-area-inset-top)',
        pb: 'env(safe-area-inset-bottom)',
      }}>
        {/* Content — centered both horizontally and vertically */}
        <Box sx={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-start', alignItems: 'center',
          px: { xs: 2.5, sm: 3 }, py: { xs: 3, sm: 4 },
        }}>
          <Stack spacing={4} sx={{ width: '100%', maxWidth: 360, alignItems: 'center' }}>
            <Typography variant="h4" color="primary" fontWeight="bold"
              sx={{ textShadow: '0 2px 16px rgba(240,192,64,0.3)' }}>
              Settings
            </Typography>

            <Stack spacing={3} sx={{ width: '100%' }}>
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

                {/* Preview of every unique card in the deck for the chosen theme.
                    Cards are scaled up from the 72px "small" size so exactly 3 fit per row. */}
                <Stack
                  direction="row"
                  sx={{ flexWrap: 'wrap', justifyContent: 'center', gap: 1, mt: 2 }}
                >
                  {UNIQUE_CARDS.map((card, i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 72 * CARD_SCALE,
                        height: 104 * CARD_SCALE,
                        '& > .fhcard': { transform: `scale(${CARD_SCALE})`, transformOrigin: 'top left' },
                        '& > .fhcard:hover': { transform: `scale(${CARD_SCALE}) translateY(-3px)` },
                      }}
                    >
                      <FlippingHusksCard card={card} small theme={settings.theme} />
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
            onClick={onClose}
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
