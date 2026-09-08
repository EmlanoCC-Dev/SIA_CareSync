import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusTimelineModal from '../components/StatusTimelineModal';
import SlotManagement from '../components/SlotManagement';
import WalkInQueue from '../components/WalkInQueue';
import { Calendar, Check, X, CheckCircle2, Filter, History, RefreshCw, UserCheck, AlertTriangle, Clock, Users } from 'lucide-react';

export default function StaffDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('appointments'); // 'appointments' | 'slots' | 'walkins'

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await api.getAppointments({ status: statusFilter || undefined });
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
  }, [statusFilter]);

  const handleApprove = async (id) => {
    if (!window.confirm('Are you sure you want to approve this appointment?')) return;
    try {
      await api.approveAppointment(id);
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Failed to approve appointment');
    }
  };

  const handleDecline = async (id) => {
    const reason = window.prompt('Please enter the reason for declining this request:');
    if (!reason || !reason.trim()) return;
    try {
      await api.declineAppointment(id, reason.trim());
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Failed to decline appointment');
    }
  };

  const handleCheckIn = async (id) => {
    try {
      await api.checkInAppointment(id);
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Failed to check in patient');
    }
  };

  const handleNoShow = async (id) => {
    const reason = window.prompt('Reason for marking No-Show (optional):', 'Patient did not arrive for scheduled slot');
    if (reason === null) return;
    try {
      await api.noShowAppointment(id, reason);
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Failed to mark as no-show');
    }
  };

  const handleComplete = async (id) => {
    if (!window.confirm('Mark this appointment as Completed?')) return;
    try {
      await api.completeAppointment(id);
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Failed to complete appointment');
    }
  };

  const handleCancel = async (id) => {
    const reason = window.prompt('Enter reason for cancellation:');
    if (reason === null) return;
    try {
      await api.cancelAppointment(id, reason || 'Cancelled by staff');
      fetchAppointments();
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment');
    }
  };

  const openTimeline = (apt) => {
    setSelectedAppointment(apt);
    setTimelineOpen(true);
  };

  const pendingCount = appointments.filter((a) => a.status === 'Pending').length;
  const confirmedCount = appointments.filter((a) => a.status === 'Confirmed').length;
  const inProgressCount = appointments.filter((a) => a.status === 'In Progress').length;
  const completedCount = appointments.filter((a) => a.status === 'Completed').length;

  return (
    <div className="main-content">
      {/* Welcome Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
            Staff Triage & Operations Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Review, approve, triage, and manage appointment requests across all hospital departments.
          </p>
        </div>
        <button onClick={fetchAppointments} className="btn btn-secondary">
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ borderColor: 'var(--amber)' }}>
          <div className="stat-icon" style={{ background: 'var(--amber-light)', color: 'var(--amber)' }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div className="stat-val">{pendingCount}</div>
            <div className="stat-label">Pending Approval</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <UserCheck size={24} />
          </div>
          <div>
            <div className="stat-val">{confirmedCount}</div>
            <div className="stat-label">Confirmed / Scheduled</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#ede9fe', color: '#6d28d9' }}>
            <Clock size={24} />
          </div>
          <div>
            <div className="stat-val">{inProgressCount}</div>
            <div className="stat-label">In Progress</div>
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

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${activeTab === 'appointments' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('appointments')}
        >
          <Calendar size={16} /> Appointments
        </button>
        <button
          className={`btn ${activeTab === 'slots' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('slots')}
        >
          <Clock size={16} /> Slot Management
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
          {/* Appointment Queue */}
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={20} color="var(--primary)" />
              <h3>Master Appointment Queue</h3>
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
                <option value="Pending">Pending (Needs Approval)</option>
                <option value="Confirmed">Confirmed</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Declined">Declined</option>
                <option value="No-show">No-Show</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Patient Details</th>
                  <th>Doctor</th>
                  <th>Date & Slot</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Staff Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      {loading ? 'Fetching queue...' : 'No appointments matching current filter.'}
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
                        {apt.doctor ? (
                          <span>Dr. {apt.doctor.firstName} {apt.doctor.lastName}</span>
                        ) : (
                          <span style={{ color: 'var(--amber)', fontWeight: 600 }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <div>{new Date(apt.date).toLocaleDateString()}</div>
                        <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>{apt.timeSlot}</div>
                      </td>
                      <td>
                        <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {apt.reason}
                        </div>
                        {apt.declineReason && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--rose)', marginTop: '0.2rem' }}>
                            Reason: {apt.declineReason}
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
                        <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {apt.status === 'Pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(apt._id)}
                                className="btn btn-success btn-sm"
                                title="Approve Appointment"
                              >
                                <Check size={14} />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => handleDecline(apt._id)}
                                className="btn btn-danger btn-sm"
                                title="Decline Appointment"
                              >
                                <X size={14} />
                                <span>Decline</span>
                              </button>
                            </>
                          )}
                          {apt.status === 'Confirmed' && (
                            <>
                              <button
                                onClick={() => handleCheckIn(apt._id)}
                                className="btn btn-primary btn-sm"
                                title="Check In Patient (Arrived)"
                              >
                                <UserCheck size={14} />
                                <span>Check In</span>
                              </button>
                              <button
                                onClick={() => handleNoShow(apt._id)}
                                className="btn btn-danger btn-sm"
                                title="Mark No-Show (Frees slot)"
                              >
                                <span>No-Show</span>
                              </button>
                            </>
                          )}
                          {(apt.status === 'Confirmed' || apt.status === 'In Progress') && (
                            <button
                              onClick={() => handleComplete(apt._id)}
                              className="btn btn-teal btn-sm"
                              title="Mark Completed"
                            >
                              <CheckCircle2 size={14} />
                              <span>Complete</span>
                            </button>
                          )}
                          {['Pending', 'Confirmed'].includes(apt.status) && (
                            <button
                              onClick={() => handleCancel(apt._id)}
                              className="btn btn-danger btn-sm"
                              title="Cancel"
                            >
                              <X size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => openTimeline(apt)}
                            className="btn btn-secondary btn-sm"
                            title="View Version Timeline"
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

      {activeTab === 'slots' && <SlotManagement />}

      {activeTab === 'walkins' && <WalkInQueue isStaff={true} />}

      <StatusTimelineModal
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        appointment={selectedAppointment}
      />
    </div >
  );
}
