import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardActionArea, CardContent, Chip, Stack,
} from '@mui/material';

const PROJECTS = [
  // {
  //   id: 'mtg',
  //   title: 'Magic the Gathering Simulator',
  //   description: 'Networked 1v1 card game based on the famous TCG.',
  //   status: 'WIP',
  //   path: '/mtg',
  // },
  {
    id: 'flippinghusks',
    title: 'Flipping Husks',
    description: 'Push-your-luck card game. Draw cards and avoid duplicates. First to 200 points wins.',
    status: 'WIP',
    path: '/flippinghusks',
  },
];

export function Hub() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pt: 10,
        px: 3,
      }}
    >
      <Stack spacing={1} sx={{ alignItems: 'center', mb: 6 }}>
        <Typography variant="h3" color="primary" fontWeight="bold"
          sx={{ textShadow: '0 2px 20px rgba(240,192,64,0.3)' }}
        >
          Game Lab
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Work in progress projects
        </Typography>
      </Stack>

      <Stack spacing={2} sx={{ width: '100%', maxWidth: 600 }}>
        {PROJECTS.map(project => (
          <Card key={project.id} variant="outlined">
            <CardActionArea onClick={() => navigate(project.path)} sx={{ p: 1 }}>
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                  <Chip label={project.status} size="small" color="primary" variant="outlined" />
                </Stack>
                <Typography variant="h6" gutterBottom>{project.title}</Typography>
                <Typography variant="body2" color="text.secondary">{project.description}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
