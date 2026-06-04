import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from './theme';
import { Hub } from './pages/Hub';
import { MTGApp } from './pages/MTGApp';
import { FlippingHusksApp } from './pages/FlippingHusksApp';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Hub />} />
          {/* <Route path="/mtg"   element={<MTGApp />} /> */}
          <Route path="/flippinghusks" element={<FlippingHusksApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
