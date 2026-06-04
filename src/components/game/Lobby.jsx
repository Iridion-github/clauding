import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Card, CardActionArea, CardContent,
  Stack, TextField, Typography, Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const DECKS = [
  { id: 'mono_red',   label: 'Mono Red Burn',    desc: 'Fast burn. Lightning Bolt, Goblin Guide, Monastery Swiftspear.' },
  { id: 'mono_green', label: 'Mono Green Stompy', desc: 'Big creatures. Steel Leaf Champion, Rhonas, Llanowar Elves.' },
];

export function Lobby({ connected, roomPlayers, error, onJoin }) {
  const navigate = useNavigate();
  const [roomId, setRoomId]     = useState('tavern');
  const [name, setName]         = useState('');
  const [deckName, setDeckName] = useState('mono_red');

  function handleJoin(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onJoin(roomId.trim(), name.trim(), deckName);
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, py: 6, position: 'relative' }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/')}
        sx={{ position: 'absolute', top: 20, left: 20 }}
        color="inherit"
      >
        Back
      </Button>

      <Stack spacing={1} sx={{ alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" color="primary" fontWeight="bold"
          sx={{ textShadow: '0 2px 16px rgba(240,192,64,0.3)' }}
        >
          Magic the Gathering Simulator
        </Typography>
        <Typography variant="body2" color={connected ? 'secondary.main' : 'text.secondary'}>
          {connected ? '● Connected' : '○ Connecting…'}
        </Typography>
      </Stack>

      {roomPlayers.length > 0 ? (
        <Stack spacing={1} sx={{ alignItems: 'center' }}>
          <Typography>In room: {roomPlayers.map(p => p.name).join(' vs ')}</Typography>
          {roomPlayers.length === 1 && (
            <Typography variant="body2" color="primary" fontStyle="italic">
              Waiting for opponent…
            </Typography>
          )}
        </Stack>
      ) : (
        <Box component="form" onSubmit={handleJoin} sx={{ width: '100%', maxWidth: 380 }}>
          <Stack spacing={2.5}>
            <TextField
              label="Room ID"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label="Your Name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your name"
              size="small"
              fullWidth
            />

            <Box>
              <Typography variant="body2" color="text.secondary" mb={1}>Deck</Typography>
              <Stack spacing={1}>
                {DECKS.map(d => (
                  <Card
                    key={d.id}
                    variant="outlined"
                    sx={{ borderColor: deckName === d.id ? 'primary.main' : 'divider' }}
                  >
                    <CardActionArea onClick={() => setDeckName(d.id)}>
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant="body1" fontWeight="bold">{d.label}</Typography>
                        <Typography variant="body2" color="text.secondary">{d.desc}</Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                ))}
              </Stack>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              disabled={!connected || !name.trim()}
            >
              Join Game
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
