import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import WorkspaceNavigation from '../components/WorkspaceNavigation';
import LoadError from '../components/LoadError';
import { useDialog } from '../context/DialogContext';
import { useAuth } from '../context/AuthContext';
import StatusTimelineModal from '../components/StatusTimelineModal';
import AppointmentPatientDetails from '../components/AppointmentPatientDetails';
import SlotManagement from '../components/SlotManagement';
import WalkInQueue from '../components/WalkInQueue';
import AssignSlotModal from '../components/AssignSlotModal';
import ReportsPage from './ReportsPage';
import { Calendar, Check, X, CheckCircle2, Filter, History, RefreshCw, UserCheck, AlertTriangle, Clock, Users } from 'lucide-react';

export default function StaffDashboard() {
  const showDialog = useDialog();
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [activeTab, setActiveTab] = useState('appointments'); // 'appointments' | 'slots' | 'walkins'

  const fetchAppointments = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.getAppointments({ status: statusFilter || undefined });
      if (res.success && res.data) {
        setAppointments(Array.isArray(res.data) ? res.data : []);
      } else {
        setLoadError('Appointments could not be loaded.');
      }
    } catch (err) {
      setLoadError('Appointments could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter]);

  const handleApprove = async (id) => {
    if (!await showDialog({ kind: 'confirm', title: 'Approve appointment', message: 'Approve this appointment request?', confirmText: 'Approve appointment' })) return;
    try {
      await api.approveAppointment(id);
      fetchAppointments();
    } catch (err) {
      await showDialog({ title: 'Action unsuccessful', danger: true, message: err.message || 'Failed to approve appointment' });
    }
  };

  const handleDecline = async (id) => {
    const reason = await showDialog({ kind: 'prompt', title: 'Decline appointment', message: 'Please enter the reason for declining this request.', confirmText: 'Decline appointment', required: true, danger: true });
    if (!reason || !reason.trim()) return;
    try {
      await api.declineAppointment(id, reason.trim());
      fetchAppointments();
    } catch (err) {
      await showDialog({ title: 'Action unsuccessful', danger: true, message: err.message || 'Failed to decline appointment' });
    }
  };

  const handleCheckIn = async (id) => {
    try {
      await api.checkInAppointment(id);
      fetchAppointments();
    } catch (err) {
      await showDialog({ title: 'Action unsuccessful', danger: true, message: err.message || 'Failed to check in patient' });
    }
  };

  const handleStartConsultation = async (id) => {
    try { await api.startConsultation(id); await fetchAppointments(); }
    catch (err) { await showDialog({ title: 'Action unsuccessful', danger: true, message: err.message || 'Failed to start consultation' }); }
  };

  const handleNoShow = async (id) => {
    const reason = await showDialog({ kind: 'prompt', title: 'Mark as no-show', message: 'This will mark the patient as absent and free the appointment slot.', confirmText: 'Mark no-show', defaultValue: 'Patient did not arrive for scheduled slot', danger: true });
    if (reason === null) return;
    try {
      await api.noShowAppointment(id, reason);
      fetchAppointments();
    } catch (err) {
      await showDialog({ title: 'Action unsuccessful', danger: true, message: err.message || 'Failed to mark as no-show' });
    }
  };

  const handleComplete = async (id) => {
    if (!await showDialog({ kind: 'confirm', title: 'Complete appointment', message: 'Mark this appointment as completed?', confirmText: 'Complete appointment' })) return;
    try {
      await api.completeAppointment(id);
      fetchAppointments();
    } catch (err) {
      await showDialog({ title: 'Action unsuccessful', danger: true, message: err.message || 'Failed to complete appointment' });
    }
  };

  const handleCancel = async (id) => {
    const reason = await showDialog({ kind: 'prompt', title: 'Cancel appointment', message: 'You can include a reason for cancelling this appointment.', confirmText: 'Cancel appointment', danger: true });
    if (reason === null) return;
    try {
      await api.cancelAppointment(id, reason || 'Cancelled by staff');
      fetchAppointments();
    } catch (err) {
      await showDialog({ title: 'Action unsuccessful', danger: true, message: err.message || 'Failed to cancel appointment' });
    }
  };

  const openTimeline = (apt) => {
    setSelectedAppointment(apt);
    setTimelineOpen(true);
  };

  const pendingCount = appointments.filter((a) => a.status === 'Pending').length;
  const confirmedCount = appointments.filter((a) => a.status === 'Confirmed').length;
  const waitingCount = appointments.filter((a) => a.status === 'Checked In').length;
  const inProgressCount = appointments.filter((a) => a.status === 'In Progress').length;
  const completedCount = appointments.filter((a) => a.status === 'Completed').length;

  return (
    <main className="main-content dashboard-page staff-dashboard">
      {/* Welcome Banner */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Front desk / Overview</p>
          <h1>
            Keep every visit moving
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Review appointment requests, check in patients, and coordinate the walk-in queue.
          </p>
        </div>
        <button onClick={fetchAppointments} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      <LoadError message={loadError} onRetry={fetchAppointments} loading={loading} />

      {/* Stats Cards */}
      {activeTab !== 'reports' && <div className="stats-grid">
        <div className="stat-card">
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
            <div className="stat-label">{waitingCount} checked in and waiting</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
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
      </div>}

      {/* Navigation Tabs */}
      <WorkspaceNavigation label="Staff workspace">
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
        <button className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('reports')}>Reports</button>
      </WorkspaceNavigation>

      {activeTab === 'appointments' && (
        <div className="card">
          {/* Appointment Queue */}
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={20} color="var(--primary)" />
              <h3>Appointment requests &amp; arrivals</h3>
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
                <option value="Needs correction">Needs correction (Waiting for patient)</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Checked In">Checked In / Waiting</option>
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
                      {loading ? 'Fetching queue...' : loadError ? 'Appointments are unavailable. Please retry.' : 'No appointments matching current filter.'}
                    </td>
                  </tr>
                ) : (
                  appointments.map((apt) => (
                    <tr key={apt._id}>
                      <td>
                        <AppointmentPatientDetails appointment={apt} />
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
                        <span className={`badge badge-${apt.status.replace(/\s+/g, '-')}`}>
                          <span className="status-dot"></span>
                          {apt.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {apt.status === 'Pending' && (
                            <>
                              {!apt.walkIn && <button className="btn btn-secondary btn-sm" onClick={() => openTimeline(apt)}>Request correction</button>}
                              <button
                                onClick={() => handleApprove(apt._id)}
                                className="btn btn-success btn-sm"
                                title="Approve Appointment"
                                disabled={!apt.slot || !apt.doctor}
                              >
                                <Check size={14} />
                                <span>Approve</span>
                              </button>
                              {!apt.slot && !apt.walkIn && <button className="btn btn-primary btn-sm" onClick={() => setAssignment(apt)}>Assign doctor &amp; slot</button>}
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
                          {apt.status === 'Checked In' && <button className="btn btn-primary btn-sm" onClick={() => handleStartConsultation(apt._id)}>Start consultation</button>}
                          {apt.status === 'In Progress' && (
                            <button
                              onClick={() => handleComplete(apt._id)}
                              className="btn btn-teal btn-sm"
                              title="Mark Completed"
                            >
                              <CheckCircle2 size={14} />
                              <span>Complete</span>
                            </button>
                          )}
                          {['Pending', 'Needs correction', 'Confirmed', 'Checked In'].includes(apt.status) && (
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
                            title="View appointment history and comments"
                          >
                            <History size={14} />
                            <span>History &amp; comments</span>
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
      {activeTab === 'reports' && <ReportsPage />}
      <AssignSlotModal isOpen={!!assignment} appointment={assignment} onClose={() => setAssignment(null)} onAssigned={fetchAppointments} />

      {activeTab === 'walkins' && <WalkInQueue isStaff={true} />}

      <StatusTimelineModal
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        appointment={selectedAppointment}
        onUpdated={fetchAppointments}
      />
      <footer className="workspace-footer"><span>CareSync · Front desk</span><span>Appointments, arrivals &amp; walk-ins</span></footer>
    </main>
  );
}
