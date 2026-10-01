import React, { useEffect, useState } from 'react';
import { api } from '../services/api';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function WorkingHoursEditor({ doctorId, doctors, onSaved }) {
  const [selected, setSelected] = useState(doctorId || '');
  const [hours, setHours] = useState([]);
  const [duration, setDuration] = useState(15);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoaded(false);
    setError('');
    setMessage('');
    if (!selected) return;
    setBusy(true);
    api.getDoctorSchedule(selected).then(({ data }) => {
      if (!active) return;
      setHours(DAYS.map((name, day) => {
        const entry = data.workingHours.find(item => item.day === day);
        return { day, enabled: data.scheduleConfigured ? !!entry : true, start: entry?.start || '09:00', end: entry?.end || '17:00' };
      }));
      setDuration(data.consultationDuration);
      setLoaded(true);
    }).catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [selected]);

  const save = async event => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.updateDoctorSchedule(selected, { consultationDuration: Number(duration),
        workingHours: hours.filter(item => item.enabled).map(({ day, start, end }) => ({ day, start, end })) });
      setMessage('Weekly hours saved. New dates will use this schedule.');
      onSaved?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const change = (day, values) => setHours(current => current.map(item => item.day === day ? { ...item, ...values } : item));
  return <section className="schedule-editor" aria-labelledby="weekly-hours-title">
    <h3 id="weekly-hours-title">Recurring working hours</h3>
    <p className="workspace-note">Set working days and consultation length. Unchecked days are days off. Existing dated slots stay unchanged; block individual open slots when needed.</p>
    {!doctorId && <label className="form-label">Doctor
      <select className="form-select" value={selected} onChange={event => setSelected(event.target.value)} disabled={busy}>
        <option value="">Select a doctor</option>
        {doctors.map(doctor => <option key={doctor._id} value={doctor._id}>Dr. {doctor.firstName} {doctor.lastName}</option>)}
      </select>
    </label>}
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    {message && <p className="alert alert-success" role="status">{message}</p>}
    {busy && !loaded && <p role="status">Loading weekly hours…</p>}
    {loaded && <form onSubmit={save}>
      <fieldset disabled={busy} className="schedule-fields">
        <label className="form-label">Consultation length (minutes)
          <input className="form-input" type="number" min="5" max="120" step="1" required value={duration} onChange={event => setDuration(event.target.value)} />
        </label>
        <div className="weekly-hours">
          {hours.map(item => <div className="working-day" key={item.day}>
            <label><input type="checkbox" checked={item.enabled} onChange={event => change(item.day, { enabled: event.target.checked })} /> {DAYS[item.day]}</label>
            <label className="form-label">Start<input aria-label={`${DAYS[item.day]} start`} className="form-input" type="time" required disabled={!item.enabled} value={item.start} onChange={event => change(item.day, { start: event.target.value })} /></label>
            <label className="form-label">End<input aria-label={`${DAYS[item.day]} end`} className="form-input" type="time" required disabled={!item.enabled} value={item.end} onChange={event => change(item.day, { end: event.target.value })} /></label>
          </div>)}
        </div>
        <button className="btn btn-primary" type="submit">{busy ? 'Saving…' : 'Save weekly hours'}</button>
      </fieldset>
    </form>}
  </section>;
}
