import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import logoSource from '../assets/landing-logo.png';

export default function RegisterPage({ onSwitchToLogin, onBackToLanding, formOnly = false }) {
  const { register } = useAuth();
  const [formData, setFormData] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'Patient', contactNumber: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const handleChange = (event) => setFormData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (formData.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try { await register({ ...formData, lastName: formData.lastName || '-' }); }
    catch (err) { setError(err.message || 'Registration failed'); }
    finally { setLoading(false); }
  };

  const formPanel = (
      <section className="auth-form-panel">
        <button type="button" className="auth-mini-brand" onClick={onBackToLanding} aria-label="Back to CareSync home"><span><img src={logoSource} alt="" /></span><b>CARESYNC</b></button>
        <div className="auth-card">
          <div className="auth-header"><p className="page-eyebrow">Your next visit starts here</p><h2>Create your account</h2><p>Join CareSync to book and manage your care.</p></div>
          {error && <div className="alert alert-error" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div><label className="form-label" htmlFor="register-name">First name</label><input id="register-name" name="firstName" autoComplete="given-name" className="form-input" placeholder="First name" value={formData.firstName} onChange={handleChange} required /></div>
              <div><label className="form-label" htmlFor="register-last-name">Last name</label><input id="register-last-name" name="lastName" autoComplete="family-name" className="form-input" value={formData.lastName} onChange={handleChange} placeholder="Last name" required /></div>
            </div>
            <label className="form-label" htmlFor="register-email">Email address</label>
            <input id="register-email" type="email" name="email" autoComplete="email" className="form-input" placeholder="you@example.com" value={formData.email} onChange={handleChange} required />
            <label className="form-label" htmlFor="register-password">Password</label>
            <input id="register-password" type="password" name="password" autoComplete="new-password" minLength={6} className="form-input" placeholder="At least 6 characters" value={formData.password} onChange={handleChange} required />
            <button type="submit" disabled={loading} className="auth-submit">{loading ? 'Creating your account...' : 'Create patient account'}</button>
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
