import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusTimelineModal from '../components/StatusTimelineModal';
import SlotManagement from '../components/SlotManagement';
import WalkInQueue from '../components/WalkInQueue';
import ConsultationModal from '../components/ConsultationModal';
import {
  Stethoscope,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  History,
  RefreshCw,
  XCircle,
  Users,
  PlayCircle,
  FileText,
  Filter,
} from 'lucide-react';

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [consultationOpen, setConsultationOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('appointments'); // 'appointments' | 'slots' | 'walkins'

  const doctorId = user._id || user.id;

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

  const handleStartConsultation = async (id) => {
    try {
      await api.checkInAppointment(id);
      fetchAppointments();
      const target = appointments.find((a) => a._id === id);
      if (target) {
        setSelectedAppointment({ ...target, status: 'In Progress' });
        setConsultationOpen(true);
      }
    } catch (err) {
      alert(err.message || 'Failed to start consultation');
    }
  };

  const handleDecline = async (id) => {
    const reason = window.prompt('Please enter the reason for declining this appointment request:');
    if (!reason || !reason.trim()) return;

    try {
      await api.declineAppointment(id, reason.trim());
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Failed to decline appointment');
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

  const openConsultation = (apt) => {
    setSelectedAppointment(apt);
    setConsultationOpen(true);
  };

  const filteredAppointments = statusFilter
    ? appointments.filter((a) => a.status === statusFilter)
    : appointments;

  const inProgressCount = appointments.filter((a) => a.status === 'In Progress').length;
  const confirmedCount = appointments.filter((a) => a.status === 'Confirmed').length;
  const completedCount = appointments.filter((a) => a.status === 'Completed').length;

  return (
    <div className="main-content dashboard-page doctor-dashboard">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
            Doctor Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Review, approve, and manage appointment requests across all hospital departments.
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
            <div className="stat-label">Upcoming Confirmed Today</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ede9fe', color: '#6d28d9' }}>
            <Stethoscope size={24} />
          </div>
          <div>
            <div className="stat-val">{inProgressCount}</div>
            <div className="stat-label">In Progress Consultations</div>
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

      {/* Navigation Tabs */}
      <div className="dashboard-tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${activeTab === 'appointments' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('appointments')}
        >
          <Calendar size={16} /> My Appointments
        </button>
        <button
          className={`btn ${activeTab === 'slots' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('slots')}
        >
          <Clock size={16} /> My Slots
        </button>
        <button
          className={`btn ${activeTab === 'walkins' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('walkins')}
        >
          <Users size={16} /> Walk-in Queue
        </button>
      </div>

      {activeTab === 'appointments' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Stethoscope size={20} color="var(--teal)" />
              <h3>Assigned Consultations & Queue</h3>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Filter size={16} color="var(--text-muted)" />
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.35rem 0.75rem' }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="In Progress">In Progress</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Pending">Pending Approval</option>
                <option value="Completed">Completed</option>
                <option value="Declined">Declined</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {filteredAppointments.length} Patient{filteredAppointments.length !== 1 ? 's' : ''}
              </span>
            </div>
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
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      {loading ? 'Loading consultations...' : 'No consultations matching the filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((apt) => (
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
                        {apt.consultationNotes && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--teal)', marginTop: '0.25rem' }}>
                            ✓ Notes recorded
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${apt.status}`}>
                          <span className="status-dot"></span>
                          {apt.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {apt.status === 'Confirmed' && (
                            <button
                              onClick={() => handleStartConsultation(apt._id)}
                              className="btn btn-primary btn-sm"
                              title="Start Consultation"
                            >
                              <PlayCircle size={14} />
                              <span>Start</span>
                            </button>
                          )}
                          {(apt.status === 'In Progress' || apt.status === 'Confirmed') && (
                            <button
                              onClick={() => openConsultation(apt)}
                              className="btn btn-teal btn-sm"
                              title="Consultation Notes & Records"
                            >
                              <FileText size={14} />
                              <span>Notes</span>
                            </button>
                          )}
                          {apt.status === 'Completed' && (
                            <button
                              onClick={() => openConsultation(apt)}
                              className="btn btn-secondary btn-sm"
                              title="View / Edit Clinical Notes"
                            >
                              <FileText size={14} />
                              <span>View Notes</span>
                            </button>
                          )}
                          {apt.status === 'Pending' && (
                            <button
                              onClick={() => handleDecline(apt._id)}
                              className="btn btn-danger btn-sm"
                              title="Decline Appointment"
                            >
                              <XCircle size={14} />
                              <span>Decline</span>
                            </button>
                          )}
                          {['Pending', 'Confirmed'].includes(apt.status) && (
                            <button
                              onClick={() => handleCancel(apt._id)}
                              className="btn btn-danger btn-sm"
                              title="Cancel Consultation"
                            >
                              <XCircle size={14} />
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
      )}

      {activeTab === 'slots' && <SlotManagement doctorId={doctorId} />}

      {activeTab === 'walkins' && <WalkInQueue isStaff={false} doctorId={doctorId} />}

      <ConsultationModal
        isOpen={consultationOpen}
        onClose={() => setConsultationOpen(false)}
        appointment={selectedAppointment}
        onSuccess={() => fetchAppointments()}
      />

      <StatusTimelineModal
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        appointment={selectedAppointment}
      />
    </div>
  );
}
