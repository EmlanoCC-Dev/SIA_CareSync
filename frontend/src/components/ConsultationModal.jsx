import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import VersionHistory from './VersionHistory';
import { useDialog } from '../context/DialogContext';
import { X, FileText, Plus, Archive, CheckCircle2, Save, User, Calendar, Clock, AlertCircle, Upload, ExternalLink, Paperclip } from 'lucide-react';

export default function ConsultationModal({ isOpen, onClose, appointment, onSuccess }) {
  const showDialog = useDialog();
  const [consultationNotes, setConsultationNotes] = useState('');
  const [documents, setDocuments] = useState([]);
  const [notesRevision, setNotesRevision] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [replacement, setReplacement] = useState(null);
  
  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState('lab_result');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const scope = useRef(0);
  const dialog = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    scope.current++;
    if (appointment) {
      setConsultationNotes(appointment.consultationNotes || '');
      setDocuments(appointment.documents ? [...appointment.documents] : []);
      setNotesRevision(appointment.notesRevision || 0);
      setReplacement(null);
      setError('');
      setSaveSuccess(false);
      setLoading(false);
      setUploading(false);
      setSelectedFile(null);
      setDocTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    return () => { scope.current++; };
  }, [appointment, isOpen]);

  useEffect(() => {
    if (!isOpen || !appointment) return;
    const node = dialog.current;
    node.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { node.close(); document.body.style.overflow = previousOverflow; };
  }, [isOpen, appointment?._id]);

  if (!isOpen || !appointment) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (!docTitle) {
        setDocTitle(file.name);
      }
    }
  };

  const handleUploadFile = async (e) => {
    e.preventDefault();
    const operation = scope.current;
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', docType);
      if (replacement) formData.append('version', replacement.version || 1);
      if (docTitle.trim()) {
        formData.append('title', docTitle.trim());
      }

      const res = replacement
        ? await api.replaceAppointmentDocument(appointment._id, replacement._id, formData)
        : await api.uploadAppointmentFile(appointment._id, formData);
      if (scope.current !== operation) return;
      if (res.success && res.data) {
        setDocuments(prev => replacement ? prev.map(doc => doc._id === replacement._id ? res.data : doc) : [...prev, res.data]);
        setReplacement(null);
        setHistoryRefresh(value => value + 1);
        onSuccess && onSuccess();
        setSelectedFile(null);
        setDocTitle('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } catch (err) {
      if (scope.current !== operation) return;
      console.error('File upload failed:', err);
      setError(err.message || 'Failed to upload document file');
      if (err.status === 409) onSuccess && onSuccess();
    } finally {
      if (scope.current === operation) setUploading(false);
    }
  };

  const handleRemoveDocument = async (doc, index) => {
    const operation = scope.current;
    if (!await showDialog({ kind: 'confirm', title: 'Archive document', message: `Archive "${doc.filename}"? It will leave the current record, and all versions will remain available in version history.`, confirmText: 'Archive document' })) return;
    if (scope.current !== operation) return;

    if (doc._id) {
      try {
        await api.deleteAppointmentDocument(appointment._id, doc._id, doc.version || 1);
        if (scope.current !== operation) return;
        setDocuments(prev => prev.filter((_, i) => i !== index));
        if (replacement?._id === doc._id) setReplacement(null);
        setHistoryRefresh(value => value + 1);
        onSuccess && onSuccess();
      } catch (err) {
        if (scope.current === operation) setError(err.message || 'Failed to archive document');
        if (err.status === 409) onSuccess && onSuccess();
      }
    } else {
      setDocuments(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleSaveNotes = async () => {
    const operation = scope.current;
    setLoading(true);
    setError('');
    setSaveSuccess(false);
    try {
      const res = await api.uploadDocuments(appointment._id, {
        consultationNotes,
        notesRevision,
      });
      if (scope.current !== operation) return;
      setNotesRevision(res.data.notesRevision || 0);
      setHistoryRefresh(value => value + 1);
      setSaveSuccess(true);
      setTimeout(() => { if (scope.current === operation) setSaveSuccess(false); }, 3000);
      onSuccess && onSuccess();
    } catch (err) {
      if (scope.current === operation) setError(err.message || 'Failed to save consultation notes');
      if (err.status === 409) onSuccess && onSuccess();
    } finally {
      if (scope.current === operation) setLoading(false);
    }
  };

  const handleCompleteConsultation = async () => {
    const operation = scope.current;
    if (!await showDialog({ kind: 'confirm', title: 'Complete consultation', message: 'Save the notes and documents, then mark this consultation as completed?', confirmText: 'Complete consultation' })) {
      return;
    }
    if (scope.current !== operation) return;

    setLoading(true);
    setError('');
    try {
      // First persist any notes & documents
      const saved = await api.uploadDocuments(appointment._id, {
        consultationNotes,
        notesRevision,
      });
      if (scope.current === operation) {
        setNotesRevision(saved.data.notesRevision || 0);
        setHistoryRefresh(value => value + 1);
      }
      // Then mark complete
      await api.completeAppointment(appointment._id);
      if (scope.current !== operation) return;
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      if (scope.current === operation) setError(err.message || 'Failed to complete consultation');
      if (err.status === 409) onSuccess && onSuccess();
    } finally {
      if (scope.current === operation) setLoading(false);
    }
  };

  const getDocTypeBadge = (type) => {
    const map = {
      lab_result: { label: 'Lab Result', color: 'var(--primary)' },
      radiology: { label: 'Radiology / X-Ray', color: '#8b5cf6' },
      prescription: { label: 'Prescription', color: '#10b981' },
      referral: { label: 'Referral Letter', color: '#f59e0b' },
      general: { label: 'General Document', color: '#6b7280' },
    };
    return map[type] || { label: type ? type.replace(/_/g, ' ') : 'Document', color: '#6b7280' };
  };

  return (
      <dialog ref={dialog} className="modal-content care-dialog" style={{ maxWidth: '680px', width: '90%' }}
        aria-labelledby="consultation-record-title" onCancel={event => { event.preventDefault(); onClose(); }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="var(--primary)" />
            <h3 id="consultation-record-title" style={{ margin: 0 }}>Consultation Notes & Medical Records</h3>
          </div>
          <button onClick={onClose} aria-label="Close consultation record" className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
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
            <div className="alert" style={{ background: 'var(--emerald-light, rgba(16, 185, 129, 0.1))', color: 'var(--emerald, #10b981)', border: '1px solid #a7f3d0', marginBottom: '1rem' }}>
              <CheckCircle2 size={16} />
              <span>Consultation notes saved successfully!</span>
            </div>
          )}

          {/* Patient Details Snapshot */}
          <div style={{ background: 'var(--bg-muted, rgba(0,0,0,0.03))', padding: '1rem', borderRadius: 'var(--radius-md, 8px)', marginBottom: '1.25rem', border: '1px solid var(--border-color, #e5e7eb)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <User size={16} color="var(--text-muted)" />
                <strong>
                  {appointment.patient ? `${appointment.patient.firstName} ${appointment.patient.lastName}` : (appointment.walkIn ? `${appointment.walkIn.name} (Walk-In)` : 'Patient')}
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
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="consultation-notes" className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.35rem' }}>
              Clinical Notes & Diagnosis
            </label>
            <textarea
              id="consultation-notes"
              disabled={loading}
              rows={5}
              className="form-textarea"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color, #e5e7eb)' }}
              placeholder="Enter patient diagnosis, clinical observations, prescribed medications, and follow-up instructions..."
              value={consultationNotes}
              onChange={(e) => setConsultationNotes(e.target.value)}
            />
          </div>

          {/* Medical Documents & Attachments */}
          <div style={{ marginTop: '1.5rem' }}>
            <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>
              Attached Documents & Lab Reports ({documents.length})
            </label>

            {documents.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                {documents.map((doc, idx) => {
                  const typeBadge = getDocTypeBadge(doc.type);
                  return (
                    <div
                      key={doc._id || idx}
                      className="consultation-document-row"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.65rem 0.85rem',
                        borderRadius: 'var(--radius-md, 6px)',
                        background: 'var(--bg-surface, #fff)',
                        border: '1px solid var(--border-color, #e5e7eb)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ padding: '0.4rem', borderRadius: '4px', background: `${typeBadge.color}15` }}>
                          <FileText size={18} color={typeBadge.color} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{doc.filename}</div>
                          <span className="record-version-meta">Version {doc.version || 1}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                            <span 
                              style={{ 
                                fontSize: '0.7rem', 
                                padding: '0.1rem 0.4rem', 
                                borderRadius: '4px', 
                                background: `${typeBadge.color}20`, 
                                color: typeBadge.color,
                                fontWeight: 500 
                              }}
                            >
                              {typeBadge.label}
                            </span>
                            {doc.uploadedAt && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {new Date(doc.uploadedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="consultation-document-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={uploading || loading}
                          onClick={() => { setReplacement(doc); setDocTitle(doc.filename); setDocType(doc.type || 'general'); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                          Replace
                        </button>
                        {doc._id && doc.url && doc.url !== '#' && (
                          <button
                            type="button"
                            onClick={async () => {
                              try { await api.downloadAppointmentDocument(appointment._id, doc); }
                              catch (err) { setError(err.message || 'Failed to download document'); }
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          >
                            <ExternalLink size={13} />
                            <span>Download</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveDocument(doc, idx)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '0.3rem 0.5rem' }}
                          title="Archive document"
                          aria-label={`Archive ${doc.filename}`}
                          disabled={uploading || loading}
                        >
                          <Archive size={14} /><span>Archive</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upload New Document Form */}
            <div style={{ background: 'var(--bg-muted, rgba(0,0,0,0.03))', padding: '1rem', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-color, #e5e7eb)' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Paperclip size={15} />
                <span>{replacement ? `Replace ${replacement.filename}` : 'Upload & Categorize Medical File'}</span>
              </div>
              {replacement && <div className="record-replacement-notice"><p>Uploading creates version {(replacement.version || 1) + 1}. Previous files remain in version history.</p>
                <button type="button" className="btn btn-secondary btn-sm" disabled={uploading} onClick={() => { setReplacement(null); setSelectedFile(null); setDocTitle(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Cancel replacement</button>
              </div>}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Document File</label>
                  <input
                    ref={fileInputRef}
                    disabled={uploading}
                    type="file"
                    className="form-input"
                    style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem' }}
                    onChange={handleFileChange}
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.csv"
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Category</label>
                  <select
                    className="form-select"
                    style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
                    value={docType}
                    disabled={uploading}
                    onChange={(e) => setDocType(e.target.value)}
                  >
                    <option value="lab_result">Lab Result</option>
                    <option value="radiology">Radiology / X-Ray</option>
                    <option value="prescription">Prescription</option>
                    <option value="referral">Referral Letter</option>
                    <option value="general">General Medical History</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Display Title (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
                    placeholder="e.g. Blood Test CBC.pdf"
                    value={docTitle}
                    disabled={uploading}
                    onChange={(e) => setDocTitle(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleUploadFile}
                  disabled={!selectedFile || uploading}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Upload size={14} />
                  <span>{uploading ? 'Uploading…' : replacement ? 'Upload replacement' : 'Upload & Attach'}</span>
                </button>
              </div>
            </div>
          </div>
          <VersionHistory key={appointment._id} appointmentId={appointment._id} refreshKey={historyRefresh} />
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Close
          </button>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleSaveNotes}
              disabled={loading}
              className="btn btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Save size={16} />
              <span>{loading ? 'Saving...' : 'Save Notes'}</span>
            </button>
            {appointment.status === 'In Progress' && <button
              type="button"
              onClick={handleCompleteConsultation}
              disabled={loading}
              className="btn btn-teal"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <CheckCircle2 size={16} />
              <span>{loading ? 'Finalizing...' : 'Complete Consultation'}</span>
            </button>}
          </div>
        </div>
      </dialog>
  );
}
