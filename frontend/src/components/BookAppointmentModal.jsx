import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { X, Calendar, Clock, User, AlertCircle, CheckCircle2 } from 'lucide-react';

const TIME_SLOTS = [
  '08:00 - 08:30 AM',
  '08:30 - 09:00 AM',
  '09:00 - 09:30 AM',
  '09:30 - 10:00 AM',
  '10:00 - 10:30 AM',
  '10:30 - 11:00 AM',
  '01:00 - 01:30 PM',
  '01:30 - 02:00 PM',
  '02:00 - 02:30 PM',
  '02:30 - 03:00 PM',
  '03:00 - 03:30 PM',
  '03:30 - 04:00 PM',
];

export default function BookAppointmentModal({ isOpen, onClose, onSuccess }) {
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[2]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setError('');
      api.getDoctors()
        .then((res) => {
          if (res.success && res.data) {
            setDoctors(res.data);
            if (res.data.length > 0) {
              setDoctorId(res.data[0]._id);
            }
          }
        })
        .catch((err) => console.error('Error fetching doctors:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) {
      setError('Please select an appointment date');
      return;
    }
    if (!reason.trim()) {
      setError('Please provide a reason for consultation');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.createAppointment({
        doctorId: doctorId || null,
        date,
        timeSlot,
        reason,
      });

      if (res.success) {
        onSuccess && onSuccess(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  // Get tomorrow's date as min date
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} color="var(--primary)" />
            <h3>Book New Appointment</h3>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Select Specialist / Doctor</label>
              <select
                className="form-select"
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              >
                <option value="">-- Any Available Doctor (Assigned by Staff) --</option>
                {doctors.map((doc) => (
                  <option key={doc._id} value={doc._id}>
                    Dr. {doc.firstName} {doc.lastName} ({doc.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Preferred Date</label>
                <input
                  type="date"
                  min={today}
                  className="form-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Time Slot</label>
                <select
                  className="form-select"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Symptoms / Reason for Visit</label>
              <textarea
                rows={3}
                className="form-textarea"
                placeholder="Describe your symptoms, concerns, or reason for visit..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn btn-primary">
              <CheckCircle2 size={16} />
              <span>{loading ? 'Submitting...' : 'Confirm Appointment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
