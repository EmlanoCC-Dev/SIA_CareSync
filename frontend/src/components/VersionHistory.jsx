import React, { useCallback, useEffect, useRef, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

export default function VersionHistory({ appointmentId, refreshKey = 0 }) {
  const version = useRef(0);
  const mounted = useRef(false);
  const [history, setHistory] = useState({ notes: [], documents: [] });
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const requestVersion = ++version.current;
    setLoading(true);
    setError('');
    try {
      const result = await api.getAppointmentVersions(appointmentId);
      if (mounted.current && version.current === requestVersion) setHistory(result.data);
    } catch (err) {
      if (mounted.current && version.current === requestVersion) {
        setError(err.message || 'Could not load version history. Refresh to try again.');
        if ([401, 403, 404].includes(err.status)) setHistory({ notes: [], documents: [] });
      }
    } finally {
      if (mounted.current && version.current === requestVersion) setLoading(false);
    }
  }, [appointmentId]);
  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; version.current++; };
  }, [load, refreshKey]);
  async function download(document, entry) {
    setDownloading(true);
    setError('');
    try { await api.downloadAppointmentDocument(appointmentId, { _id: document._id, filename: entry.filename }, entry.version); }
    catch (err) { if (mounted.current) setError(err.message || 'Could not download this version'); }
    finally { if (mounted.current) setDownloading(false); }
  }
  const date = value => value ? new Date(value).toLocaleString() : 'Time unavailable';
  return <section className="record-versions" aria-labelledby="record-versions-title">
    <div className="record-versions-heading">
      <h4 id="record-versions-title"><History size={18} />Version history</h4>
      <button type="button" className="btn btn-secondary btn-sm" disabled={loading || downloading} onClick={load}><RefreshCw size={14} />Refresh history</button>
    </div>
    <p className="record-version-meta">Previous content is read-only. The latest version is the current record.</p>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {loading && <p className="record-version-meta" role="status">Loading version history…</p>}
    {!loading && !error && !history.notes.length && !history.documents.length && <p className="record-version-meta">No notes or documents have been recorded yet.</p>}
    {!!history.notes.length && <details className="record-version-group">
      <summary>Consultation notes · {history.notes.length} {history.notes.length === 1 ? 'version' : 'versions'}</summary>
      {[...history.notes].reverse().map((entry, index) => <article key={entry.version} className="record-version-entry">
        <strong>Version {entry.version} · {index === 0 ? 'Current' : 'Previous'}</strong>
        <p className="record-version-meta">{entry.authorName || 'Author unavailable'}{entry.authorRole ? ` · ${entry.authorRole}` : ''} · {date(entry.savedAt)}</p>
        <p className="record-version-content">{entry.notes || 'Notes cleared in this version.'}</p>
      </article>)}
    </details>}
    {history.documents.map(document => <details key={document._id} className="record-version-group">
      <summary>{document.filename} · {document.archived ? 'Archived' : 'Current attachment'} · {document.versions.length} {document.versions.length === 1 ? 'version' : 'versions'}</summary>
      {document.archived && <p className="record-version-meta">Archived by {document.archivedByName || 'Unknown user'} · {date(document.archivedAt)}</p>}
      {[...document.versions].reverse().map((entry, index) => <article key={entry.version} className="record-version-entry">
        <div className="record-version-heading"><strong>Version {entry.version} · {document.archived ? 'Archived' : index === 0 ? 'Current' : 'Previous'}</strong>
          <button type="button" className="btn btn-secondary btn-sm" disabled={downloading} onClick={() => download(document, entry)}>Download version {entry.version}</button>
        </div>
        <p>{entry.filename}</p>
        <p className="record-version-meta">{entry.uploaderName || 'Author unavailable'}{entry.uploaderRole ? ` · ${entry.uploaderRole}` : ''} · {date(entry.uploadedAt)}</p>
      </article>)}
    </details>)}
  </section>;
}
