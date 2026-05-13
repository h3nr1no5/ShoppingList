import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/i18n';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useApiHealthContext } from '../context/useApiHealthContext';

const Header: React.FC = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const currentLang = i18n.language?.startsWith('hu') ? 'hu' : 'en';

  const toggleLanguage = (): void => {
    const newLang = i18n.language?.startsWith('hu') ? 'en' : 'hu';
    i18n.changeLanguage(newLang);
  };

  const { status } = useApiHealthContext();

  const handleLogout = (): void => {
    logout();
    setMenuOpen(false);
    navigate('/login');
  };

  const toggleMenu = (): void => {
    setMenuOpen((prev) => !prev);
  };

  const closeMenu = (): void => {
    setMenuOpen(false);
  };

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        closeMenu();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          <Link to="/" className="logo" onClick={closeMenu}>
            <span className="logo-icon">🛒</span>
            <span className="logo-text">{t('nav.shopping_list')}</span>
          </Link>

          {/* Status dot - always visible in header, including mobile */}
          {status !== 'checking' && (
            <div
              className="connection-status"
              title={status === 'connected' ? t('nav.api_connected') : t('nav.api_disconnected')}
              role="status"
              aria-live="polite"
            >
              <span className={`status-dot ${status === 'connected' ? 'connected' : 'pulse'}`} />
            </div>
          )}
        </div>

        {/* Desktop nav — hidden on mobile via CSS */}
        <nav className="nav">
          <button
            onClick={toggleTheme}
            className="btn btn-icon theme-toggle"
            aria-label={theme === 'light' ? t('nav.switch_to_dark') : t('nav.switch_to_light')}
            title={theme === 'light' ? t('nav.switch_to_dark') : t('nav.switch_to_light')}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button
            onClick={toggleLanguage}
            className="btn btn-icon lang-toggle"
            title={currentLang === 'hu' ? t('nav.switch_to_english') : t('nav.switch_to_hungarian')}
          >
            {currentLang === 'hu' ? 'EN' : 'HU'}
          </button>
          {isAuthenticated ? (
            <div className="user-menu">
              <span className="user-email">{user?.email}</span>
              <button onClick={handleLogout} className="btn btn-secondary">
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <div className="auth-links">
              <Link to="/login" className="btn btn-secondary">
                {t('nav.login')}
              </Link>
              <Link to="/register" className="btn btn-primary">
                {t('nav.register')}
              </Link>
            </div>
          )}
        </nav>

        {/* Hamburger button — visible only on mobile */}
        <button
          className="hamburger-btn"
          onClick={toggleMenu}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? t('nav.close_menu') : t('nav.open_menu')}
          aria-controls="mobile-nav"
        >
          <span className="hamburger-icon" aria-hidden="true"></span>
        </button>
      </div>

      {/* Mobile Nav Overlay */}
      <div
        className={`nav-mobile-overlay ${menuOpen ? 'open' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />

      {/* Mobile Nav Panel */}
      <div
        id="mobile-nav"
        className={`nav-mobile-panel ${menuOpen ? 'open' : ''}`}
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.navigation_menu')}
      >
        <div className="nav-mobile-header">
          <span className="nav-mobile-title">{t('nav.menu')}</span>
          <button
            className="nav-mobile-close"
            onClick={closeMenu}
            aria-label={t('nav.close_menu')}
          >
            ×
          </button>
        </div>
        <div className="nav-mobile-items">
          <button
            onClick={() => {
              toggleTheme();
            }}
            className="btn btn-secondary"
          >
            {theme === 'light' ? `🌙 ${t('nav.dark_mode')}` : `☀️ ${t('nav.light_mode')}`}
          </button>
          {isAuthenticated ? (
            <div className="user-menu">
              <span className="user-email">{user?.email}</span>
              <button onClick={handleLogout} className="btn btn-secondary">
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <div className="auth-links">
              <Link to="/login" className="btn btn-secondary" onClick={closeMenu}>
                {t('nav.login')}
              </Link>
              <Link to="/register" className="btn btn-primary" onClick={closeMenu}>
                {t('nav.register')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
