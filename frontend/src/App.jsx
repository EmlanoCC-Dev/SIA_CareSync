import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import StaffDashboard from './pages/StaffDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ClinicDisplayScreen from './pages/ClinicDisplayScreen';
import { Activity, CalendarCheck } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState('landing'); // 'landing' | 'login' | 'register'
  const [hash, setHash] = useState(window.location.hash);
  const authDialog = useRef(null);
  useEffect(() => { if (user) setAuthView('login'); }, [user]);


  // Listen for hash changes so the display route works
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (authView !== 'landing' && !user && authDialog.current && !authDialog.current.open) {
      authDialog.current.showModal();
    }
  }, [authView, user]);

  // ★ Public display screen — no auth required
  if (hash === '#/display') {
    return <ClinicDisplayScreen />;
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="brand-icon" style={{ width: '48px', height: '48px', margin: '0 auto 1rem', borderRadius: '12px' }}>
            <Activity size={28} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loading CareSync...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <>
      <LandingPage onLogin={() => setAuthView('login')} onRegister={() => setAuthView('register')} />
      {authView !== 'landing' && (
        <dialog ref={authDialog} className="auth-modal-backdrop" aria-label={authView === 'login' ? 'Sign in' : 'Create account'} onCancel={() => setAuthView('landing')} onMouseDown={(event) => event.target === event.currentTarget && setAuthView('landing')}>
          <button type="button" className="auth-modal-close" onClick={() => setAuthView('landing')} aria-label="Close">&times;</button>
          <div className={`auth-wrapper auth-figma auth-slider ${authView === 'register' ? 'auth-register' : 'auth-login'}`}>
            <div className="auth-moving-form">
              <div hidden={authView !== 'login'}><LoginPage formOnly onBackToLanding={() => setAuthView('landing')} /></div>
              <div hidden={authView !== 'register'}><RegisterPage formOnly onBackToLanding={() => setAuthView('landing')} /></div>
            </div>
            <aside className="auth-welcome-panel">
              <div>
                <span className="auth-panel-icon"><CalendarCheck size={26} /></span>
                <h2>Your care.<br />Connected.</h2>
                <p>Plan your next visit, manage your appointments, and keep your consultation records together.</p>
                <p>{authView === 'register' ? 'Already have a CareSync account?' : 'New to CareSync? Start your patient account.'}</p>
                <button type="button" onClick={() => setAuthView(authView === 'register' ? 'login' : 'register')}>{authView === 'register' ? 'Sign in to your account' : 'Create a patient account'}</button>
              </div>
            </aside>
          </div>
        </dialog>
      )}
    </>;
  }

  const renderDashboard = () => {
    switch (user.role) {
      case 'Doctor':
        return <DoctorDashboard />;
      case 'Staff':
        return <StaffDashboard />;
      case 'Admin':
        return <AdminDashboard />;
      case 'Patient':
      default:
        return <PatientDashboard />;
    }
  };

  return (
    <div className="app-container">
      <Navbar />
      {renderDashboard()}
    </div>
  );
}

