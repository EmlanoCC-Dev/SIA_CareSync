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
          <div className="auth-header"><h2>Sign In</h2><p>Sign In With Email &amp; Password</p></div>
          {error && <div className="alert alert-error"><AlertCircle size={16} /><span>{error}</span></div>}
          <form onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="login-email">Email Address</label>
            <input id="login-email" type="email" className="form-input" placeholder="Enter E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className="sr-only" htmlFor="login-password">Password</label>
            <input id="login-password" type="password" className="form-input" placeholder="Enter Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="auth-forgot">Forget Password?</button>
            <button type="submit" disabled={loading} className="auth-submit">{loading ? 'Signing in...' : 'SIGN IN'}</button>
          </form>
        </div>
      </section>
  );

  if (formOnly) return formPanel;

  return (
    <div className="auth-wrapper auth-figma auth-login" data-node-id="64:8">
      {formPanel}
      <aside className="auth-welcome-panel"><div><h2>Hello!</h2><p>Sign Up now and enjoy our site</p><button type="button" onClick={onSwitchToRegister}>SIGN UP</button></div></aside>
    </div>
  );
}
