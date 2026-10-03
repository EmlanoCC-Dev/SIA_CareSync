import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoSource from '../assets/landing-logo.png';
import { api } from '../services/api';
import EmailVerificationCode from '../components/EmailVerificationCode';

export default function RegisterPage({ onSwitchToLogin, onBackToLanding, formOnly = false }) {
  const { register } = useAuth();
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'Patient', contactNumber: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const handleChange = (event) => setFormData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  const requestCode = async () => {
    setError(''); setNotice(''); setLoading(true);
    try {
      const response = await api.requestRegistrationOtp(formData.email);
      if (!active.current) return;
      setRequested(true); setOtp(''); setResendAt(Date.now() + response.data.resendAfterSeconds * 1000);
      setNotice('Verification email sent successfully. Check your inbox or spam folder.');
    } catch (err) { if (active.current) setError(err.message || 'Could not send verification code'); }
    finally { if (active.current) setLoading(false); }
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!requested) { await requestCode(); return; }
    setLoading(true);
    try { await register({ ...formData, otp, lastName: formData.lastName || '-' }); }
    catch (err) { if (active.current) setError(err.message || 'Registration failed'); }
    finally { if (active.current) setLoading(false); }
  };

  const formPanel = (
      <section className="auth-form-panel">
        <button type="button" className="auth-mini-brand" onClick={onBackToLanding} aria-label="Back to CareSync home"><span><img src={logoSource} alt="" /></span><b>CARESYNC</b></button>
        <div className="auth-card">
          <div className="auth-header"><p className="page-eyebrow">Your next visit starts here</p><h2>{requested ? 'Verify your email' : 'Create your account'}</h2><p>{requested ? `Enter the code sent to ${formData.email}.` : 'Join CareSync to book and manage your care.'}</p></div>
          {error && <div className="alert alert-error" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
          {notice && <div className="alert alert-success email-send-notice" role="status"><CheckCircle2 size={18} aria-hidden="true" /><span>{notice}</span></div>}
          <form onSubmit={handleSubmit}>
            {!requested ? <>
            <div className="form-row">
              <div><label className="form-label" htmlFor="register-name">First name</label><input id="register-name" name="firstName" autoComplete="given-name" maxLength={100} disabled={loading} className="form-input" placeholder="First name" value={formData.firstName} onChange={handleChange} required /></div>
              <div><label className="form-label" htmlFor="register-last-name">Last name</label><input id="register-last-name" name="lastName" autoComplete="family-name" maxLength={100} disabled={loading} className="form-input" value={formData.lastName} onChange={handleChange} placeholder="Last name" required /></div>
            </div>
            <label className="form-label" htmlFor="register-email">Email address</label>
            <input id="register-email" type="email" name="email" autoComplete="email" maxLength={254} disabled={loading} className="form-input" placeholder="you@example.com" value={formData.email} onChange={handleChange} required />
            <label className="form-label" htmlFor="register-password">Password</label>
            <input id="register-password" type="password" name="password" autoComplete="new-password" minLength={6} maxLength={72} disabled={loading} className="form-input" placeholder="At least 6 characters" value={formData.password} onChange={handleChange} required />
            </> : <EmailVerificationCode id="register-otp" value={otp} onChange={setOtp} resendAt={resendAt} onResend={requestCode} disabled={loading} />}
            <button type="submit" disabled={loading} className="auth-submit">{loading ? 'Please wait...' : requested ? 'Verify & create account' : 'Send verification code'}</button>
            {requested && <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => { setRequested(false); setOtp(''); setError(''); setNotice(''); }}>Edit account details</button>}
          </form>
          <p className="auth-help">Your account gives you access to your appointment history and consultation records.</p>
        </div>
      </section>
  );

  if (formOnly) return formPanel;

  return (
    <div className="auth-wrapper auth-figma auth-register" data-node-id="66:38">
      <aside className="auth-welcome-panel"><div><h2>Welcome to<br />better care.</h2><p>Already registered? Sign in to manage your upcoming visits.</p><button type="button" onClick={onSwitchToLogin}>Sign in to your account</button></div></aside>
      {formPanel}
    </div>
  );
}
