import { useCallback, useEffect, useRef, useState } from 'react';
import { Database, RefreshCw, ExternalLink, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

const running = new Set(['queued', 'capturing', 'uploading']);
const labels = { queued: 'Queued', capturing: 'Capturing database', uploading: 'Uploading to Drive', completed: 'Completed', failed: 'Failed' };
const formatTime = value => new Date(value).toLocaleString([], { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function DatabaseBackups() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const mounted = useRef(false);
  const version = useRef(0);
  const load = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    try {
      const result = await api.getDatabaseBackups();
      if (mounted.current && current === version.current) { setData(result.data); setError(''); }
    } catch (err) {
      if (mounted.current && current === version.current) setError(err.message || 'Backup history could not be loaded.');
    } finally { if (mounted.current && current === version.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true;
    load();
    return () => { mounted.current = false; version.current++; };
  }, [load]);
  const inProgress = data?.runs.some(run => running.has(run.status));
  useEffect(() => {
    if (!inProgress) return;
    const timer = setInterval(() => { if (!document.hidden) load(); }, 5000);
    return () => clearInterval(timer);
  }, [inProgress, load]);

  async function backUpNow() {
    setRequesting(true);
    setNotice('');
    setError('');
    try {
      await api.startDatabaseBackup();
      if (mounted.current) { setNotice('Backup requested. Progress will update here.'); await load(); }
    } catch (err) { if (mounted.current) setError(err.message || 'The backup could not be requested.'); }
    finally { if (mounted.current) setRequesting(false); }
  }
  const busy = requesting || inProgress;
  return <section className="card database-backups" aria-labelledby="database-backups-title">
    <div className="card-header">
      <div><p className="page-eyebrow">Clinic data / Recovery</p><h3 id="database-backups-title">Database backups</h3></div>
      <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={load}><RefreshCw size={16} />Refresh</button>
    </div>
    <div className="backup-content">
      <p className="workspace-note">Keep an encrypted copy of clinic records and uploaded medical files in your clinic’s private Google Drive folder. Clinic requests pause briefly while the database is captured.</p>
      {error && <div className="alert alert-error" role="alert">{error}<button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>Retry</button></div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      {!data ? <p role="status">{loading ? 'Loading backup status…' : 'Backup status is unavailable. Retry to load it.'}</p> : <>
        <div className="backup-summary">
          <div><ShieldCheck size={20} /><div><strong>{data.configured ? 'Ready to back up' : 'Setup required'}</strong><p>{data.account || 'Clinic Google account not configured'}</p></div></div>
          <div><Database size={20} /><div><strong>Daily at 6 PM Manila time</strong><p>One hour after the clinic closes. {data.schedulerConfigured ? 'Enable the daily job to activate this schedule.' : 'Scheduled job setup is pending.'}</p></div></div>
        </div>
        {!data.configured && <div className="alert alert-warning"><strong>Finish backup setup</strong><ul>{data.missing.map(message => <li key={message}>{message}</li>)}</ul></div>}
        <div className="backup-action"><button type="button" className="btn btn-primary" onClick={backUpNow} disabled={!data.configured || busy || !!error}>
          <Database size={18} />{busy ? 'Backup in progress…' : 'Back up now'}
        </button><span>Includes records, document history, and file contents. Encrypted before upload.</span></div>
        <h4>Recent backups</h4>
        {!data.runs.length ? <p className="workspace-note">No backups have been recorded yet.</p> : <ul className="backup-run-list" aria-label="Recent database backups">
          {data.runs.map(run => <li key={run._id}>
            <div className="backup-run-heading"><div><strong>{run.trigger === 'scheduled' ? 'Scheduled backup' : 'Manual backup'}</strong><time dateTime={run.createdAt}>{formatTime(run.createdAt)}</time></div>
              <span className={`badge badge-${run.status === 'completed' ? 'Completed' : run.status === 'failed' ? 'Cancelled' : 'Pending'}`} role={running.has(run.status) ? 'status' : undefined}>{labels[run.status]}</span></div>
            {run.message && <p>{run.message}</p>}
            {run.status === 'completed' && run.driveFileId && <>
              <a className="btn btn-secondary btn-sm" href={`https://drive.google.com/file/d/${encodeURIComponent(run.driveFileId)}/view`} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />Open in Drive</a>
              <details><summary>Verification details</summary><p>{run.filename} · {(run.size / 1024 / 1024).toFixed(2)} MB</p><p>SHA-256: <code>{run.sha256}</code></p></details>
            </>}
          </li>)}
        </ul>}
      </>}
    </div>
  </section>;
}
