import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function BookingCorrections({ appointment, onUpdated }) {
  const { user } = useAuth();
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const history = appointment.bookingHistory || [];
  const request = ['Staff', 'Admin'].includes(user?.role) && appointment.status === 'Pending' && !appointment.walkIn && appointment.patient;
  const resubmit = user?.role === 'Patient' && appointment.status === 'Needs correction';
  const explanation = [...history].reverse().find(entry => entry.action === 'Correction requested')?.explanation;
  useEffect(() => {
    setDraft(resubmit ? appointment.reason : '');
    setError('');
  }, [appointment._id, appointment.bookingRevision, resubmit]);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = resubmit
        ? await api.resubmitAppointment(appointment._id, draft.trim(), appointment.bookingRevision || 0)
        : await api.requestAppointmentCorrection(appointment._id, draft.trim(), appointment.bookingRevision || 0);
      if (!mounted.current) return;
      onUpdated(result.data);
      setNotice(resubmit ? 'Changes resubmitted for clinic review.' : 'Correction requested. The patient can now read the explanation and resubmit.');
    } catch (err) {
      if (mounted.current) setError(err.message || 'Could not save changes. Your draft is retained.');
    } finally { if (mounted.current) setBusy(false); }
  }
  async function refresh() {
    setBusy(true); setError(''); setNotice('');
    try { const result = await api.getAppointmentById(appointment._id); if (mounted.current) onUpdated(result.data); }
    catch (err) { if (mounted.current) setError(err.message || 'Could not refresh this booking'); }
    finally { if (mounted.current) setBusy(false); }
  }
  return <section className="booking-corrections" aria-labelledby="booking-corrections-title">
    <div className="record-versions-heading">
      <h4 id="booking-corrections-title">Booking corrections</h4>
      <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={refresh}>Refresh booking</button>
    </div>
    {appointment.status === 'Needs correction' && <div className="record-version-entry">
      <strong>Clinic requested changes</strong>
      <p className="record-version-content">{explanation || 'Contact the clinic for clarification.'}</p>
      <p className="record-version-meta">The appointment is awaiting the patient’s corrected reason for visit.</p>
    </div>}
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {(request || resubmit) && <form onSubmit={submit}>
      <p className="record-version-meta">{resubmit ? 'Update your reason for visit and send it back for review. Your doctor, date and slot stay the same.' : 'Explain what the patient needs to change in their reason for visit. Approval pauses until they resubmit.'}</p>
      <label className="form-label" htmlFor="booking-correction-text">{resubmit ? 'Reason for visit' : 'Correction explanation'} (required)</label>
      <textarea id="booking-correction-text" className="form-textarea" rows={4} maxLength={2000} required disabled={busy} value={draft} onChange={event => setDraft(event.target.value)} />
      <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim() || (resubmit && draft.trim() === appointment.reason)}>
        {busy ? 'Saving…' : resubmit ? 'Resubmit for review' : 'Request correction'}
      </button>
    </form>}
    {!!history.length && <details className="booking-history record-version-group">
      <summary>Correction history · {history.length} {history.length === 1 ? 'event' : 'events'}</summary>
      {[...history].reverse().map(entry => <article className="record-version-entry" key={entry.revision}>
        <strong>Revision {entry.revision} · {entry.action}</strong>
        <p className="record-version-meta">{entry.actorName} · {entry.actorRole} · {new Date(entry.changedAt).toLocaleString()}</p>
        {entry.explanation && <><strong>Clinic explanation</strong><p className="record-version-content">{entry.explanation}</p></>}
        <strong>{entry.action === 'Resubmitted' ? 'Previous reason' : 'Reason at review'}</strong>
        <p className="record-version-content">{entry.previousReason}</p>
        {entry.action === 'Resubmitted' && <><strong>Resubmitted reason</strong><p className="record-version-content">{entry.reason}</p></>}
      </article>)}
    </details>}
    {!history.length && <p className="record-version-meta">No correction requests or resubmissions yet.</p>}
  </section>;
}
