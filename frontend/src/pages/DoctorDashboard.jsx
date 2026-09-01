import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusTimelineModal from '../components/StatusTimelineModal';
import { Stethoscope, Calendar, Clock, User, CheckCircle2, History, RefreshCw, XCircle } from 'lucide-react';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
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
      console.error('Failed to load consultations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleComplete = async (id) => {
    if (!window.confirm('Mark this patient consultation as Completed?')) return;
    try {
      await api.completeAppointment(id);
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Failed to complete consultation');
    }
  };

  const handleCancel = async (id) => {
    const reason = window.prompt('Enter reason for cancellation:');
    if (reason === null) return;
    try {
      await api.cancelAppointment(id, reason || 'Cancelled by Doctor');
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment');
    }
  };

  const openTimeline = (apt) => {
    setSelectedAppointment(apt);
    setTimelineOpen(true);
  };

  const confirmedCount = appointments.filter((a) => a.status === 'Confirmed').length;
  const completedCount = appointments.filter((a) => a.status === 'Completed').length;

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
            Dr. {user.firstName} {user.lastName}'s Practice Portal 🩺
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Review your patient queue, consultation logs, and medical appointments.
          </p>
        </div>
        <button onClick={fetchAppointments} className="btn btn-secondary">
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Calendar size={24} />
          </div>
          <div>
            <div className="stat-val">{confirmedCount}</div>
            <div className="stat-label">Upcoming Patients Today</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--emerald-light)', color: 'var(--emerald)' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="stat-val">{completedCount}</div>
            <div className="stat-label">Consultations Completed</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Stethoscope size={20} color="var(--teal)" />
            <h3>Assigned Consultations & Queue</h3>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {appointments.length} Total Patients
          </span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Schedule</th>
                <th>Symptoms / Notes</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Doctor Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    {loading ? 'Loading consultations...' : 'No consultations assigned to you yet.'}
                  </td>
                </tr>
              ) : (
                appointments.map((apt) => (
                  <tr key={apt._id}>
                    <td>
                      <strong>
                        {apt.patient?.firstName} {apt.patient?.lastName}
                      </strong>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                        {apt.patient?.email}
                      </div>
                    </td>
                    <td>
                      <div>{new Date(apt.date).toLocaleDateString()}</div>
                      <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>{apt.timeSlot}</div>
                    </td>
                    <td>
                      <div style={{ maxWidth: '250px' }}>{apt.reason}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${apt.status}`}>
                        <span className="status-dot"></span>
                        {apt.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                        {apt.status === 'Confirmed' && (
                          <button
                            onClick={() => handleComplete(apt._id)}
                            className="btn btn-teal btn-sm"
                            title="Complete Consultation"
                          >
                            <CheckCircle2 size={14} />
                            <span>Complete</span>
                          </button>
                        )}
                        {['Pending', 'Confirmed'].includes(apt.status) && (
                          <button
                            onClick={() => handleCancel(apt._id)}
                            className="btn btn-danger btn-sm"
                            title="Cancel Consultation"
                          >
                            <XCircle size={14} />
                            <span>Cancel</span>
                          </button>
                        )}
                        <button
                          onClick={() => openTimeline(apt)}
                          className="btn btn-secondary btn-sm"
                          title="History"
                        >
                          <History size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <StatusTimelineModal
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        appointment={selectedAppointment}
      />
    </div>
  );
}
