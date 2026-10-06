import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import LoadError from './LoadError';
import { dateKey } from '../utils/dates';
import { X, Clock, Calendar, CheckCircle2, RotateCcw, AlertCircle, Sun, Moon, Sparkles } from 'lucide-react';

export default function SystemTimeModal({ isOpen, onClose, onTimeChanged, canEdit = false }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, [isOpen]);
  const [status, setStatus] = useState({
    currentTime: new Date().toISOString(),
    isOpen: true,
    isCustom: false,
    openTime: '08:30',
    closeTime: '17:00',
  });
  const [inputDate, setInputDate] = useState('');
  const [inputTime, setInputTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen]);

  const fetchStatus = async () => {
    setStatusError('');
    try {
      const res = await api.getSystemTime();
      if (res.success && res.data) {
        setStatus(res.data);
        const d = new Date(res.data.currentTime);
        setInputDate(dateKey(d));
        setInputTime(d.toTimeString().substring(0, 5));
      }
    } catch (err) {
      setStatusError('Clinic time and operating status could not be loaded.');
    }
  };

  if (!isOpen) return null;

  const handleApplyCustomTime = async (dateTimeString) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.setSystemTime({ time: dateTimeString });
      if (res.success && res.data) {
        setStatus(res.data);
        onTimeChanged && onTimeChanged(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to set system time');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!inputDate || !inputTime) {
      setError('Please select both date and time');
      return;
    }
    const combined = `${inputDate}T${inputTime}:00`;
    handleApplyCustomTime(combined);
  };

  const handleResetToReal = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.setSystemTime({ reset: true });
      if (res.success && res.data) {
        setStatus(res.data);
        onTimeChanged && onTimeChanged(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to reset system time');
    } finally {
      setLoading(false);
    }
  };

  // Quick Presets
  const setPreset = (targetTimeStr, dayOffset = 0) => {
    const d = new Date(status.currentTime);
    d.setDate(d.getDate() + dayOffset);
    const dateStr = dateKey(d);
    const fullIso = `${dateStr}T${targetTimeStr}:00`;
    handleApplyCustomTime(fullIso);
  };

  const formattedCurrentTime = new Date(status.currentTime).toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
      <dialog ref={dialog} className="modal-content care-dialog system-time-modal" style={{ maxWidth: '480px', width: '92%' }} aria-labelledby="system-time-title"
        onCancel={event => { if (loading) event.preventDefault(); else onClose(); }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={20} color="var(--primary)" />
            <h3 id="system-time-title" style={{ margin: 0 }}>System Time & Operating Hours</h3>
          </div>
          <button onClick={onClose} disabled={loading} aria-label="Close system time settings" className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <LoadError message={statusError} onRetry={fetchStatus} loading={loading} />
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Current Status Box */}
          {!statusError && <div
            style={{
              background: status.isOpen ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${status.isOpen ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>CURRENT SYSTEM TIME</span>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  background: status.isOpen ? 'var(--emerald, #10b981)' : '#ef4444',
                  color: '#fff',
                }}
              >
                {status.isOpen ? '● Clinic OPEN (8:30 AM - 5:00 PM)' : '○ Clinic CLOSED'}
              </span>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {formattedCurrentTime}
            </div>
            {status.isCustom && (
              <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem', fontWeight: 500 }}>
                ⚡ Custom Simulated Time Active
              </div>
            )}
          </div>}

          {/* Quick Scenario Testing Presets */}
          {canEdit && !statusError && <>
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
              <Sparkles size={14} color="var(--primary)" />
              <span>Quick Scenario Presets</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreset('08:30')}
                disabled={loading}
                style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
              >
                <Sun size={14} color="#f59e0b" />
                <span>08:30 AM (Opening)</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreset('12:00')}
                disabled={loading}
                style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
              >
                <Sun size={14} color="#3b82f6" />
                <span>12:00 PM (Midday)</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreset('17:00')}
                disabled={loading}
                style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
              >
                <Clock size={14} color="#f97316" />
                <span>05:00 PM (Closing)</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreset('17:30')}
                disabled={loading}
                style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
              >
                <Moon size={14} color="#6b7280" />
                <span>05:30 PM (Closed)</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setPreset('08:30', 1)}
                disabled={loading}
                style={{ gridColumn: 'span 2', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
              >
                <Calendar size={14} color="var(--primary)" />
                <span>Tomorrow 08:30 AM (Test Daily Queue Reset to #1)</span>
              </button>
            </div>
          </div>

          {/* Custom Date & Time Form */}
          <form onSubmit={handleCustomSubmit} style={{ borderTop: '1px solid var(--border-color, #e5e7eb)', paddingTop: '1rem' }}>
            <label className="form-label" style={{ fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
              Set Specific Custom Date & Time
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div>
                <input
                  type="date"
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                  value={inputDate}
                  onChange={(e) => setInputDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <input
                  type="time"
                  className="form-input"
                  style={{ fontSize: '0.85rem' }}
                  value={inputTime}
                  onChange={(e) => setInputTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <CheckCircle2 size={13} />
                <span>{loading ? 'Applying...' : 'Apply Custom Time'}</span>
              </button>
            </div>
          </form>
          </>}
        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color, #e5e7eb)', paddingTop: '0.75rem' }}>
          {canEdit && <button type="button" onClick={handleResetToReal} disabled={loading} className="btn btn-secondary">
            <RotateCcw size={16} /> Reset to Real Time
          </button>}
          <button type="button" onClick={onClose} disabled={loading} className="btn btn-secondary">
            Close
          </button>
        </div>
      </dialog>
  );
}
