import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { Hub } from './pages/Hub';
import { FlippingHusksApp } from './pages/FlippingHusksApp';
import { isDiscordActivity } from './discord/discord';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Discord loads the Activity iframe at "/", so when embedded we mount the
              game (not the Hub) at the root — that's what runs the Discord handshake. */}
          <Route path="/" element={isDiscordActivity ? <FlippingHusksApp /> : <Hub />} />
          <Route path="/flippinghusks" element={<FlippingHusksApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
