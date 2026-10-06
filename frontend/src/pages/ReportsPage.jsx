import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

import { dateKey } from '../utils/dates';

export default function ReportsPage() {
  const { user } = useAuth();
  const today = dateKey(new Date());
  const [filters, setFilters] = useState({ from: `${today.slice(0, 7)}-01`, to: today, doctorId: '' });
  const [doctors, setDoctors] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async (period = filters) => {
    setLoading(true);
    setError('');
    setReport(null);
    try { setReport((await api.getReports(period)).data); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      setLoading(true);
      try {
        const { data } = await api.getSystemTime();
        const day = dateKey(new Date(data.currentTime));
        const period = { from: `${day.slice(0, 7)}-01`, to: day, doctorId: '' };
        if (!active) return;
        setFilters(period);
        await load(period);
      } catch (err) { if (active) { setError(err.message); setLoading(false); } }
    };
    initialize();
    if (user.role !== 'Doctor') api.getDoctors().then(({ data }) => { if (active) setDoctors(data); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [user.role]);

  const change = event => setFilters(current => ({ ...current, [event.target.name]: event.target.value }));
  return <section className="reports-page" aria-labelledby="reports-title">
    <div className="card">
      <div className="card-header"><div><p className="page-eyebrow">Clinic activity / Reporting period</p><h2 id="reports-title">Appointment reports</h2><p className="workspace-note">Count appointments by scheduled date, including both selected dates. Statuses reflect their current state.</p></div></div>
      <form className="report-filters" onSubmit={event => { event.preventDefault(); load(); }}>
        <label className="form-label">From<input className="form-input" name="from" type="date" required value={filters.from} max={filters.to} onChange={change} /></label>
        <label className="form-label">To<input className="form-input" name="to" type="date" required value={filters.to} min={filters.from} onChange={change} /></label>
        {user.role !== 'Doctor' && <label className="form-label">Doctor<select className="form-select" name="doctorId" value={filters.doctorId} onChange={change}><option value="">All doctors & unassigned</option>{doctors.map(doctor => <option key={doctor._id} value={doctor._id}>Dr. {doctor.firstName} {doctor.lastName}</option>)}</select></label>}
        <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Loading…' : 'Apply period'}</button>
      </form>
    </div>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {loading && <p role="status">Loading appointment report…</p>}
    {report && <>
      <p className="workspace-note" role="status">{report.scope} · {report.from} to {report.to}</p>
      <div className="stats-grid">
        {[['Appointments', report.total], ['Completed', report.statuses.Completed], ['Pending', report.statuses.Pending], ['No-show', report.statuses['No-show']]].map(([label, count]) => <div className="stat-card" key={label}><div><div className="stat-val">{count}</div><div className="stat-label">{label}</div></div></div>)}
      </div>
      {report.total === 0 ? <div className="card report-empty">No appointments in this period. Choose another date range or doctor.</div> : <>
        <div className="card"><div className="card-header"><h3>Appointment status</h3></div><div className="report-statuses">{Object.entries(report.statuses).map(([status, count]) => <div key={status}><span className={`badge badge-${status.replace(/\s+/g, '-')}`}>{status}</span><strong>{count}</strong></div>)}</div></div>
        <div className="report-tables">
          <div className="card"><div className="card-header"><h3>Visits by day</h3></div><div className="table-container"><table><thead><tr><th>Scheduled date</th><th>Appointments</th><th>Completed</th></tr></thead><tbody>{report.daily.map(day => <tr key={day._id}><td>{day._id}</td><td>{day.total}</td><td>{day.completed}</td></tr>)}</tbody></table></div></div>
          <div className="card"><div className="card-header"><h3>Doctor workload</h3></div><div className="table-container"><table><thead><tr><th>Doctor</th><th>Appointments</th><th>Completed</th></tr></thead><tbody>{report.doctors.map(doctor => <tr key={doctor._id || 'unassigned'}><td>{doctor._id ? `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}` : 'Unassigned'}</td><td>{doctor.total}</td><td>{doctor.completed}</td></tr>)}</tbody></table></div></div>
        </div>
      </>}
    </>}
  </section>;
}
