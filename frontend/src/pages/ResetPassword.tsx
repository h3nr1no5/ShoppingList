import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { resetPassword } from '../api/client';
import ThemeToggle from '../components/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle';

const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('errors.passwords_do_not_match'));
      return;
    }

    if (!token) {
      setError(t('errors.invalid_reset_token'));
      return;
    }

    setSubmitting(true);

    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      const serverDetail = axiosErr.response?.data?.detail;
      const errorMessage = serverDetail || axiosErr.message || t('errors.failed_to_reset_password');
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page page-center page-auth">
      <div className="auth-toolbar">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">{t('auth.reset_password')}</h1>
          <p className="auth-subtitle">{t('auth.reset_password_instructions')}</p>
        </div>

        {success ? (
          <div className="auth-success">
            <p>{t('auth.password_reset_success')}</p>
            <p className="auth-footer" style={{ marginTop: '1rem' }}>
              <Link to="/login" className="auth-link">
                {t('auth.redirecting_to_login')}
              </Link>
            </p>
          </div>
        ) : (
          <>
            {error && <div className="form-error">{error}</div>}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  {t('auth.new_password')}
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-input"
                  placeholder={t('auth.password_placeholder')}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword" className="form-label">
                  {t('auth.confirm_password')}
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  placeholder={t('auth.confirm_password_placeholder')}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={submitting}
              >
                {submitting ? t('auth.resetting_password') : t('auth.reset_password_button')}
              </button>
            </form>

            <p className="auth-footer">
              <Link to="/login" className="auth-link">
                {t('auth.back_to_login')}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
