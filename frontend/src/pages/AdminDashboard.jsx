import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import AuditLogViewer from '../components/AuditLogViewer';
import StatusTimelineModal from '../components/StatusTimelineModal';
import AppointmentPatientDetails from '../components/AppointmentPatientDetails';
import AddUserModal from '../components/AddUserModal';
import AssignSlotModal from '../components/AssignSlotModal';
import SlotManagement from '../components/SlotManagement';
import ReportsPage from './ReportsPage';
import { ShieldCheck, Users, Calendar, ShieldAlert, CheckCircle2, History, RefreshCw, UserPlus, Filter, Search } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('appointments'); // 'audit' | 'appointments' | 'users'
  const [appointments, setAppointments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [assignment, setAssignment] = useState(null);

  // User Directory filters & modal state
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [aptRes, userRes] = await Promise.all([
        api.getAppointments().catch(() => ({ success: false, data: [] })),
        api.getUsers().catch(() => ({ success: false, data: [] })),
      ]);
      if (aptRes.success && aptRes.data) {
        setAppointments(Array.isArray(aptRes.data) ? aptRes.data : []);
      }
      if (userRes.success && userRes.data) {
        setUsers(Array.isArray(userRes.data) ? userRes.data : []);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
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
        <button onClick={loadData} className="btn btn-secondary">
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh All</span>
        </button>
      </div>

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
      <div className="dashboard-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('audit')}
          className={`btn btn-sm ${activeTab === 'audit' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <ShieldAlert size={15} />
          <span>Activity &amp; audit trail</span>
        </button>
        <button
          onClick={() => setActiveTab('appointments')}
          className={`btn btn-sm ${activeTab === 'appointments' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Calendar size={15} />
          <span>All Appointments</span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`btn btn-sm ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Users size={15} />
          <span>User Directory</span>
        </button>
        <button className={`btn btn-sm ${activeTab === 'slots' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('slots')}>Slot Management</button>
        <button className={`btn btn-sm ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('reports')}>Reports</button>
      </div>

      {/* Tab 1: Audit Logs */}
      {activeTab === 'audit' && <AuditLogViewer />}
      {activeTab === 'slots' && <SlotManagement />}
      {activeTab === 'reports' && <ReportsPage />}

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
                {appointments.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{loading ? 'Loading appointments...' : 'No appointments have been booked yet.'}</td></tr>}
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
                      No users match the selected role or search criteria.
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
      />
      <footer className="workspace-footer"><span>CareSync · Administration</span><span>Care team &amp; clinic oversight</span></footer>
    </main>
  );
}
