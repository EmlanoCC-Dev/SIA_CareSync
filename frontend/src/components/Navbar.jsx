import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { api } from '../services/api';
import SystemTimeModal from './SystemTimeModal';
import NotificationInbox from './NotificationInbox';
import PasswordChangeForm from './PasswordChangeForm';
import { LogOut, Tv, Clock, KeyRound, X } from 'lucide-react';
import logoSource from '../assets/landing-logo.png';

export default function Navbar() {
  const { user, logout } = useAuth();
  const showDialog = useDialog();
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [systemTimeStatus, setSystemTimeStatus] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const passwordDialog = useRef(null);
  useEffect(() => {
    if (!passwordOpen || !passwordDialog.current) return;
    const previousFocus = document.activeElement;
    passwordDialog.current.showModal();
    return () => previousFocus?.focus();
  }, [passwordOpen]);

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
        <div>
          <div className="brand">
            <span className="nav-brand-mark"><img src={logoSource} alt="" /></span>
            <span><b>CARE</b><em>SYNC</em></span>
          </div>
          <p className="brand-caption">Appointments &amp; patient flow</p>
        </div>

        <div className="navbar-tools">
          {user && <NotificationInbox key={user._id} />}
          {/* System Time & Clinic Operating Status */}
          {systemTimeStatus && <time dateTime={systemTimeStatus.currentTime} style={{ fontSize: '0.85rem' }}>
            {new Date(systemTimeStatus.currentTime).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
            {systemTimeStatus.isCustom ? ' (Simulated)' : ''}
          </time>}
          <button
            type="button"
            onClick={() => setIsTimeModalOpen(true)}
            className="btn btn-secondary btn-sm"
            title="Clinic clock and operating hours"
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
            <span>Waiting room display</span>
          </a>

          {user && (
            <div className="navbar-user">
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {user.firstName} {user.lastName}
                </div>
                <span className={`role-badge role-${user.role}`}>{user.role}</span>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPasswordOpen(true)}>
                <KeyRound size={16} /><span>Change password</span>
              </button>
              <button
                onClick={async () => {
                  if (await showDialog({ kind: 'confirm', title: 'Sign out', message: 'Are you sure you want to sign out?', confirmText: 'Sign out', cancelText: 'Stay signed in' })) logout();
                }}
                className="btn btn-secondary btn-sm"
                title="Sign Out"
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <SystemTimeModal
        isOpen={isTimeModalOpen}
        onClose={() => setIsTimeModalOpen(false)}
        onTimeChanged={fetchTime}
        canEdit={user?.role === 'Admin'}
      />
      {passwordOpen && <dialog ref={passwordDialog} className="modal-content password-dialog" aria-labelledby="password-dialog-title" onCancel={() => setPasswordOpen(false)}>
        <div className="modal-header"><h2 id="password-dialog-title">Change password</h2>
          <button type="button" className="btn btn-secondary btn-sm" aria-label="Close password change" onClick={() => setPasswordOpen(false)}><X size={18} /></button>
        </div>
        <div className="modal-body"><PasswordChangeForm initialEmail={user.email} fixedEmail onComplete={() => setPasswordOpen(false)} /></div>
      </dialog>}
    </header>
  );
}
