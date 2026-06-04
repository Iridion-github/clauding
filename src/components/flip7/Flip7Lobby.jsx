import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, TextField, Typography, Stack,
  List, ListItem, ListItemText, Chip, Divider, Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StarIcon from '@mui/icons-material/Star';

export function Flip7Lobby({ connected, playerId, isHost, hostId, roomPlayers, roomId, error, onJoin, onStart }) {
  const navigate = useNavigate();
  const [inputRoomId, setInputRoomId] = useState('');
  const [name, setName] = useState('');
  const inRoom = roomPlayers.length > 0;

  function handleJoin(e) {
    e.preventDefault();
    if (!name.trim() || !inputRoomId.trim()) return;
    onJoin(inputRoomId.trim().toUpperCase(), name.trim());
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, py: 6, position: 'relative' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} color="inherit"
        sx={{ position: 'absolute', top: 20, left: 20 }}>
        Back
      </Button>

      <Stack spacing={1} sx={{ alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" color="primary" fontWeight="bold"
          sx={{ textShadow: '0 2px 16px rgba(240,192,64,0.3)' }}>
          Flip 7
        </Typography>
        <Typography variant="body2" color={connected ? 'secondary.main' : 'text.secondary'}>
          {connected ? '● Connected' : '○ Connecting…'}
        </Typography>
      </Stack>

      {!inRoom ? (
        <Box component="form" onSubmit={handleJoin} sx={{ width: '100%', maxWidth: 360 }}>
          <Stack spacing={2.5}>
            <TextField label="Room Code" value={inputRoomId} onChange={e => setInputRoomId(e.target.value.toUpperCase())}
              slotProps={{ htmlInput: { maxLength: 8 } }} size="small" fullWidth placeholder="e.g. GAME01" />
            <TextField label="Your Name" value={name} onChange={e => setName(e.target.value)}
              size="small" fullWidth placeholder="Enter your name" />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" color="primary" size="large" fullWidth
              disabled={!connected || !name.trim() || !inputRoomId.trim()}>
              Join Room
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
              <Button variant="contained" color="primary" size="large" fullWidth
                disabled={roomPlayers.length < 2}
                onClick={onStart}>
                {roomPlayers.length < 2 ? 'Waiting for players…' : `Start Game (${roomPlayers.length} players)`}
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontStyle: 'italic' }}>
                Waiting for host to start…
              </Typography>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
