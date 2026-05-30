import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { forgotPassword } from '../api/client';
import ThemeToggle from '../components/ThemeToggle';
import LanguageToggle from '../components/LanguageToggle';

const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await forgotPassword(email);
      setEmailSent(true);
    } catch {
      setError(t('errors.failed_to_send_reset_email'));
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
          <h1 className="auth-title">{t('auth.forgot_password')}</h1>
          <p className="auth-subtitle">{t('auth.forgot_password_instructions')}</p>
        </div>

        {emailSent ? (
          <div className="auth-success">
            <p>{t('auth.reset_email_sent')}</p>
            <p className="auth-footer" style={{ marginTop: '1rem' }}>
              <Link to="/login" className="auth-link">
                {t('auth.back_to_login')}
              </Link>
            </p>
          </div>
        ) : (
          <>
            {error && <div className="form-error">{error}</div>}

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

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={submitting}
              >
                {submitting ? t('auth.sending_reset_link') : t('auth.send_reset_link')}
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

export default ForgotPassword;
