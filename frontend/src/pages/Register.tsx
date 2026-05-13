import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { useToastContext } from '../context/useToastContext';

const Register: React.FC = () => {
  const { register, isAuthenticated, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const { showToast } = useToastContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/');
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (password !== confirmPassword) {
      showToast(t('errors.passwords_do_not_match'), 'error');
      return;
    }

    if (password.length < 8) {
      showToast(t('errors.password_too_short'), 'error');
      return;
    }

    setSubmitting(true);

    try {
      await register({ email, password, invite_code: inviteCode });
      navigate('/');
    } catch (err: unknown) {
      const errorDetail =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;

      let errorMessage: string;
      if (errorDetail === 'Invalid invite code') {
        errorMessage = t('errors.invalid_invite_code');
      } else if (errorDetail === 'Email already registered') {
        errorMessage = t('errors.email_already_registered');
      } else if (errorDetail === 'An error occurred during registration') {
        errorMessage = t('errors.an_error_occurred_during_registration');
      } else {
        errorMessage = t('errors.registration_failed_generic');
      }
      showToast(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="page page-center">
        <div className="loading">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="page page-center">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-title">{t('auth.create_account')}</h1>
          <p className="auth-subtitle">{t('auth.create_account')}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="inviteCode" className="form-label">
              {t('auth.invite_code')}
            </label>
            <input
              type="text"
              id="inviteCode"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="form-input"
              placeholder={t('auth.enter_invite_code')}
              autoComplete="off"
            />
          </div>

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
              autoComplete="new-password"
              minLength={8}
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
              placeholder={t('auth.password_placeholder')}
              required
              autoComplete="new-password"
              minLength={8}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={submitting}
          >
            {submitting ? t('auth.creating_account') : t('auth.create_account')}
          </button>
        </form>

        <p className="auth-footer">
          {t('auth.already_have_account')}{' '}
          <Link to="/login" className="auth-link">
            {t('auth.sign_in')}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;