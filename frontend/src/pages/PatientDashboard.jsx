import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import BookAppointmentModal from '../components/BookAppointmentModal';
import StatusTimelineModal from '../components/StatusTimelineModal';
import { PlusCircle, Calendar, Clock, User, AlertCircle, History, XCircle, CheckCircle2 } from 'lucide-react';

export default function PatientDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await api.getAppointments();
      if (res.success && res.data) {
        setAppointments(Array.isArray(res.data) ? res.data : []);
      } else {
        setAppointments([]);
      }
    } catch (err) {
      console.error('Failed to load appointments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleCancel = async (id) => {
    const reason = window.prompt('Please enter cancellation reason (optional):');
    if (reason === null) return; // User cancelled prompt

    try {
      await api.cancelAppointment(id, reason || 'Cancelled by patient');
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment');
    }
  };

  const openTimeline = (apt) => {
    setSelectedAppointment(apt);
    setTimelineOpen(true);
  };

  // Stats calculation
  const pendingCount = appointments.filter((a) => a.status === 'Pending').length;
  const confirmedCount = appointments.filter((a) => a.status === 'Confirmed').length;
  const completedCount = appointments.filter((a) => a.status === 'Completed').length;

  return (
    <div className="main-content">
      {/* Welcome Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
            Hello, {user.firstName}! 👋
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Manage your medical appointments, bookings, and consultation history.
          </p>
        </div>
        <button onClick={() => setIsBookingOpen(true)} className="btn btn-primary">
          <PlusCircle size={18} />
          <span>Book New Appointment</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="stat-val">{pendingCount}</div>
            <div className="stat-label">Pending Approval</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Calendar size={24} />
          </div>
          <div>
            <div className="stat-val">{confirmedCount}</div>
            <div className="stat-label">Upcoming / Confirmed</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--emerald-light)', color: 'var(--emerald)' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="stat-val">{completedCount}</div>
            <div className="stat-label">Completed Consultations</div>
          </div>
        </div>
      </div>

      {/* Appointments List */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} color="var(--primary)" />
            <h3>My Appointment Schedule</h3>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {appointments.length} Total Records
          </span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Doctor / Specialist</th>
                <th>Reason for Visit</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    {loading ? (
                      'Loading your appointments...'
                    ) : (
                      <div>
                        <p style={{ marginBottom: '1rem' }}>You have no appointments booked yet.</p>
                        <button onClick={() => setIsBookingOpen(true)} className="btn btn-primary btn-sm">
                          <PlusCircle size={14} /> Book Appointment
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                appointments.map((apt) => (
                  <tr key={apt._id}>
                    <td>
                      <strong>{new Date(apt.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{apt.timeSlot || 'Flexible'}</div>
                    </td>
                    <td>
                      {apt.doctor ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <User size={15} color="var(--teal)" />
                          <span>Dr. {apt.doctor.firstName} {apt.doctor.lastName}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending Doctor Assignment</span>
                      )}
                    </td>
                    <td>
                      <div style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {apt.reason}
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${apt.status}`}>
                        <span className="status-dot"></span>
                        {apt.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => openTimeline(apt)}
                          className="btn btn-secondary btn-sm"
                          title="View Status History"
                        >
                          <History size={14} />
                          <span>History</span>
                        </button>
                        {['Pending', 'Confirmed'].includes(apt.status) && (
                          <button
                            onClick={() => handleCancel(apt._id)}
                            className="btn btn-danger btn-sm"
                            title="Cancel Appointment"
                          >
                            <XCircle size={14} />
                            <span>Cancel</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Modal */}
      <BookAppointmentModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        onSuccess={() => fetchAppointments()}
      />

      {/* History / Version Tracking Modal */}
      <StatusTimelineModal
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        appointment={selectedAppointment}
      />
    </div>
  );
}
