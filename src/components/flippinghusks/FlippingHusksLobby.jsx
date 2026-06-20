import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, TextField, Typography, Stack,
  List, ListItem, ListItemText, Chip, Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';
import SchoolIcon from '@mui/icons-material/School';
import SettingsIcon from '@mui/icons-material/Settings';
import { LearnToPlay } from './LearnToPlay';
import { Settings } from './Settings';
import { isDiscordActivity } from '../../discord/discord';

export function FlippingHusksLobby({ connected, playerId, isHost, hostId, roomPlayers, roomId, error, discord, onJoin, onStart, onLeaveRoom }) {
  const navigate = useNavigate();
  // Inside a Discord Activity the room code and name come from Discord and must
  // NEVER be editable — not on first load, not after leaving a game. Detect it from
  // the canonical Discord signal (frame_id), so the lock never depends on prop timing.
  const isDiscord = isDiscordActivity;
  const [inputRoomId, setInputRoomId] = useState(() => discord?.roomId ?? localStorage.getItem('fh_roomCode') ?? '');
  const [name, setName] = useState(() => discord?.name ?? localStorage.getItem('fh_playerName') ?? '');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const inRoom = roomPlayers.length > 0;

  function handleJoin(e) {
    e.preventDefault();
    // Discord supplies fixed values; otherwise use (and remember) the typed ones.
    const room = isDiscord ? (discord?.roomId ?? inputRoomId.trim()) : inputRoomId.trim().toUpperCase();
    const playerName = isDiscord ? (discord?.name ?? name.trim()) : name.trim();
    if (!playerName || !room) return;
    if (!isDiscord) {
      localStorage.setItem('fh_roomCode', room);
      localStorage.setItem('fh_playerName', playerName);
    }
    onJoin(room, playerName);
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, py: 6, position: 'relative' }}>
      {/* Back is available everywhere except the Discord start screen itself (the
          first view, which already exposes Tutorial/Settings). In Discord it returns
          to that start screen by leaving the room; on the website it goes to the Hub. */}
      {(!isDiscord || inRoom) && (
        <Button startIcon={<ArrowBackIcon />}
          onClick={() => { if (isDiscord) onLeaveRoom?.(); else navigate('/'); }}
          color="inherit" variant="outlined"
          sx={{ position: 'absolute', top: { xs: 12, sm: 20 }, left: { xs: 12, sm: 20 }, borderColor: 'rgba(255,255,255,0.18)' }}>
          Back
        </Button>
      )}

      <Stack spacing={1} sx={{ alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" color="primary" fontWeight="bold"
          sx={{ textShadow: '0 2px 16px rgba(240,192,64,0.3)' }}>
          Flipping Husks
        </Typography>
        <Typography variant="body2" color={connected ? 'secondary.main' : 'text.secondary'}>
          {connected ? '● Connected' : '○ Connecting…'}
        </Typography>
      </Stack>

      {!inRoom ? (
        <Box component="form" onSubmit={handleJoin} sx={{ width: '100%', maxWidth: 360 }}>
          <Stack spacing={2.5}>
            <TextField label="Room Code" value={inputRoomId} onChange={e => setInputRoomId(e.target.value.toUpperCase())}
              slotProps={{ htmlInput: { maxLength: isDiscord ? undefined : 8, readOnly: isDiscord } }}
              fullWidth placeholder="e.g. GAME01"
              helperText={isDiscord ? 'Set by your Discord channel' : undefined} />
            <TextField label="Your Name" value={name} onChange={e => setName(e.target.value)}
              slotProps={{ htmlInput: { readOnly: isDiscord } }}
              fullWidth placeholder="Enter your name"
              helperText={isDiscord ? 'From your Discord profile' : undefined} />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" color="primary" size="large" fullWidth
              disabled={!connected || !name.trim() || !inputRoomId.trim()}>
              Join Room
            </Button>
            <Button variant="contained" color="secondary" size="large" fullWidth
              startIcon={<SchoolIcon />} onClick={() => setShowTutorial(true)}>
              Learn to Play
            </Button>
            <Button variant="outlined" color="inherit" size="large" fullWidth
              startIcon={<SettingsIcon />} onClick={() => setShowSettings(true)}
              sx={{ borderColor: 'rgba(255,255,255,0.18)' }}>
              Settings
            </Button>
          </Stack>
        </Box>
      ) : (
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Stack spacing={2}>
            <Box sx={{ background: 'rgba(255,255,255,0.04)', borderRadius: 2, p: 2 }}>
              <Typography variant="overline" color="text.secondary">Room</Typography>
              <Typography variant="h5" fontWeight="bold" letterSpacing={4}>{roomId || '—'}</Typography>
            </Box>

            <Box sx={{ background: 'rgba(255,255,255,0.04)', borderRadius: 2, p: 2 }}>
              <Typography variant="overline" color="text.secondary">
                Players ({roomPlayers.length}/6)
              </Typography>
              <List dense disablePadding sx={{ mt: 1 }}>
                {roomPlayers.map((p, i) => (
                  <ListItem key={p.id} disableGutters sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                          <Typography>{p.name}</Typography>
                          {p.id === hostId && <Chip icon={<StarIcon />} label="Host" size="small" color="primary" variant="outlined" />}
                          {p.id === playerId && <Chip label="You" size="small" variant="outlined" />}
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            {isHost ? (
              <Button variant="contained" color={roomPlayers.length < 2 ? 'warning' : 'primary'} size="large" fullWidth
                onClick={onStart}>
                {roomPlayers.length < 2 ? 'Start (Debug Mode)' : `Start Game (${roomPlayers.length} players)`}
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontStyle: 'italic' }}>
                Waiting for host to start…
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      <LearnToPlay open={showTutorial} onClose={() => setShowTutorial(false)} />
      <Settings open={showSettings} onClose={() => setShowSettings(false)} />
    </Box>
  );
}
