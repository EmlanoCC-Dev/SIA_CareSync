import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import SystemTimeModal from './SystemTimeModal';
import { Activity, LogOut, User as UserIcon, Tv, Clock } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [systemTimeStatus, setSystemTimeStatus] = useState(null);

  const fetchTime = async () => {
    try {
      const res = await api.getSystemTime();
      if (res.success && res.data) {
        setSystemTimeStatus(res.data);
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchTime();
    const timer = setInterval(fetchTime, 10000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand">
          <div className="brand-icon">
            <Activity size={22} />
          </div>
          <div>
            <span>CareSync</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* System Time & Clinic Operating Status */}
          <button
            type="button"
            onClick={() => setIsTimeModalOpen(true)}
            className="btn btn-secondary btn-sm"
            title="Click to test / adjust system time or clinic operating hours"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              padding: '0.35rem 0.65rem',
              borderColor: systemTimeStatus?.isCustom ? 'var(--primary)' : 'var(--border)',
            }}
          >
            <Clock size={14} color={systemTimeStatus?.isCustom ? 'var(--primary)' : 'var(--text-muted)'} />
            <span>
              {systemTimeStatus
                ? new Date(systemTimeStatus.currentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Clock'}
            </span>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: systemTimeStatus?.isOpen ? '#10b981' : '#ef4444',
                marginLeft: '0.15rem',
              }}
              title={systemTimeStatus?.isOpen ? 'Clinic Open (8:30 AM - 5:00 PM)' : 'Clinic Closed'}
            />
          </button>

          <a
            href="#/display"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
            title="Open Waiting Room TV Display Screen in new window"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
          >
            <Tv size={15} color="var(--primary)" />
            <span>TV Display</span>
          </a>

          {user && (
            <div className="navbar-user">
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {user.firstName} {user.lastName}
                </div>
                <span className={`role-badge role-${user.role}`}>{user.role}</span>
              </div>
              <button
                onClick={logout}
                className="btn btn-secondary btn-sm"
                title="Sign Out"
              >
                <LogOut size={16} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <SystemTimeModal
        isOpen={isTimeModalOpen}
        onClose={() => setIsTimeModalOpen(false)}
        onTimeChanged={fetchTime}
      />
    </header>
  );
}
