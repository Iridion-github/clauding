import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#f0c040' },
    secondary:  { main: '#40c070' },
    error:      { main: '#c04040' },
    background: { default: '#111111', paper: '#1a1a1a' },
    text:       { primary: '#eeeeee', secondary: '#999999' },
  },
  typography: {
    fontFamily: "'Georgia', serif",
    button: { textTransform: 'none', fontFamily: "'Georgia', serif" },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { fontWeight: 'bold' },
        containedPrimary: { color: '#111' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { fontFamily: "'Georgia', serif" },
      },
    },
  },
});

export default theme;
