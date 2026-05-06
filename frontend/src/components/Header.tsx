import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useApiHealth } from '../hooks/useApiHealth';
import { useToastContext } from '../context/useToastContext';

const Header: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast, dismissAll } = useToastContext();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Wrap callbacks in useCallback to stabilize references for useApiHealth
  const handleDisconnect = useCallback(() => {
    showToast('Connection lost. Please check your internet.', 'error');
  }, [showToast]);

  const handleReconnect = useCallback(() => {
    showToast('Back online!', 'success');
    dismissAll();
  }, [showToast, dismissAll]);

  const { status } = useApiHealth({
    onDisconnect: handleDisconnect,
    onReconnect: handleReconnect,
  });

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
            <span className="logo-text">Shopping List</span>
          </Link>

          {/* Status dot - always visible in header, including mobile */}
          {status !== 'checking' && (
            <div
              className="connection-status"
              title={status === 'connected' ? 'API Connected' : 'API Disconnected'}
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
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          {isAuthenticated ? (
            <div className="user-menu">
              <span className="user-email">{user?.email}</span>
              <button onClick={handleLogout} className="btn btn-secondary">
                Logout
              </button>
            </div>
          ) : (
            <div className="auth-links">
              <Link to="/login" className="btn btn-secondary">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary">
                Register
              </Link>
            </div>
          )}
        </nav>

        {/* Hamburger button — visible only on mobile */}
        <button
          className="hamburger-btn"
          onClick={toggleMenu}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
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
        aria-label="Navigation menu"
      >
        <div className="nav-mobile-header">
          <span className="nav-mobile-title">Menu</span>
          <button
            className="nav-mobile-close"
            onClick={closeMenu}
            aria-label="Close menu"
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
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
          {isAuthenticated ? (
            <div className="user-menu">
              <span className="user-email">{user?.email}</span>
              <button onClick={handleLogout} className="btn btn-secondary">
                Logout
              </button>
            </div>
          ) : (
            <div className="auth-links">
              <Link to="/login" className="btn btn-secondary" onClick={closeMenu}>
                Login
              </Link>
              <Link to="/register" className="btn btn-primary" onClick={closeMenu}>
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
