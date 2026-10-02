import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export default function AppointmentComments({ appointmentId }) {
  const mounted = useRef(false);
  const version = useRef(0);
  const posting = useRef(false);
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const requestVersion = ++version.current;
    setLoading(true);
    setError('');
    try {
      const result = await api.getAppointmentComments(appointmentId);
      if (mounted.current && version.current === requestVersion) {
        setComments(result.data);
        setLoaded(true);
      }
    } catch (err) {
      if (mounted.current && version.current === requestVersion) {
        setError(err.message || 'Could not load comments. Refresh to try again.');
        setLoaded(false);
        if ([401, 403, 404].includes(err.status)) setComments([]);
      }
    } finally {
      if (mounted.current && version.current === requestVersion) setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; version.current++; };
  }, [load]);

  async function submit(event) {
    event.preventDefault();
    if (posting.current || !message.trim() || !loaded || loading) return;
    posting.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await api.addAppointmentComment(appointmentId, message.trim());
      if (mounted.current) {
        setComments(previous => [...previous, result.data]);
        setMessage('');
        setNotice('Comment posted.');
      }
    } catch (err) {
      if (mounted.current) {
        setError(err.message || 'Could not post your comment. Your draft has been kept.');
        if ([401, 403, 404].includes(err.status)) { setComments([]); setLoaded(false); }
      }
    } finally {
      posting.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return <section className="appointment-comments" aria-labelledby="appointment-comments-title">
    <div className="appointment-comments-heading">
      <h4 id="appointment-comments-title"><MessageSquare size={18} />Comments</h4>
      <button type="button" className="btn btn-secondary btn-sm" disabled={loading || saving} onClick={load}>
        <RefreshCw size={14} />Refresh
      </button>
    </div>
    <p className="appointment-comments-hint">Private discussion with your care team about this appointment.</p>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {loading && <p role="status" className="appointment-comments-hint">Loading comments…</p>}
    {!loading && loaded && !comments.length && <p className="appointment-comments-empty">No comments yet. Add a review remark or ask your care team a question.</p>}
    {!!comments.length && <ol className="appointment-comments-list" aria-label="Appointment comments" aria-busy={loading}>
      {comments.map(comment => <li key={comment._id}>
        <div className="appointment-comment-meta">
          <div><strong>{comment.authorName}</strong><span className="appointment-comment-role">{comment.authorRole}</span></div>
          <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
        </div>
        <p className="appointment-comment-message">{comment.message}</p>
      </li>)}
    </ol>}
    <form onSubmit={submit}>
      <label className="form-label" htmlFor="appointment-comment-message">Add a comment or reply</label>
      <textarea id="appointment-comment-message" className="form-textarea" rows={3} maxLength={2000} required
        disabled={saving || loading || !loaded} value={message} onChange={event => { setMessage(event.target.value); setNotice(''); }}
        aria-describedby="appointment-comment-limit" placeholder="Write your message about this appointment…" />
      <div className="appointment-comment-actions">
        <span id="appointment-comment-limit" className="appointment-comments-hint">{message.length}/2000 characters</span>
        <button type="submit" className="btn btn-primary" disabled={saving || loading || !loaded || !message.trim()}>{saving ? 'Posting…' : 'Post comment'}</button>
      </div>
      <p role="status" className="appointment-comments-hint">{notice}</p>
    </form>
  </section>;
}
