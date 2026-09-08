import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, FileText, Plus, Trash2, CheckCircle2, Save, User, Calendar, Clock, AlertCircle } from 'lucide-react';

export default function ConsultationModal({ isOpen, onClose, appointment, onSuccess }) {
  const [consultationNotes, setConsultationNotes] = useState('');
  const [documents, setDocuments] = useState([]);
  const [newDocFilename, setNewDocFilename] = useState('');
  const [newDocType, setNewDocType] = useState('lab_result');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (appointment) {
      setConsultationNotes(appointment.consultationNotes || '');
      setDocuments(appointment.documents ? [...appointment.documents] : []);
      setError('');
      setSaveSuccess(false);
    }
  }, [appointment, isOpen]);

  if (!isOpen || !appointment) return null;

  const handleAddDocument = (e) => {
    e.preventDefault();
    if (!newDocFilename.trim()) return;

    setDocuments([
      ...documents,
      {
        filename: newDocFilename.trim(),
        type: newDocType,
        url: newDocUrl.trim() || '#',
        uploadedAt: new Date().toISOString(),
      },
    ]);
    setNewDocFilename('');
    setNewDocUrl('');
  };

  const handleRemoveDocument = (index) => {
    setDocuments(documents.filter((_, i) => i !== index));
  };

  const handleSaveNotes = async () => {
    setLoading(true);
    setError('');
    setSaveSuccess(false);
    try {
      await api.uploadDocuments(appointment._id, {
        consultationNotes,
        documents,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onSuccess && onSuccess();
    } catch (err) {
      setError(err.message || 'Failed to save consultation notes');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteConsultation = async () => {
    if (!window.confirm('Are you sure you want to finalize and mark this consultation as Completed?')) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      // First persist any notes & documents
      await api.uploadDocuments(appointment._id, {
        consultationNotes,
        documents,
      });
      // Then mark complete
      await api.completeAppointment(appointment._id);
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to complete consultation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="var(--primary)" />
            <h3>Consultation Notes & Medical Records</h3>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="alert" style={{ background: 'var(--emerald-light)', color: 'var(--emerald)', border: '1px solid #a7f3d0', marginBottom: '1rem' }}>
              <CheckCircle2 size={16} />
              <span>Consultation notes saved successfully!</span>
            </div>
          )}

          {/* Patient Details Snapshot */}
          <div style={{ background: 'var(--bg-muted)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <User size={16} color="var(--text-muted)" />
                <strong>
                  {appointment.patient?.firstName} {appointment.patient?.lastName}
                </strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <Calendar size={14} />
                <span>{new Date(appointment.date).toLocaleDateString()}</span>
                <Clock size={14} style={{ marginLeft: '0.5rem' }} />
                <span>{appointment.timeSlot}</span>
              </div>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Reason for visit: </span>
              {appointment.reason}
            </div>
          </div>

          {/* Consultation Notes */}
          <div className="form-group">
            <label className="form-label">Clinical Notes & Diagnosis</label>
            <textarea
              rows={5}
              className="form-textarea"
              placeholder="Enter patient diagnosis, clinical observations, prescribed medications, and follow-up instructions..."
              value={consultationNotes}
              onChange={(e) => setConsultationNotes(e.target.value)}
            />
          </div>

          {/* Medical Documents & Attachments */}
          <div style={{ marginTop: '1.5rem' }}>
            <label className="form-label">Attached Documents & Lab Reports ({documents.length})</label>

            {documents.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {documents.map((doc, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.85rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <FileText size={16} color="var(--primary)" />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{doc.filename}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {doc.type ? doc.type.replace('_', ' ') : 'General Document'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(idx)}
                      className="btn btn-danger btn-sm"
                      style={{ padding: '0.25rem 0.5rem' }}
                      title="Remove document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Document Section */}
            <div style={{ background: 'var(--bg-muted)', padding: '0.85rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                Add New Document / Lab Report
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="form-input"
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                  placeholder="Document title (e.g. Chest X-Ray.pdf)"
                  value={newDocFilename}
                  onChange={(e) => setNewDocFilename(e.target.value)}
                />
                <select
                  className="form-select"
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem' }}
                  value={newDocType}
                  onChange={(e) => setNewDocType(e.target.value)}
                >
                  <option value="lab_result">Lab Result</option>
                  <option value="radiology">Radiology / X-Ray</option>
                  <option value="prescription">Prescription</option>
                  <option value="referral">Referral Letter</option>
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddDocument}
                  disabled={!newDocFilename.trim()}
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleSaveNotes}
              disabled={loading}
              className="btn btn-secondary"
            >
              <Save size={16} />
              <span>{loading ? 'Saving...' : 'Save Notes'}</span>
            </button>
            <button
              type="button"
              onClick={handleCompleteConsultation}
              disabled={loading}
              className="btn btn-teal"
            >
              <CheckCircle2 size={16} />
              <span>{loading ? 'Finalizing...' : 'Complete Consultation'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
