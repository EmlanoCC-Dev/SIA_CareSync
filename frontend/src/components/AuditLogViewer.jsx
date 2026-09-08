import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldAlert, RefreshCw, Clock, User, FileText, ChevronDown, ChevronRight, CheckCircle2, Code2, Tag, Calendar, AlertCircle } from 'lucide-react';

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedJson, setExpandedJson] = useState({});

  const toggleJson = (id) => {
    setExpandedJson((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs();
      if (res.success && res.data) {
        const logsList = Array.isArray(res.data) ? res.data : (res.data.logs || []);
        setLogs(logsList);
      } else {
        setLogs([]);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionBadgeColor = (action = '') => {
    if (action.includes('BOOKED')) return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
    if (action.includes('APPROVED') || action.includes('COMPLETED')) return { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
    if (action.includes('CANCELLED') || action.includes('DECLINED') || action.includes('NO_SHOW')) return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' };
    if (action.includes('CHECKED_IN') || action.includes('IN_PROGRESS')) return { bg: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9' };
    if (action.includes('DOCUMENT')) return { bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' };
    return { bg: 'var(--indigo-light)', color: 'var(--indigo)' };
  };

  const renderPayloadSummary = (log) => {
    const changes = log.changes || {};
    const apt = changes.appointment || {};
    const slot = changes.slot || {};
    const walkIn = changes.walkIn || {};
    const isJsonOpen = !!expandedJson[log._id];

    return (
      <div style={{ fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          {/* Status Changed */}
          {apt.status && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Status:</span>
              <span className={`badge badge-${apt.status.replace(/\s+/g, '-')}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                {apt.status}
              </span>
            </div>
          )}

          {/* Reason / Remarks */}
          {(apt.reason || apt.declineReason || changes.reason) && (
            <div style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Reason:</span>
              <span>"{apt.reason || apt.declineReason || changes.reason}"</span>
            </div>
          )}

          {/* Time Slot & Date */}
          {(apt.timeSlot || apt.date || slot.startTime) && (
            <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
              <Calendar size={12} />
              <span>
                {apt.date ? new Date(apt.date).toLocaleDateString() : ''} 
                {apt.timeSlot ? ` (${apt.timeSlot})` : (slot.startTime ? ` (${slot.startTime} - ${slot.endTime})` : '')}
              </span>
            </div>
          )}

          {/* Walk-in info */}
          {walkIn.name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-main)' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Walk-In:</span>
              <strong>#{walkIn.queueNumber} - {walkIn.name}</strong>
            </div>
          )}

          {/* Consultation Notes or Uploaded Documents */}
          {apt.consultationNotes && (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontStyle: 'italic' }}>
              Notes: "{apt.consultationNotes.substring(0, 60)}{apt.consultationNotes.length > 60 ? '...' : ''}"
            </div>
          )}

          {Array.isArray(apt.documents) && apt.documents.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#8b5cf6', fontSize: '0.75rem' }}>
              <FileText size={12} />
              <span>{apt.documents.length} document(s) attached</span>
            </div>
          )}
        </div>

        {/* Toggle Raw JSON Button */}
        <div style={{ marginTop: '0.4rem' }}>
          <button
            type="button"
            onClick={() => toggleJson(log._id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.7rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              padding: 0,
            }}
          >
            <Code2 size={11} />
            <span>{isJsonOpen ? 'Hide Raw JSON' : 'View Raw Payload'}</span>
            {isJsonOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>

          {isJsonOpen && (
            <pre
              style={{
                background: 'var(--bg-muted, #f3f4f6)',
                padding: '0.5rem',
                borderRadius: '6px',
                fontSize: '0.7rem',
                maxWidth: '340px',
                maxHeight: '160px',
                overflow: 'auto',
                marginTop: '0.35rem',
                border: '1px solid var(--border-color, #e5e7eb)',
              }}
            >
              {JSON.stringify(changes, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShieldAlert size={22} color="var(--indigo)" />
          <div>
            <h3 style={{ margin: 0 }}>System Audit Trail (Module 9)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Immutable record of all appointment transitions, file uploads, and state changes
            </p>
          </div>
        </div>
        <button onClick={fetchLogs} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th style={{ width: '18%' }}>Timestamp</th>
              <th style={{ width: '22%' }}>Action</th>
              <th style={{ width: '15%' }}>Target Entity</th>
              <th style={{ width: '20%' }}>Performed By</th>
              <th style={{ width: '25%' }}>Changes / Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading audit records...' : 'No audit logs recorded yet.'}
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const actionBadge = getActionBadgeColor(log.action);
                return (
                  <tr key={log._id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={13} />
                        {new Date(log.timestamp).toLocaleString()}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '0.25rem 0.55rem',
                          background: actionBadge.bg,
                          color: actionBadge.color,
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          display: 'inline-block',
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{log.targetModel}</div>
                      {log.targetId && (
                        <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          #{log.targetId.substring(log.targetId.length - 6)}
                        </div>
                      )}
                    </td>
                    <td>
                      {log.performedBy ? (
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {log.performedBy.firstName} {log.performedBy.lastName}
                          </div>
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                            {log.performedBy.email}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
                          System Automated Event
                        </span>
                      )}
                    </td>
                    <td>
                      {renderPayloadSummary(log)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
