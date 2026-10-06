/** Public waiting-room display, available at #/display. */
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import careSyncLogo from '../assets/caresync-logo.svg';
import { api } from '../services/api';

const POLL_INTERVAL = 10_000;

export default function ClinicDisplayScreen() {
  const [data, setData] = useState({ nowServing: null, upcoming: [], updatedAt: null });
  const [clock, setClock] = useState(new Date());
  const [online, setOnline] = useState(true);
  const [pulse, setPulse] = useState(false);
  const [systemStatus, setSystemStatus] = useState({ isOpen: true, isCustom: false });

  const fetchNowServing = useCallback(async () => {
    try {
      const [queueRes, timeRes] = await Promise.all([
        api.getNowServing(),
        api.getSystemTime().catch(() => null),
      ]);
      if (queueRes.success && queueRes.data) {
        setData(queueRes.data);
        setOnline(true);
      }
      if (timeRes?.success && timeRes.data) {
        setSystemStatus({
          isOpen: timeRes.data.isOpen,
          isCustom: timeRes.data.isCustom,
          operatingHours: timeRes.data.operatingHours,
        });
        setClock(new Date(timeRes.data.currentTime));
      }
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    fetchNowServing();
    const interval = setInterval(fetchNowServing, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNowServing]);

  useEffect(() => {
    const timer = setInterval(() => {
      setClock((previous) => new Date(previous.getTime() + 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!data.nowServing) return undefined;
    setPulse(true);
    const timeout = setTimeout(() => setPulse(false), 2000);
    return () => clearTimeout(timeout);
  }, [data.nowServing?.queueNumber]);

  const formatTime = (date) => date.toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const formatDate = (date) => date.toLocaleDateString([], {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const queueIsOpen = systemStatus.isOpen && online;

  return (
    <div className="clinic-display" data-node-id="186:446">
      <header className="cd-header" data-node-id="186:565">
        <div className="cd-brand" aria-label="CareSync">
          <span className="cd-brand-mark">
            <img src={careSyncLogo} alt="" />
          </span>
          <div><span className="cd-wordmark"><b>CARE</b><em>SYNC</em></span><p className="cd-brand-caption">Patient queue · Waiting room</p></div>
        </div>
        <time className="cd-date" dateTime={clock.toISOString()}>{formatDate(clock)}</time>
      </header>

      <div className="cd-information-bar">
        <time className="cd-clock" dateTime={clock.toISOString()}>
          {formatTime(clock)}
          {systemStatus.isCustom && <span className="cd-simulated">Simulated</span>}
        </time>
        <div className={`cd-queue-state ${queueIsOpen ? 'is-open' : 'is-closed'}`}>
          <span className="cd-state-dot" />
          {queueIsOpen ? 'Queue Open' : online ? 'Queue Closed' : 'Offline'}
        </div>
      </div>

      <main className="cd-main">
        <section className={`cd-panel cd-now-serving ${pulse ? 'cd-pulse' : ''}`}>
          <div className="cd-section-label cd-serving-label">
            <span className="cd-live-dot" />
            Now Serving
          </div>
          {data.nowServing ? (
            <div className="cd-serving-content">
              <div className={`cd-queue-number-large${String(data.nowServing.queueNumber).startsWith('A-') ? ' is-scheduled' : ''}`}>#{data.nowServing.queueNumber}</div>
              <div className="cd-patient-name">Please proceed to consultation</div>
              <div className="cd-serving-badge">
                <RefreshCw size={18} className="cd-spin" /> In Progress
              </div>
              {data.serving?.length > 1 && <p>Also in consultation: {data.serving.slice(1).map(entry => `#${entry.queueNumber}`).join(', ')}</p>}
            </div>
          ) : (
            <div className="cd-serving-content cd-serving-empty">
              <p>Waiting for the next consultation</p>
            </div>
          )}
        </section>

        <section className="cd-panel cd-upcoming">
          <div className="cd-section-label cd-upcoming-label">
            <Users aria-hidden="true" /> Up Next
            {data.upcoming.length > 0 && <span className="cd-count-badge">{data.upcoming.length}</span>}
          </div>
          {data.upcoming.length > 0 ? (
            <div className="cd-queue-list">
              {data.upcoming.map((entry, index) => (
                <div key={entry.queueNumber} className={`cd-queue-item ${index === 0 ? 'cd-next-up' : ''}`} style={{ animationDelay: `${index * 0.08}s` }}>
                  <span className="cd-queue-rank">{index + 1}</span>
                  <strong className="cd-queue-number">#{entry.queueNumber}</strong>
                  <span className="cd-queue-name">{String(entry.queueNumber).startsWith('A-') ? 'Scheduled visit' : 'Walk-in'}</span>
                  <span className={`cd-queue-status cd-status-${entry.status.replace(/\s+/g, '-')}`}>
                    <span className="cd-status-dot" /> {entry.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="cd-empty-queue">
              <Users aria-hidden="true" />
              <p>No patients waiting</p>
              <small>Please check in at reception when you arrive.</small>
            </div>
          )}
        </section>
      </main>

      <footer className="cd-footer" data-node-id="186:585">
        A- tickets are scheduled visits. Please wait for your number to be called.
      </footer>
    </div>
  );
}
