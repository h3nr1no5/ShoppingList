import { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

type Theme = 'light' | 'dark';

export const useTheme = (): {
  theme: Theme;
  toggleTheme: () => void;
} => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};