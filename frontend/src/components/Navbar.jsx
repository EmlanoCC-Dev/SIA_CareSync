import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, LogOut, User as UserIcon, Tv } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
    </header>
  );
}
