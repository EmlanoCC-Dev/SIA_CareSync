import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDialog } from '../context/DialogContext';
import { api } from '../services/api';
import SystemTimeModal from './SystemTimeModal';
import NotificationInbox from './NotificationInbox';
import PasswordChangeForm from './PasswordChangeForm';
import { LogOut, Tv, Clock, KeyRound, Menu, X } from 'lucide-react';
import logoSource from '../assets/caresync-logo.svg';

export default function Navbar() {
  const { user, logout } = useAuth();
  const showDialog = useDialog();
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [systemTimeStatus, setSystemTimeStatus] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const passwordDialog = useRef(null);
  const menuDialog = useRef(null);
  const menuButton = useRef(null);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 768px)').matches);
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    menuDialog.current?.close();
    setMenuOpen(false);
    menuButton.current?.focus();
  }

  useEffect(() => {
    const node = menuDialog.current;
    // Workspace navigation is portaled, so listen along the DOM tree.
    const onClick = event => {
      if (!node.matches(':modal')) return;
      if (event.target === node) {
        const bounds = node.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeMenu();
      } else if (event.target.closest('#workspace-navigation button, #workspace-navigation a, .navbar-tools button, .navbar-tools a')) closeMenu();
    };
    node.addEventListener('click', onClick);
    return () => node.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 768px)');
    const onResize = () => {
      if (menuDialog.current?.matches(':modal')) menuDialog.current.close();
      setMenuOpen(false);
      setMobile(query.matches);
    };
    query.addEventListener('change', onResize);
    return () => query.removeEventListener('change', onResize);
  }, []);

  useEffect(() => {
    if (!mobile || !menuOpen) return;
    menuDialog.current.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [mobile, menuOpen]);
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

        <div className="navbar-header-actions">
          {user && <NotificationInbox key={user._id} />}
          <button ref={menuButton} type="button" className="btn btn-secondary mobile-menu-trigger"
            aria-haspopup="dialog" aria-controls="workspace-menu" aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}><Menu size={20} /><span>Menu</span></button>
        </div>

        <dialog ref={menuDialog} id="workspace-menu" className="navbar-menu" role={mobile ? undefined : 'presentation'}
          aria-label="Workspace menu"
          onCancel={event => { event.preventDefault(); closeMenu(); }}>
        <div className="mobile-menu-heading">
          <h2>Workspace menu</h2>
          <button type="button" className="btn btn-secondary" aria-label="Close menu" onClick={closeMenu}><X size={20} /></button>
        </div>
        <div id="workspace-navigation" />

        <div className="navbar-tools">
          <p className="mobile-menu-section">Clinic tools</p>
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
                background: !systemTimeStatus ? 'var(--text-muted)' : systemTimeStatus.isOpen ? '#10b981' : '#ef4444',
                marginLeft: '0.15rem',
              }}
              title={!systemTimeStatus ? 'Clinic status unavailable' : systemTimeStatus.isOpen ? 'Clinic Open (8:30 AM - 5:00 PM)' : 'Clinic Closed'}
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
              <p className="mobile-menu-section">Account</p>
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
        </dialog>
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
