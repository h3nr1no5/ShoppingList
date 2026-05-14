import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from 'react-i18next';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <button
      onClick={toggleTheme}
      className="btn btn-icon theme-toggle"
      aria-label={theme === 'light' ? t('nav.switch_to_dark') : t('nav.switch_to_light')}
      title={theme === 'light' ? t('nav.switch_to_dark') : t('nav.switch_to_light')}
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
};

export default ThemeToggle;