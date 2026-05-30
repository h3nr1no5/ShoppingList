import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useToastContext } from '../context/useToastContext';
import ThemeToggle from '../components/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle';

const Login: React.FC = () => {
  const { login, isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToastContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/');
    }
  }, [loading, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await login({ email, password });
      navigate('/');
    } catch (err: unknown) {
      const errorDetail =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;

      let errorMessage: string;
      if (errorDetail === 'Incorrect email or password') {
        errorMessage = t('errors.incorrect_email_or_password');
      } else if (errorDetail === 'Could not validate credentials') {
        errorMessage = t('errors.could_not_validate_credentials');
      } else {
        errorMessage = t('errors.login_failed_network');
      }
      showToast(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page page-center page-auth">
        <div className="auth-toolbar">
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <div className="loading">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="page page-center page-auth">
      <div className="auth-toolbar">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">{t('auth.welcome_back')}</h1>
          <p className="auth-subtitle">{t('auth.sign_in_to_account')}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              {t('auth.email')}
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder={t('auth.email_placeholder')}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              {t('auth.password')}
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder={t('auth.password_placeholder')}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={submitting}
          >
            {submitting ? t('auth.signing_in') : t('auth.sign_in')}
          </button>
        </form>

        <p className="auth-forgot-password">
          <Link to="/forgot-password" className="auth-link">
            {t('auth.forgot_password')}
          </Link>
        </p>

        <p className="auth-footer">
          {t('auth.dont_have_account')}{' '}
          <Link to="/register" className="auth-link">
            {t('auth.register')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;