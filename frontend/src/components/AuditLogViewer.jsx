import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { ShieldAlert, RefreshCw, Clock, User, FileText } from 'lucide-react';

export default function AuditLogViewer() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs();
      if (res.success && res.data) {
        // Backend returns paginated object { logs: [...], total, page, limit }
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

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShieldAlert size={22} color="var(--indigo)" />
          <div>
            <h3>System Audit Trail (Module 9)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Immutable record of all appointment transitions and state changes
            </p>
          </div>
        </div>
        <button onClick={fetchLogs} className="btn btn-secondary btn-sm">
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Target Model</th>
              <th>Performed By</th>
              <th>Changes / Payload</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading audit records...' : 'No audit logs recorded yet.'}
                </td>
              </tr>
            ) : (
              logs.map((log) => (
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
                        padding: '0.2rem 0.5rem',
                        background: 'var(--indigo-light)',
                        color: 'var(--indigo)',
                        borderRadius: '4px',
                        fontWeight: 600,
                        fontSize: '0.775rem',
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <strong>{log.targetModel}</strong>
                    {log.targetId && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                        (#{log.targetId.substring(log.targetId.length - 6)})
                      </span>
                    )}
                  </td>
                  <td>
                    {log.performedBy ? (
                      <div>
                        {log.performedBy.firstName} {log.performedBy.lastName}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.performedBy.email}</div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>System Event</span>
                    )}
                  </td>
                  <td>
                    <pre
                      style={{
                        background: 'var(--bg-muted)',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        maxWidth: '280px',
                        overflowX: 'auto',
                      }}
                    >
                      {JSON.stringify(log.changes || {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
