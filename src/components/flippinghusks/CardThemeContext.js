import { createContext, useContext, useState } from 'react';
import { loadSettings } from './settingsStore';

// The active card theme ('default' | 'classic_fantasy'). Defaults to 'default' so
// components used without a provider (e.g. unit tests) keep the original look.
const CardThemeContext = createContext({ theme: 'default', setTheme: () => {} });

export function CardThemeProvider({ children }) {
  // Seed from saved settings; Settings → Save updates it live via setTheme.
  const [theme, setTheme] = useState(() => loadSettings().theme);
  return (
    <CardThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </CardThemeContext.Provider>
  );
}

// Current theme. Pass an explicit override (e.g. a live preview) to ignore the context.
export function useCardTheme(override) {
  const { theme } = useContext(CardThemeContext);
  return override ?? theme;
}

export function useSetCardTheme() {
  return useContext(CardThemeContext).setTheme;
}
