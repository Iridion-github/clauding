import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { Hub } from './pages/Hub';
import { MTGApp } from './pages/MTGApp';
import { Flip7App } from './pages/Flip7App';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Hub />} />
          {/* <Route path="/mtg"   element={<MTGApp />} /> */}
          <Route path="/flip7" element={<Flip7App />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
