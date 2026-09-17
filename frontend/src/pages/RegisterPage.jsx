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
          <div className="auth-header"><h2>Create Account</h2><p>Register with E-mail</p></div>
          {error && <div className="alert alert-error"><AlertCircle size={16} /><span>{error}</span></div>}
          <form onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="register-name">Name</label>
            <input id="register-name" name="firstName" className="form-input" placeholder="Name" value={formData.firstName} onChange={handleChange} required />
            <input name="lastName" className="auth-hidden-field" aria-label="Last Name" value={formData.lastName} onChange={handleChange} placeholder="Last Name" />
            <label className="sr-only" htmlFor="register-email">Email</label>
            <input id="register-email" type="email" name="email" className="form-input" placeholder="Enter E-mail" value={formData.email} onChange={handleChange} required />
            <label className="sr-only" htmlFor="register-password">Password</label>
            <input id="register-password" type="password" name="password" className="form-input" placeholder="Enter Password" value={formData.password} onChange={handleChange} required />
            <button type="submit" disabled={loading} className="auth-submit">{loading ? 'Creating...' : 'SIGN UP'}</button>
          </form>
        </div>
      </section>
  );

  if (formOnly) return formPanel;

  return (
    <div className="auth-wrapper auth-figma auth-register" data-node-id="66:38">
      <aside className="auth-welcome-panel"><div><h2>Welcome To<br />CareSync</h2><p>Sign In With Email &amp; Password</p><button type="button" onClick={onSwitchToLogin}>SIGN IN</button></div></aside>
      {formPanel}
    </div>
  );
}
