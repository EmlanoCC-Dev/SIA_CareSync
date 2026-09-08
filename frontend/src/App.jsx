import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import StaffDashboard from './pages/StaffDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ClinicDisplayScreen from './pages/ClinicDisplayScreen';
import { Activity } from 'lucide-react';

export default function App() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' | 'register'
  const [hash, setHash] = useState(window.location.hash);

  // Listen for hash changes so the display route works
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

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
    if (authView === 'register') {
      return <RegisterPage onSwitchToLogin={() => setAuthView('login')} />;
    }
    return <LoginPage onSwitchToRegister={() => setAuthView('register')} />;
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

