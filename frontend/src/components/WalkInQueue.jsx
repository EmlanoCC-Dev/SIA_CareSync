import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import AddWalkInModal from './AddWalkInModal';
import { Users, Plus, RefreshCw, CheckCircle2, UserCheck, AlertTriangle } from 'lucide-react';

export default function WalkInQueue({ isStaff = true, doctorId = null }) {
  const [walkIns, setWalkIns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // For assigning slot
  const [slots, setSlots] = useState([]);
  const [assigningSlotFor, setAssigningSlotFor] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState('');

  useEffect(() => {
    fetchWalkIns();
  }, [statusFilter]);

  const fetchWalkIns = async () => {
    setLoading(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      // Note: Backend gets walkins sorted by createdAt, we might not have a doctor filter yet unless implemented on backend.
      // But typically walk-ins without slots are global.
      const res = await api.getWalkIns({ status: statusFilter || undefined, date });
      if (res.success && res.data) {
        let filtered = Array.isArray(res.data) ? res.data : [];
        if (doctorId && statusFilter !== 'Waiting') {
          // simple client side filter if it's assigned to this doctor
          filtered = filtered.filter(w => !w.assignedSlot || w.assignedSlot.doctor === doctorId);
        }
        setWalkIns(filtered);
      } else {
        setWalkIns([]);
      }
    } catch (err) {
      console.error('Failed to load walk-ins:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSlotsForAssignment = async () => {
    try {
      const date = new Date().toISOString().split('T')[0];
      const res = await api.getSlots({ date, status: 'Available' });
      if (res.success && res.data) {
        setSlots(res.data);
      }
    } catch (err) {
      console.error('Failed to load available slots:', err);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.updateWalkInStatus(id, status);
      fetchWalkIns();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    }
  };

  const handleAssignSlot = async (walkInId) => {
    if (!selectedSlot) return;
    try {
      await api.assignSlotToWalkIn(walkInId, selectedSlot);
      setAssigningSlotFor(null);
      setSelectedSlot('');
      fetchWalkIns();
    } catch (err) {
      alert(err.message || 'Failed to assign slot');
    }
  };

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} color="var(--primary)" />
          <h3>Walk-In Queue</h3>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <select 
            className="form-select" 
            style={{ width: 'auto', padding: '0.35rem 0.75rem' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Waiting">Waiting</option>
            <option value="Slot Assigned">Slot Assigned</option>
            <option value="Checked In">Checked In</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Left">Left</option>
          </select>
          <button onClick={fetchWalkIns} className="btn btn-secondary" title="Refresh">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          {isStaff && (
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
              <Plus size={16} />
              <span>Add Walk-In</span>
            </button>
          )}
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Queue #</th>
              <th>Patient</th>
              <th>Status</th>
              <th>Assigned Slot</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {walkIns.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading queue...' : 'Queue is empty for today.'}
                </td>
              </tr>
            ) : (
              walkIns.map((walkIn) => (
                <tr key={walkIn._id}>
                  <td>
                    <div className="stat-val" style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>
                      #{walkIn.queueNumber}
                    </div>
                  </td>
                  <td>
                    <strong>{walkIn.name}</strong>
                    <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                      {walkIn.contactNumber}
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${walkIn.status.replace(/\s+/g, '-')}`}>
                      <span className="status-dot"></span>
                      {walkIn.status}
                    </span>
                  </td>
                  <td>
                    {walkIn.assignedSlot ? (
                      <div>
                        <div>{walkIn.assignedSlot.startTime} - {walkIn.assignedSlot.endTime}</div>
                        {walkIn.assignedSlot.doctor && (
                          <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                            Dr. {walkIn.assignedSlot.doctor.lastName || walkIn.assignedSlot.doctor}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--amber)' }}>Unassigned</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {assigningSlotFor === walkIn._id ? (
                      <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select 
                          className="form-select form-select-sm" 
                          value={selectedSlot}
                          onChange={(e) => setSelectedSlot(e.target.value)}
                        >
                          <option value="">Select Slot</option>
                          {slots.map(s => (
                            <option key={s._id} value={s._id}>
                              {s.startTime} - {s.doctor ? `Dr. ${s.doctor.lastName}` : ''}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-primary btn-sm" onClick={() => handleAssignSlot(walkIn._id)}>Assign</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setAssigningSlotFor(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        {isStaff && walkIn.status === 'Waiting' && (
                          <button 
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              loadSlotsForAssignment();
                              setAssigningSlotFor(walkIn._id);
                            }}
                          >
                            Assign Slot
                          </button>
                        )}
                        {isStaff && walkIn.status === 'Slot Assigned' && (
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => handleUpdateStatus(walkIn._id, 'Checked In')}
                            title="Check In"
                          >
                            <UserCheck size={14} /> Check In
                          </button>
                        )}
                        {doctorId && walkIn.status === 'Checked In' && (
                          <button 
                            className="btn btn-teal btn-sm"
                            onClick={() => handleUpdateStatus(walkIn._id, 'In Progress')}
                          >
                            Start Session
                          </button>
                        )}
                        {doctorId && walkIn.status === 'In Progress' && (
                          <button 
                            className="btn btn-success btn-sm"
                            onClick={() => handleUpdateStatus(walkIn._id, 'Completed')}
                          >
                            Complete
                          </button>
                        )}
                        {isStaff && ['Waiting', 'Slot Assigned', 'Checked In'].includes(walkIn.status) && (
                          <button 
                            className="btn btn-danger btn-sm"
                            onClick={() => handleUpdateStatus(walkIn._id, 'Left')}
                            title="Patient Left"
                          >
                            <AlertTriangle size={14} /> Left
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AddWalkInModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAdded={fetchWalkIns}
      />
    </div>
  );
}
