import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoSource from '../assets/landing-logo.png';

export default function LoginPage({ onSwitchToRegister, onBackToLanding, formOnly = false }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try { await login(email, password); }
    catch (err) { setError(err.message || 'Invalid email or password'); }
    finally { setLoading(false); }
  };

  const formPanel = (
      <section className="auth-form-panel">
        <button type="button" className="auth-mini-brand" onClick={onBackToLanding} aria-label="Back to CareSync home"><span><img src={logoSource} alt="" /></span><b>CARESYNC</b></button>
        <div className="auth-card">
          <div className="auth-header"><p className="page-eyebrow">Welcome to your care portal</p><h2>Sign in to CareSync</h2><p>Access your appointments and consultation records.</p></div>
          {error && <div className="alert alert-error" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
          <form onSubmit={handleSubmit}>
            <label className="form-label" htmlFor="login-email">Email address</label>
            <input id="login-email" type="email" autoComplete="email" className="form-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className="form-label" htmlFor="login-password">Password</label>
            <input id="login-password" type="password" autoComplete="current-password" className="form-input" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" disabled={loading} className="auth-submit">{loading ? 'Signing in...' : 'Sign in'}</button>
          </form>
          <p className="auth-help">Need help accessing your account? Contact the clinic reception.</p>
        </div>
      </section>
  );

  if (formOnly) return formPanel;

  return (
    <div className="auth-wrapper auth-figma auth-login" data-node-id="64:8">
      {formPanel}
      <aside className="auth-welcome-panel"><div><h2>Your care.<br />Connected.</h2><p>New to CareSync? Create a patient account to plan your next visit.</p><button type="button" onClick={onSwitchToRegister}>Create an account</button></div></aside>
    </div>
  );
}
