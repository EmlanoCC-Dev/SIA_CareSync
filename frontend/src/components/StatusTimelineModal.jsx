import React from 'react';
import { X, History, Clock, User, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function StatusTimelineModal({ isOpen, onClose, appointment }) {
  if (!isOpen || !appointment) return null;

  const history = appointment.statusHistory || [];

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Confirmed':
        return <CheckCircle size={14} color="#0284c7" />;
      case 'Completed':
        return <CheckCircle size={14} color="#10b981" />;
      case 'Cancelled':
        return <XCircle size={14} color="#f43f5e" />;
      default:
        return <AlertTriangle size={14} color="#f59e0b" />;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={20} color="var(--primary)" />
            <h3>Status History & Version Tracking</h3>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: '1.25rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>Appointment ID:</strong> #{appointment._id?.substring(appointment._id.length - 6)}
              </div>
              <span className={`badge badge-${appointment.status}`}>
                <span className="status-dot"></span>
                {appointment.status}
              </span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
              Reason: {appointment.reason}
            </div>
          </div>

          <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Transition Timeline
          </h4>

          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No status change logs available.</p>
          ) : (
            <div className="timeline">
              {history.map((entry, idx) => (
                <div key={idx} className="timeline-item">
                  <div className="timeline-dot" />
                  <div style={{ background: 'var(--bg-muted)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {getStatusIcon(entry.status)}
                        {entry.status}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={12} />
                        {new Date(entry.changedAt).toLocaleString()}
                      </span>
                    </div>
                    {entry.remarks && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.25rem' }}>
                        "{entry.remarks}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
