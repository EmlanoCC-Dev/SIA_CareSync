import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import AuditLogViewer from '../components/AuditLogViewer';
import StatusTimelineModal from '../components/StatusTimelineModal';
import AppointmentPatientDetails from '../components/AppointmentPatientDetails';
import AddUserModal from '../components/AddUserModal';
import AssignSlotModal from '../components/AssignSlotModal';
import SlotManagement from '../components/SlotManagement';
import ReportsPage from './ReportsPage';
import WorkspaceNavigation from '../components/WorkspaceNavigation';
import LoadError from '../components/LoadError';
import { ShieldCheck, Users, Calendar, ShieldAlert, CheckCircle2, History, RefreshCw, UserPlus, Filter, Search } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('appointments'); // 'audit' | 'appointments' | 'users'
  const [appointments, setAppointments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadErrors, setLoadErrors] = useState({});
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetFeedback, setResetFeedback] = useState(null);

  // User Directory filters & modal state
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setLoadErrors({});
    try {
      const results = await Promise.allSettled([api.getAppointments(), api.getUsers()]);
      const failures = {};
      results.forEach((result, index) => {
        const key = index === 0 ? 'appointments' : 'users';
        if (result.status === 'fulfilled' && result.value.success && Array.isArray(result.value.data)) {
          (index === 0 ? setAppointments : setUsers)(result.value.data);
        } else {
          failures[key] = index === 0 ? 'Appointments could not be loaded.' : 'User directory could not be loaded.';
        }
      });
      setLoadErrors(failures);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openTimeline = (apt) => {
    setSelectedAppointment(apt);
    setTimelineOpen(true);
  };

  const clearDemoData = async (event) => {
    event.preventDefault();
    if (resetting || resetConfirmation !== 'CLEAR DEMO DATA') return;
    setResetting(true);
    setResetFeedback(null);
    try {
      const result = await api.clearDemoData(resetConfirmation);
      setResetConfirmation('');
      setSelectedAppointment(null);
      setTimelineOpen(false);
      setAssignment(null);
      setEditingUser(null);
      setIsAddUserModalOpen(false);
      setResetFeedback({ success: true, message: result.message });
      await loadData();
    } catch (err) {
      setResetFeedback({ success: false, message: err.message });
    } finally {
      setResetting(false);
    }
  };

  // Filter users by role and search query
  const filteredUsers = users.filter((u) => {
    const matchesRole = !userRoleFilter || u.role === userRoleFilter;
    const q = userSearch.toLowerCase().trim();
    const fullName = `${u.firstName} ${u.lastName}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const contact = (u.contactNumber || '').toLowerCase();
    const matchesSearch = !q || fullName.includes(q) || email.includes(q) || contact.includes(q);
    return matchesRole && matchesSearch;
  });

  return (
    <main className="main-content dashboard-page admin-dashboard">
      {/* Header */}
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Administration / Overview</p>
          <h1>
            Clinic administration
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Oversee appointments, manage your care team, and review clinic activity.
          </p>
        </div>
        <button onClick={loadData} className="btn btn-secondary" disabled={resetting || loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh All</span>
        </button>
      </div>

      <LoadError message={Object.values(loadErrors).join(' ')} onRetry={loadData} loading={loading || resetting} />

      {/* Top Metrics */}
      {activeTab !== 'reports' && <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--indigo-light)', color: 'var(--indigo)' }}>
            <Users size={24} />
          </div>
          <div>
            <div className="stat-val">{users.length}</div>
            <div className="stat-label">Registered System Users</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Calendar size={24} />
          </div>
          <div>
            <div className="stat-val">{appointments.length}</div>
            <div className="stat-label">Total Appointments Processed</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'var(--teal-light)', color: 'var(--teal)' }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <div className="stat-val">{users.filter((u) => u.role === 'Doctor').length}</div>
            <div className="stat-label">Registered doctors</div>
          </div>
        </div>
      </div>}

      {/* Navigation Tabs */}
      <WorkspaceNavigation label="Administration workspace">
        <button
          onClick={() => setActiveTab('audit')}
          disabled={resetting}
          className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <ShieldAlert size={15} />
          <span>Activity &amp; audit trail</span>
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          disabled={resetting}
          className={`btn btn-sm ${activeTab === 'appointments' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Calendar size={15} />
          <span>All Appointments</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          disabled={resetting}
          className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Users size={15} />
          <span>User Directory</span>
        </button>
        <button className={`btn btn-sm ${activeTab === 'slots' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('slots')} disabled={resetting}>Slot Management</button>
        <button className={`btn btn-sm ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('reports')} disabled={resetting}>Reports</button>
        <button className={`btn btn-sm ${activeTab === 'demo' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('demo')} disabled={resetting}>Demo reset</button>
      </WorkspaceNavigation>

      {/* Tab 1: Audit Logs */}
      {activeTab === 'audit' && <AuditLogViewer />}
      {activeTab === 'slots' && <SlotManagement />}
      {activeTab === 'reports' && <ReportsPage />}

      {activeTab === 'demo' && (
        <section className="card" aria-labelledby="demo-reset-title" style={{ padding: '24px' }}>
          <h3 id="demo-reset-title" style={{ marginBottom: '1rem' }}>Clear data for a fresh demo</h3>
          <p style={{ marginBottom: '1rem' }}>
            Keep all doctor and staff accounts, including their login details and doctor working hours,
            plus your current admin account. Delete all other accounts and clinic data:
            appointments, walk-ins, generated slots, comments, notifications, audit logs,
            verification codes, and uploaded documents. The system clock returns to real time.
          </p>
          <p style={{ color: 'var(--rose)', marginBottom: '1.5rem' }}>
            This permanently deletes the data and cannot be undone. Pause activity in other tabs before clearing.
          </p>
          {resetFeedback && <div className={`alert alert-${resetFeedback.success ? 'success' : 'error'}`} role={resetFeedback.success ? 'status' : 'alert'}>{resetFeedback.message}</div>}
          <form onSubmit={clearDemoData} style={{ maxWidth: '440px' }} aria-busy={resetting}>
            <div className="form-group">
              <label className="form-label" htmlFor="demo-reset-confirmation">Type CLEAR DEMO DATA to confirm</label>
              <input id="demo-reset-confirmation" className="form-input" value={resetConfirmation}
                onChange={event => setResetConfirmation(event.target.value)} autoComplete="off" spellCheck={false} disabled={resetting} />
            </div>
            <button type="submit" className="btn btn-danger" disabled={resetting || resetConfirmation !== 'CLEAR DEMO DATA'}>
              {resetting ? 'Clearing demo data...' : 'Permanently clear demo data'}
            </button>
          </form>
        </section>
      )}

      {/* Tab 2: Appointments */}
      {activeTab === 'appointments' && (
        <div className="card">
          <div className="card-header">
            <h3>All appointments</h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{appointments.length} records</span>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date & Time</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{loading ? 'Loading appointments...' : loadErrors.appointments ? 'Appointments are unavailable. Please retry.' : 'No appointments have been booked yet.'}</td></tr>}
                {appointments.map((apt) => (
                  <tr key={apt._id}>
                    <td>
                      <AppointmentPatientDetails appointment={apt} />
                    </td>
                    <td>
                      {apt.doctor ? `Dr. ${apt.doctor.firstName} ${apt.doctor.lastName}` : 'Unassigned'}
                    </td>
                    <td>
                      {new Date(apt.date).toLocaleDateString()}
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{apt.timeSlot}</div>
                    </td>
                    <td>{apt.reason}</td>
                    <td>
                      <span className={`badge badge-${apt.status.replace(/\s+/g, '-')}`}>
                        <span className="status-dot"></span>
                        {apt.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {apt.status === 'Pending' && !apt.walkIn && <button className="btn btn-secondary btn-sm" onClick={() => openTimeline(apt)}>Request correction</button>}
                      {apt.status === 'Pending' && !apt.slot && !apt.walkIn && <button className="btn btn-primary btn-sm" onClick={() => setAssignment(apt)}>Assign doctor &amp; slot</button>}
                      <button onClick={() => openTimeline(apt)} className="btn btn-secondary btn-sm">
                        <History size={14} />
                        <span>History &amp; comments</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: User Directory */}
      {activeTab === 'users' && (
        <div className="card">
          <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Patients &amp; care team</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Showing {filteredUsers.length} of {users.length} registered users
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Role Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Filter size={15} color="var(--text-muted)" />
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                >
                  <option value="">All Account Types</option>
                  <option value="Patient">Patient</option>
                  <option value="Doctor">Doctor</option>
                  <option value="Staff">Staff</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>

              {/* Search User input */}
              <div style={{ position: 'relative' }}>
                <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '2rem', paddingRight: '0.75rem', paddingBlock: '0.35rem', fontSize: '0.85rem', width: '200px' }}
                  placeholder="Search by name, email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>

              {/* Add Doctor / Staff Button */}
              <button
                type="button"
                onClick={() => setIsAddUserModalOpen(true)}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.8rem' }}
              >
                <UserPlus size={15} />
                <span>Add Doctor / Staff</span>
              </button>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Contact</th>
                  <th>Registered Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      {loading ? 'Loading users...' : loadErrors.users ? 'User directory is unavailable. Please retry.' : 'No users match the selected role or search criteria.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u._id}>
                      <td>
                        <strong>{u.firstName} {u.lastName}</strong>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className={`role-badge role-${u.role}`}>{u.role}</span>
                      </td>
                      <td><span className={`badge badge-${u.status === 'Deactivated' ? 'Cancelled' : 'Completed'}`}>{u.status || 'Active'}</span></td>
                      <td>{u.contactNumber || '—'}</td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td><button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingUser(u)} aria-label={`Edit ${u.firstName} ${u.lastName}`}>Edit account</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Doctor / Staff User Modal */}
      <AssignSlotModal isOpen={!!assignment} appointment={assignment} onClose={() => setAssignment(null)} onAssigned={loadData} />
      <AddUserModal
        key={editingUser?._id || 'new-account'}
        isOpen={isAddUserModalOpen || !!editingUser}
        user={editingUser}
        onClose={() => { setIsAddUserModalOpen(false); setEditingUser(null); }}
        onUserAdded={loadData}
      />

      <StatusTimelineModal
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        appointment={selectedAppointment}
        onUpdated={loadData}
      />
      <footer className="workspace-footer"><span>CareSync · Administration</span><span>Care team &amp; clinic oversight</span></footer>
    </main>
  );
}
