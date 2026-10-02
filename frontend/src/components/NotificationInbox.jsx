import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { api } from '../services/api';

export default function NotificationInbox() {
  const dialog = useRef(null);
  const mounted = useRef(false);
  const version = useRef(0);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, unreadCount: 0, pageSize: 20 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (requestedPage = page) => {
    const requestVersion = ++version.current;
    setLoading(true);
    try {
      const result = await api.getNotifications({ page: requestedPage, unread });
      if (mounted.current && version.current === requestVersion) {
        setData(result.data);
        setError('');
      }
    } catch (err) {
      if (mounted.current && version.current === requestVersion) {
        setError(err.message || 'Could not load notifications');
        if (err.status === 401) setData({ items: [], total: 0, unreadCount: 0, pageSize: 20 });
      }
    } finally {
      if (mounted.current && version.current === requestVersion) setLoading(false);
    }
  }, [page, unread]);

  useEffect(() => {
    mounted.current = true;
    load();
    // ponytail: poll every 15 seconds; use server push if clinic scale requires it.
    const timer = setInterval(() => { if (!document.hidden) load(); }, 15000);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      mounted.current = false;
      version.current++;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const node = dialog.current;
    node.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    load();
    return () => {
      node.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function markRead(id) {
    setBusy(true);
    setError('');
    version.current++;
    try {
      if (id) await api.readNotification(id);
      else await api.readAllNotifications();
      if (mounted.current) {
        setPage(1);
        await load(1);
      }
    } catch (err) {
      if (mounted.current) setError(err.message || 'Could not mark notifications as read');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  function close() {
    dialog.current?.close();
    setOpen(false);
  }

  return <>
    <button type="button" className="btn btn-secondary btn-sm notification-trigger"
      aria-label={`Notifications, ${data.unreadCount} unread${error ? ', unable to refresh' : ''}`} aria-haspopup="dialog"
      onClick={() => setOpen(true)}>
      <Bell size={16} /><span>Notifications</span>
      {data.unreadCount > 0 && <span className="notification-count">{data.unreadCount > 99 ? '99+' : data.unreadCount}</span>}
      {error && <span className="notification-unavailable">!</span>}
    </button>
    {open && <dialog ref={dialog} className="modal-content assignment-dialog notification-dialog" aria-labelledby="notification-title"
      onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === dialog.current) {
        const bounds = dialog.current.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      } }}>
      <div className="modal-header">
        <div><p className="page-eyebrow">Your care updates</p><h3 id="notification-title">Notifications</h3></div>
        <button type="button" className="btn btn-secondary btn-sm" aria-label="Close notifications" onClick={close}><X size={18} /></button>
      </div>
      <div className="modal-body">
        <fieldset className="notification-controls" disabled={busy}>
          <div className="notification-toolbar">
            <div className="notification-filters" aria-label="Notification filters">
              <button type="button" className={`btn btn-sm ${!unread ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={!unread} onClick={() => { setUnread(false); setPage(1); }}>All</button>
              <button type="button" className={`btn btn-sm ${unread ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={unread} onClick={() => { setUnread(true); setPage(1); }}>Unread ({data.unreadCount})</button>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" disabled={!data.unreadCount || loading} onClick={() => markRead()}><Check size={14} />Mark all as read</button>
          </div>
          {error && <div className="alert alert-error" role="alert">{error}<button type="button" className="btn btn-secondary btn-sm" onClick={() => load()}>Retry</button></div>}
          {loading && !data.items.length ? <p className="notification-empty" role="status">Loading your updates…</p> :
            !data.items.length ? <div className="notification-empty"><Bell size={24} /><h4>{unread ? 'You’re all caught up' : 'No updates yet'}</h4><p>{unread ? 'There are no unread notifications on this page.' : 'Appointment requests, assignments, and status updates will appear here.'}</p></div> :
            <ul className="notification-list" aria-label="Care updates" aria-busy={loading}>
              {data.items.map(item => <li key={item._id} className={item.readAt ? '' : 'is-unread'}>
                <div className="notification-item-heading"><h4>{item.title}</h4>{!item.readAt && <span className="notification-new">Unread</span>}</div>
                <p>{item.message}</p>
                <div className="notification-item-footer">
                  <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
                  {!item.readAt && <button type="button" className="btn btn-secondary btn-sm" onClick={() => markRead(item._id)}>Mark as read</button>}
                </div>
              </li>)}
            </ul>}
          {(page > 1 || data.total > data.pageSize) && <div className="notification-pagination">
            <button type="button" className="btn btn-secondary btn-sm" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page}</span>
            <button type="button" className="btn btn-secondary btn-sm" disabled={page * data.pageSize >= data.total || loading || page >= 9999} onClick={() => setPage(page + 1)}>Next</button>
          </div>}
        </fieldset>
      </div>
    </dialog>}
  </>;
}
