/**
 * Clinic Display Screen
 * ─────────────────────
 * Public, unauthenticated full-screen display for the clinic waiting room.
 * Designed to run on a TV/monitor — shows "Now Serving" and upcoming queue.
 *
 * Access via:  http://localhost:3000/#/display
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { Activity, Users, Clock, Wifi, WifiOff, ChevronRight, RefreshCw, ArrowLeft } from 'lucide-react';

const POLL_INTERVAL = 10_000; // 10 seconds

export default function ClinicDisplayScreen() {
  const [data, setData] = useState({ nowServing: null, upcoming: [], updatedAt: null });
  const [clock, setClock] = useState(new Date());
  const [online, setOnline] = useState(true);
  const [pulse, setPulse] = useState(false);

  const fetchNowServing = useCallback(async () => {
    try {
      const res = await api.getNowServing();
      if (res.success && res.data) {
        setData(res.data);
        setOnline(true);
      }
    } catch {
      setOnline(false);
    }
  }, []);

  // Poll the API
  useEffect(() => {
    fetchNowServing();
    const interval = setInterval(fetchNowServing, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNowServing]);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Pulse animation on "now serving" change
  useEffect(() => {
    if (data.nowServing) {
      setPulse(true);
      const timeout = setTimeout(() => setPulse(false), 2000);
      return () => clearTimeout(timeout);
    }
  }, [data.nowServing?._id]);

  const formatTime = (date) =>
    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatDate = (date) =>
    date.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="clinic-display">
      {/* ── Header Bar ── */}
      <header className="cd-header">
        <div className="cd-header-left">
          <div className="cd-brand-icon">
            <Activity size={28} />
          </div>
          <div>
            <div className="cd-title">CareSync</div>
            <div className="cd-subtitle">Clinic Queue Display</div>
          </div>
        </div>
        <div className="cd-header-right">
          <div className="cd-clock">
            <Clock size={18} />
            <span>{formatTime(clock)}</span>
          </div>
          <div className="cd-date">{formatDate(clock)}</div>
          <div className={`cd-status-indicator ${online ? 'cd-online' : 'cd-offline'}`}>
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{online ? 'Live' : 'Offline'}</span>
          </div>
          <button
            onClick={() => { window.location.hash = ''; }}
            title="Exit Display & Return to Portal"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#cbd5e1',
              borderRadius: '8px',
              padding: '0.35rem 0.75rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={14} />
            <span>Portal</span>
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="cd-main">
        {/* Now Serving Panel */}
        <section className={`cd-now-serving ${pulse ? 'cd-pulse' : ''}`}>
          <div className="cd-section-label">
            <span className="cd-live-dot" />
            Now Serving
          </div>
          {data.nowServing ? (
            <div className="cd-serving-content">
              <div className="cd-queue-number-large">
                #{data.nowServing.queueNumber}
              </div>
              <div className="cd-patient-name">
                {data.nowServing.name}
              </div>
              <div className="cd-serving-badge">
                <RefreshCw size={14} className="cd-spin" />
                In Progress
              </div>
            </div>
          ) : (
            <div className="cd-serving-content">
              <div className="cd-queue-number-large cd-queue-idle">—</div>
              <div className="cd-patient-name cd-text-muted">
                No patient being served
              </div>
            </div>
          )}
        </section>

        {/* Upcoming Queue */}
        <section className="cd-upcoming">
          <div className="cd-section-label cd-upcoming-label">
            <Users size={20} />
            Up Next
            {data.upcoming.length > 0 && (
              <span className="cd-count-badge">{data.upcoming.length}</span>
            )}
          </div>

          {data.upcoming.length > 0 ? (
            <div className="cd-queue-list">
              {data.upcoming.map((entry, index) => (
                <div
                  key={entry._id}
                  className={`cd-queue-item ${index === 0 ? 'cd-next-up' : ''}`}
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <div className="cd-queue-rank">
                    {index === 0 ? (
                      <ChevronRight size={18} className="cd-chevron" />
                    ) : (
                      <span className="cd-rank-num">{index + 1}</span>
                    )}
                  </div>
                  <div className="cd-queue-number">
                    #{entry.queueNumber}
                  </div>
                  <div className="cd-queue-name">
                    {entry.name}
                  </div>
                  <div className={`cd-queue-status cd-status-${entry.status.replace(/\s+/g, '-')}`}>
                    <span className="cd-status-dot" />
                    {entry.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="cd-empty-queue">
              <Users size={48} strokeWidth={1} />
              <p>No patients in queue</p>
            </div>
          )}
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="cd-footer">
        <span>Please wait for your number to be called</span>
        <span className="cd-footer-dot">•</span>
        <span>Auto-refreshes every {POLL_INTERVAL / 1000}s</span>
      </footer>
    </div>
  );
}
