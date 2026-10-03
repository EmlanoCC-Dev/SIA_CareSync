import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { useAuth } from '../context/AuthContext';
import BookAppointmentModal from '../components/BookAppointmentModal';
import StatusTimelineModal from '../components/StatusTimelineModal';
import VersionHistory from '../components/VersionHistory';
import { PlusCircle, Calendar, Clock, User, AlertCircle, History, XCircle, CheckCircle2 } from 'lucide-react';

export default function PatientDashboard() {
  const showDialog = useDialog();
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
    const reason = await showDialog({ kind: 'prompt', title: 'Cancel appointment', message: 'You can include a reason for cancelling your appointment.', confirmText: 'Cancel appointment', danger: true });
    if (reason === null) return;

    try {
      await api.cancelAppointment(id, reason || 'Cancelled by patient');
      fetchAppointments();
    } catch (err) {
      await showDialog({ title: 'Action unsuccessful', danger: true, message: err.message || 'Failed to cancel appointment' });
    }
  };

  const openTimeline = (apt) => {
    setSelectedAppointment(apt);
    setTimelineOpen(true);
  };

  const [notesOpen, setNotesOpen] = useState(false);
  const [selectedNotesApt, setSelectedNotesApt] = useState(null);
  const recordDialog = useRef(null);
  useEffect(() => {
    if (!notesOpen || !selectedNotesApt) return;
    const node = recordDialog.current;
    node.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { node.close(); document.body.style.overflow = previousOverflow; };
  }, [notesOpen, selectedNotesApt?._id]);

  const openNotes = (apt) => {
    setSelectedNotesApt(apt);
    setNotesOpen(true);
  };

  // Stats calculation
  const pendingCount = appointments.filter((a) => a.status === 'Pending').length;
  const confirmedCount = appointments.filter((a) => ['Confirmed', 'Checked In', 'In Progress'].includes(a.status)).length;
  const completedCount = appointments.filter((a) => a.status === 'Completed').length;

  return (
    <main className="main-content dashboard-page patient-dashboard">
      {/* Welcome Banner */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Patient portal / Overview</p>
          <h1>
            Welcome back, {user.firstName}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Your appointments and consultation records, in one place.
          </p>
        </div>
        <button onClick={() => setIsBookingOpen(true)} className="btn btn-primary">
          <PlusCircle size={18} />
          <span>Book New Appointment</span>
        </button>
      </div>

      <nav className="dashboard-tabs" aria-label="Patient workspace">
        <a className="btn btn-primary" href="#appointments" aria-current="page"><Calendar size={18} /> My appointments</a>
        <button className="btn btn-secondary" onClick={() => setIsBookingOpen(true)}><PlusCircle size={18} /> Book a visit</button>
      </nav>

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
            <div className="stat-label">Upcoming / Active</div>
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

      <section className="care-path" aria-labelledby="visit-guide-title">
        <div><p className="page-eyebrow">Your visit, step by step</p><h2 id="visit-guide-title">A little planning. Better care.</h2><p>Check your appointment status before you head to the clinic.</p></div>
        <ol>
          <li><span>01</span><strong>Book your visit</strong><p>Choose a doctor and an available time.</p></li>
          <li><span>02</span><strong>Wait for confirmation</strong><p>The clinic will review your request.</p></li>
          <li><span>03</span><strong>Check in at reception</strong><p>Let the care team know you have arrived.</p></li>
        </ol>
      </section>

      {/* Appointments List */}
      <div className="card" id="appointments">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} color="var(--primary)" />
            <h3>My appointments</h3>
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
                      {apt.queueNumber != null && <div className="appointment-visit-source">Your queue ticket: #A-{apt.queueNumber}</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {(apt.consultationNotes || apt.notesRevision > 0 || (apt.documents && apt.documents.length > 0)) && (
                          <button
                            onClick={() => openNotes(apt)}
                            className="btn btn-teal btn-sm"
                            title="View Doctor's Notes & Documents"
                          >
                            <span>Medical Records</span>
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
                        {apt.status === 'Needs correction' && <button className="btn btn-primary btn-sm" onClick={() => openTimeline(apt)}>Edit &amp; resubmit</button>}
                        {['Pending', 'Needs correction', 'Confirmed', 'Checked In'].includes(apt.status) && (
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
        onUpdated={fetchAppointments}
      />

      {/* Patient Medical Notes Modal */}
      {notesOpen && selectedNotesApt && (
          <dialog ref={recordDialog} className="modal-content care-dialog" style={{ width: 'min(560px, calc(100% - 32px))' }}
            aria-labelledby="patient-record-title" onCancel={event => { event.preventDefault(); setNotesOpen(false); }}>
            <div className="modal-header">
              <h3 id="patient-record-title">Doctor's Consultation Record</h3>
              <button onClick={() => setNotesOpen(false)} aria-label="Close medical record" className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ background: 'var(--bg-muted)', padding: '0.85rem', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {selectedNotesApt.doctor ? `Dr. ${selectedNotesApt.doctor.firstName} ${selectedNotesApt.doctor.lastName}` : 'Attending Physician'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Consultation Date: {new Date(selectedNotesApt.date).toLocaleDateString()} ({selectedNotesApt.timeSlot})
                </div>
              </div>

              {selectedNotesApt.consultationNotes ? (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 700 }}>
                    Clinical Assessment & Prescription
                  </label>
                  <div style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', lineHeight: '1.6', fontSize: '0.9rem' }}>
                    {selectedNotesApt.consultationNotes}
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '1.5rem' }}>
                  No written notes recorded for this consultation.
                </p>
              )}

              {selectedNotesApt.documents && selectedNotesApt.documents.length > 0 && (
                <div>
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Attached Lab & Diagnostic Reports ({selectedNotesApt.documents.length})
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedNotesApt.documents.map((doc, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.6rem 0.85rem',
                          borderRadius: 'var(--radius-md)',
                          background: 'var(--bg-muted)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{doc.filename}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                            {doc.type ? doc.type.replace('_', ' ') : 'Medical Document'}
                          </div>
                        </div>
                        {doc._id && doc.url && doc.url !== '#' && (
                          <button
                            type="button"
                            onClick={async () => {
                              try { await api.downloadAppointmentDocument(selectedNotesApt._id, doc); }
                              catch (err) { await showDialog({ title: 'Download unsuccessful', danger: true, message: err.message }); }
                            }}
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '0.75rem' }}
                          >
                            Download
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <VersionHistory key={selectedNotesApt._id} appointmentId={selectedNotesApt._id} />
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setNotesOpen(false)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </dialog>
      )}
      <footer className="workspace-footer"><span>CareSync · Patient portal</span><span>Appointments &amp; consultation records</span></footer>
    </main>
  );
}
