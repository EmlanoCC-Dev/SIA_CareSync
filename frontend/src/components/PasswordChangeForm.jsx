import React, { useEffect, useRef, useState } from 'react';
import { api, getStoredToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import EmailVerificationCode from './EmailVerificationCode';
import { Mail } from 'lucide-react';

export default function PasswordChangeForm({ initialEmail = '', fixedEmail = false, onComplete }) {
  const { logout } = useAuth();
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [email, setEmail] = useState(initialEmail);
  const [requested, setRequested] = useState(false);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function requestCode() {
    setLoading(true); setError(''); setNotice('');
    try {
      const response = await api.requestPasswordOtp(email);
      if (!active.current) return;
      setRequested(true); setOtp('');
      setResendAt(Date.now() + response.data.resendAfterSeconds * 1000);
      setNotice(response.data.message);
    } catch (err) { if (active.current) setError(err.message); }
    finally { if (active.current) setLoading(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (!requested) { await requestCode(); return; }
    if (password !== confirmation) { setError('The passwords do not match.'); return; }
    setLoading(true); setError('');
    const previousToken = getStoredToken();
    try {
      await api.resetPassword({ email, otp, password });
      // A submitted password change still invalidates this session if its dialog is closed.
      if (previousToken && getStoredToken() === previousToken) logout();
      if (active.current) onComplete();
    } catch (err) { if (active.current) setError(err.message); }
    finally { if (active.current) setLoading(false); }
  }
  return <form className="password-change-form" onSubmit={submit}>
    <p className="text-muted">Verify your email before setting a new password. You will need to sign in again afterward.</p>
    {error && <div className="alert alert-error" role="alert">{error}</div>}
    {notice && <div role="status" className="alert email-request-notice"><Mail size={18} aria-hidden="true" /><span><strong>Verification request received</strong><br />{notice}</span></div>}
    <label className="form-label" htmlFor="password-change-email">Account email</label>
    <input id="password-change-email" className="form-input" type="email" autoComplete="email" maxLength={254}
      value={email} required readOnly={fixedEmail || requested} disabled={loading} onChange={event => setEmail(event.target.value)} />
    {requested && <>
      <EmailVerificationCode id="password-change-otp" value={otp} onChange={setOtp} resendAt={resendAt} onResend={requestCode} disabled={loading} />
      <label className="form-label" htmlFor="password-change-new">New password</label>
      <input id="password-change-new" className="form-input" type="password" autoComplete="new-password" minLength={6} maxLength={72}
        value={password} required disabled={loading} onChange={event => setPassword(event.target.value)} />
      <label className="form-label" htmlFor="password-change-confirm">Confirm new password</label>
      <input id="password-change-confirm" className="form-input" type="password" autoComplete="new-password" minLength={6} maxLength={72}
        value={confirmation} required disabled={loading} onChange={event => setConfirmation(event.target.value)} />
    </>}
    <button className="auth-submit" disabled={loading} type="submit">
      {loading ? 'Please wait...' : requested ? 'Verify & change password' : 'Send verification code'}
    </button>
    {requested && !fixedEmail && <button className="btn btn-secondary" disabled={loading} type="button" onClick={() => {
      setRequested(false); setOtp(''); setPassword(''); setConfirmation(''); setError(''); setNotice('');
    }}>Use a different email</button>}
  </form>;
}
