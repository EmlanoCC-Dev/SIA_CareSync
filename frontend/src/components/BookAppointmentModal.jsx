import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { X, Calendar, Clock, User, AlertCircle, CheckCircle2, Sparkles, Ban } from 'lucide-react';

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

function isSlotPassed(dateStr, timeStr, systemTimeData) {
  if (!dateStr || !timeStr) return false;
  const now = systemTimeData?.currentTime ? new Date(systemTimeData.currentTime) : new Date();

  const nowYear = now.getFullYear();
  const nowMonth = String(now.getMonth() + 1).padStart(2, '0');
  const nowDay = String(now.getDate()).padStart(2, '0');
  const nowDateKey = `${nowYear}-${nowMonth}-${nowDay}`;

  const targetDateKey = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;

  if (targetDateKey < nowDateKey) return true;
  if (targetDateKey > nowDateKey) return false;

  // Same day: parse start time
  const parts = timeStr.split('-');
  const startTime = parts[0].trim();
  const match = startTime.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
  if (!match) return false;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridian = match[3] ? match[3].toUpperCase() : null;
  if (meridian === 'PM' && hours < 12) hours += 12;
  if (meridian === 'AM' && hours === 12) hours = 0;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const slotMinutes = hours * 60 + minutes;

  return nowMinutes >= slotMinutes;
}

export default function BookAppointmentModal({ isOpen, onClose, onSuccess }) {
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[2]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [systemTimeStatus, setSystemTimeStatus] = useState(null);

  // Dynamic slot management state
  const [allSlots, setAllSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState(null);

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

      api.getSystemTime()
        .then((res) => {
          if (res.success && res.data) {
            setSystemTimeStatus(res.data);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Fetch doctor's slots dynamically when doctor and date change
  useEffect(() => {
    if (doctorId && date) {
      setLoadingSlots(true);
      Promise.all([
        api.getSlots({ doctor: doctorId, date }),
        api.getSystemTime().catch(() => null),
      ])
        .then(([slotRes, timeRes]) => {
          if (timeRes && timeRes.success) {
            setSystemTimeStatus(timeRes.data);
          }
          if (slotRes.success && slotRes.data && slotRes.data.length > 0) {
            setAllSlots(slotRes.data);

            // Find first available and non-passed slot
            const currentTime = timeRes?.data || systemTimeStatus;
            const firstAvailable = slotRes.data.find((s) => {
              const taken = s.status !== 'Available';
              const passed = isSlotPassed(date, s.startTime, currentTime);
              return !taken && !passed;
            });

            if (firstAvailable) {
              setSelectedSlotId(firstAvailable._id);
              setTimeSlot(`${firstAvailable.startTime} - ${firstAvailable.endTime}`);
            } else {
              setSelectedSlotId(null);
              setTimeSlot('');
            }
          } else {
            setAllSlots([]);
            setSelectedSlotId(null);
          }
        })
        .catch(() => {
          setAllSlots([]);
          setSelectedSlotId(null);
        })
        .finally(() => setLoadingSlots(false));
    } else {
      setAllSlots([]);
      setSelectedSlotId(null);
    }
  }, [doctorId, date]);

  // Compute processed slots with isTaken and isPassed flags
  const processedSlots = useMemo(() => {
    return allSlots.map((slot) => {
      const isTaken = slot.status !== 'Available';
      const isPassed = isSlotPassed(date, slot.startTime, systemTimeStatus);
      const isAvailable = !isTaken && !isPassed;
      return {
        ...slot,
        isTaken,
        isPassed,
        isAvailable,
      };
    });
  }, [allSlots, date, systemTimeStatus]);

  const availableCount = useMemo(() => {
    return processedSlots.filter((s) => s.isAvailable).length;
  }, [processedSlots]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) {
      setError('Please select an appointment date');
      return;
    }
    if (allSlots.length > 0 && !selectedSlotId) {
      setError('Please select an available consultation slot that has not passed or been taken.');
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
        slotId: selectedSlotId || null,
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

  // Get today's date formatted as YYYY-MM-DD
  const today = systemTimeStatus?.currentTime
    ? new Date(systemTimeStatus.currentTime).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0];

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '560px' }}>
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

            {/* Dynamic Slot Selection with Taken & Passed Handling */}
            {date && doctorId && (
              <div className="form-group">
                {loadingSlots ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                    Checking doctor's available slots...
                  </div>
                ) : processedSlots.length > 0 ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Sparkles size={14} color="var(--teal)" />
                        <span>
                          Available Consultation Slots ({availableCount} of {processedSlots.length} available)
                        </span>
                      </label>
                      <span style={{ fontSize: '0.75rem', color: availableCount > 0 ? 'var(--emerald)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {availableCount > 0 ? 'Live Real-time' : 'No Open Slots'}
                      </span>
                    </div>

                    <div className="slot-grid">
                      {processedSlots.map((slot) => {
                        const isSelected = selectedSlotId === slot._id;
                        const isClickable = slot.isAvailable;

                        let chipClass = 'slot-chip';
                        if (isSelected) chipClass += ' selected';
                        if (!isClickable) {
                          chipClass += ' disabled';
                          if (slot.isTaken) chipClass += ' taken';
                          if (slot.isPassed) chipClass += ' passed';
                        }

                        return (
                          <button
                            key={slot._id}
                            type="button"
                            disabled={!isClickable}
                            className={chipClass}
                            title={
                              slot.isTaken
                                ? 'Slot already reserved/booked'
                                : slot.isPassed
                                ? 'This time slot has already passed'
                                : `Book ${slot.startTime} - ${slot.endTime}`
                            }
                            onClick={() => {
                              if (isClickable) {
                                setSelectedSlotId(slot._id);
                                setTimeSlot(`${slot.startTime} - ${slot.endTime}`);
                              }
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Clock size={12} style={{ opacity: isClickable ? 1 : 0.6 }} />
                              <span>{slot.startTime} - {slot.endTime}</span>
                            </div>

                            {/* Status Badges */}
                            {slot.isTaken && (
                              <span className="slot-badge slot-badge-taken">
                                Booked
                              </span>
                            )}
                            {slot.isPassed && !slot.isTaken && (
                              <span className="slot-badge slot-badge-passed">
                                Passed
                              </span>
                            )}
                            {slot.isAvailable && !isSelected && (
                              <span className="slot-badge slot-badge-avail">
                                Available
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {availableCount === 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Ban size={14} />
                        <span>All slots for this date have passed or been booked. Please select another date.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                      <label className="form-label" style={{ margin: 0 }}>Select Preferred Time Window</label>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Flexible Booking</span>
                    </div>
                    <select
                      className="form-select"
                      value={timeSlot}
                      onChange={(e) => {
                        setTimeSlot(e.target.value);
                        setSelectedSlotId(null);
                      }}
                    >
                      {TIME_SLOTS.map((slot) => {
                        const passed = isSlotPassed(date, slot, systemTimeStatus);
                        return (
                          <option key={slot} value={slot} disabled={passed}>
                            {slot} {passed ? '(Passed)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>
            )}

            {(!date || !doctorId) && (
              <div className="form-group">
                <label className="form-label">Time Slot</label>
                <select
                  className="form-select"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                >
                  {TIME_SLOTS.map((slot) => {
                    const passed = isSlotPassed(date, slot, systemTimeStatus);
                    return (
                      <option key={slot} value={slot} disabled={passed}>
                        {slot} {passed ? '(Passed)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

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
            <button
              type="submit"
              disabled={loading || (processedSlots.length > 0 && !selectedSlotId)}
              className="btn btn-primary"
            >
              <CheckCircle2 size={16} />
              <span>{loading ? 'Submitting...' : 'Confirm Appointment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
