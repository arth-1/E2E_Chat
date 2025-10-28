import React, { createContext, useContext } from 'react';
import { LIGHT_COLORS, DARK_COLORS } from '../constants';

const ThemeContext = createContext({
  isDark: true,
  colors: DARK_COLORS,
  toggleTheme: () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  // Force dark mode across the app
  const isDark = true;
  const colors = DARK_COLORS;
  const toggleTheme = () => {};
  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};