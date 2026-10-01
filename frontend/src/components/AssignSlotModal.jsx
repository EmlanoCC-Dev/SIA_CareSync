import React, { useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { X } from 'lucide-react';

export default function AssignSlotModal({ isOpen, onClose, walkIn, appointment, onAssigned }) {
  const dialog = useRef(null);
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState('');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    dialog.current?.showModal();
    let active = true;
    setError('');
    setDoctorId('');
    setDate('');
    setSlots([]);
    setSlotId('');
    setLoading(true);
    Promise.all([api.getDoctors(), api.getSystemTime()]).then(([doctorRes, timeRes]) => {
      if (!active) return;
      const now = new Date(timeRes.data.currentTime);
      const today = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      setDoctors(doctorRes.data);
      setDate(appointment ? appointment.date.slice(0, 10) : today);
      setDoctorId(appointment?.doctor?._id || doctorRes.data[0]?._id || '');
    }).catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, appointment?._id, walkIn?._id]);

  useEffect(() => {
    if (!isOpen || !doctorId || !date) return;
    let active = true;
    setLoading(true);
    setError('');
    setSlots([]);
    setSlotId('');
    api.getSlots({ doctorId, date, status: 'Available' }).then(({ data }) => {
      if (!active) return;
      setSlots(data);
      setSlotId(data[0]?._id || '');
    }).catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, doctorId, date]);

  const assign = async event => {
    event.preventDefault();
    if (!slotId || loading || assigning) return;
    setAssigning(true);
    setError('');
    try {
      if (appointment) await api.assignAppointmentSlot(appointment._id, slotId);
      else await api.assignSlotToWalkIn(walkIn._id, slotId);
      onAssigned?.();
      onClose();
    } catch (err) { setError(err.message); }
    finally { setAssigning(false); }
  };

  if (!isOpen || (!appointment && !walkIn)) return null;
  return <dialog ref={dialog} className="modal-content assignment-dialog" aria-labelledby="assignment-title" onCancel={event => { if (assigning) event.preventDefault(); else onClose(); }}>
    <div className="modal-header"><h3 id="assignment-title">{appointment ? 'Assign doctor & slot' : 'Assign Slot to Walk-In Patient'}</h3><button className="btn btn-secondary btn-sm" type="button" onClick={onClose} disabled={assigning} aria-label="Close slot assignment"><X size={18} /></button></div>
    <form onSubmit={assign}>
      <div className="modal-body">
        <p><strong>{appointment ? (appointment.patient?.firstName || '') + ' ' + (appointment.patient?.lastName || '') : walkIn.name + ' / Queue #' + walkIn.queueNumber}</strong></p>
        {appointment && <p className="workspace-note">Preferred time: {appointment.timeSlot || 'Flexible'}. Choose an available slot on the requested date, then approve the request.</p>}
        {error && <p className="alert alert-error" role="alert">{error}</p>}
        <label className="form-label">Attending doctor<select className="form-select" value={doctorId} required disabled={assigning} onChange={event => { setSlotId(''); setDoctorId(event.target.value); }}><option value="">Select a doctor</option>{doctors.map(doctor => <option key={doctor._id} value={doctor._id}>Dr. {doctor.firstName} {doctor.lastName}</option>)}</select></label>
        <label className="form-label">Date<input className="form-input" type="date" required value={date} disabled={!!appointment || assigning} onChange={event => { setSlotId(''); setDate(event.target.value); }} /></label>
        <p className="form-label">Available consultation slots</p>
        {loading ? <p role="status">Loading available slots...</p> : slots.length === 0 ? <p role="status">No available slots. Choose another doctor{appointment ? '.' : ' or date.'}</p> : <div className="slot-grid">{slots.map(slot => <button type="button" key={slot._id} className={'slot-chip ' + (slotId === slot._id ? 'selected' : '')} aria-pressed={slotId === slot._id} disabled={assigning} onClick={() => setSlotId(slot._id)}>{slot.startTime} - {slot.endTime}</button>)}</div>}
      </div>
      <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={assigning}>Cancel</button><button className="btn btn-primary" type="submit" disabled={!slotId || loading || assigning}>{assigning ? 'Assigning...' : 'Assign Slot'}</button></div>
    </form>
  </dialog>;
}
