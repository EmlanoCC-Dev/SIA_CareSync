import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { X, UserPlus, AlertCircle, Clock } from 'lucide-react';

export default function AddWalkInModal({ isOpen, onClose, onAdded }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (!isOpen) return;
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, [isOpen]);
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeStatus, setTimeStatus] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      api.getSystemTime()
        .then(res => {
          if (res.success) setTimeStatus(res.data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.createWalkIn(formData);
      onAdded();
      onClose();
      setFormData({ name: '', email: '' });
    } catch (err) {
      setError(err.message || 'Failed to add walk-in');
    } finally {
      setLoading(false);
    }
  };

  return (
      <dialog ref={dialog} className="modal-content care-dialog walkin-dialog" style={{ maxWidth: '420px' }} aria-labelledby="walkin-title"
        onCancel={event => { if (loading) event.preventDefault(); else onClose(); }}>
        <div className="modal-header">
          <h3 id="walkin-title">Add Walk-In Patient</h3>
          <button className="btn-icon" onClick={onClose} disabled={loading} aria-label="Close walk-in form">
            <X size={20} />
          </button>
        </div>

        {/* Operating Hours Info */}
        {timeStatus && !timeStatus.isOpen && (
          <div
            style={{
              margin: '0.75rem 1.25rem 0 1.25rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              fontSize: '0.82rem',
            }}
          >
            <Clock size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Walk-in queue is currently closed.</strong>
              <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '2px' }}>
                Walk-ins are only accepted from 8:30 AM to 5:00 PM.
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              margin: '0.75rem 1.25rem 0 1.25rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.85rem',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label" htmlFor="walkin-name">Patient Name</label>
              <input
                id="walkin-name"
                type="text"
                className="form-input"
                required
                maxLength={200}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full Name"
              />
            </div>
            
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label" htmlFor="walkin-email">Patient Email</label>
              <input
                id="walkin-email"
                type="email"
                autoComplete="email"
                className="form-input"
                required
                maxLength={254}
                aria-describedby="walkin-account-help"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="patient@example.com"
              />
              <p id="walkin-account-help" className="care-dialog-message" style={{ marginTop: '8px' }}>An account is optional. Use this patient's own email. If they later create an account and verify the same email, their walk-in visits will appear in their patient portal.</p>
            </div>
          </div>
          
          <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <UserPlus size={16} />
              <span>{loading ? 'Adding...' : 'Add to Queue'}</span>
            </button>
          </div>
        </form>
      </dialog>
  );
}
