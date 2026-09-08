import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Clock, Plus, Trash2, CheckCircle2, User, RefreshCw, Sparkles, Filter } from 'lucide-react';

export default function SlotManagement({ doctorId = null }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDoctor, setSelectedDoctor] = useState(doctorId || '');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Custom Generate Form State
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [genData, setGenData] = useState({
    doctor: doctorId || '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    duration: 15
  });

  useEffect(() => {
    if (!doctorId) {
      fetchDoctors();
    }
  }, [doctorId]);

  useEffect(() => {
    fetchSlots();
  }, [dateFilter, selectedDoctor, statusFilter, doctorId]);

  const fetchDoctors = async () => {
    try {
      const res = await api.getDoctors();
      if (res.success && res.data) {
        setDoctors(res.data);
      }
    } catch (err) {
      console.error('Failed to load doctors:', err);
    }
  };

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const activeDoctor = doctorId || selectedDoctor || undefined;
      const res = await api.getSlots({
        date: dateFilter,
        doctor: activeDoctor,
        status: statusFilter || undefined
      });
      if (res.success && res.data) {
        setSlots(res.data);
      } else {
        setSlots([]);
      }
    } catch (err) {
      console.error('Failed to load slots:', err);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomGenerate = async (e) => {
    e.preventDefault();
    const targetDoc = doctorId || genData.doctor;
    if (!targetDoc) {
      alert("Please select a doctor");
      return;
    }
    setGenerating(true);
    try {
      const res = await api.generateSlots({
        ...genData,
        doctor: targetDoc
      });
      alert(`Successfully generated ${res.count || (res.data && res.data.length) || 0} slots.`);
      setShowGenerateForm(false);
      fetchSlots();
    } catch (err) {
      alert(err.message || 'Failed to generate slots');
    } finally {
      setGenerating(false);
    }
  };

  const handleAutoGenerateAll = async () => {
    const targetDoc = doctorId || selectedDoctor;
    if (!targetDoc && doctors.length === 0) {
      alert("No doctors available to generate slots.");
      return;
    }

    setGenerating(true);
    try {
      if (targetDoc) {
        await api.generateSlots({
          doctor: targetDoc,
          date: dateFilter,
          startTime: '09:00',
          endTime: '17:00',
          duration: 15
        });
      } else {
        // Generate for all doctors
        for (const doc of doctors) {
          await api.generateSlots({
            doctor: doc._id,
            date: dateFilter,
            startTime: '09:00',
            endTime: '17:00',
            duration: 15
          });
        }
      }
      fetchSlots();
    } catch (err) {
      alert(err.message || 'Failed to auto-generate slots');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    if (!window.confirm(`Change slot status to ${status}?`)) return;
    try {
      await api.updateSlotStatus(id, status);
      fetchSlots();
    } catch (err) {
      alert(err.message || 'Failed to update slot status');
    }
  };

  // Metrics summary
  const totalSlots = slots.length;
  const availableSlots = slots.filter(s => s.status === 'Available').length;
  const reservedSlots = slots.filter(s => s.status.startsWith('Reserved') || s.status === 'In Progress').length;
  const otherSlots = totalSlots - availableSlots - reservedSlots;

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={20} color="var(--primary)" />
          <h3 style={{ margin: 0 }}>Time Slot Management</h3>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Doctor Filter for Staff/Admin */}
          {!doctorId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <User size={16} color="var(--text-muted)" />
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                value={selectedDoctor}
                onChange={(e) => setSelectedDoctor(e.target.value)}
              >
                <option value="">All Doctors ({doctors.length})</option>
                {doctors.map(d => (
                  <option key={d._id} value={d._id}>Dr. {d.firstName} {d.lastName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-select"
              style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Available">Available (Walk-in / Booking)</option>
              <option value="Reserved-Confirmed">Reserved-Confirmed</option>
              <option value="Reserved-Tentative">Reserved-Tentative</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Date Picker */}
          <input 
            type="date" 
            className="form-input" 
            style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setGenData(prev => ({ ...prev, date: e.target.value }));
            }}
          />

          <button onClick={fetchSlots} className="btn btn-secondary" title="Refresh">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>

          <button 
            onClick={handleAutoGenerateAll} 
            className="btn btn-secondary" 
            title="Auto-create 9AM-5PM slots based on doctor availability"
            disabled={generating}
          >
            <Sparkles size={16} color="var(--primary)" />
            <span>Auto-Fill Day</span>
          </button>

          <button onClick={() => setShowGenerateForm(!showGenerateForm)} className="btn btn-primary">
            <Plus size={16} />
            <span>Custom Generator</span>
          </button>
        </div>
      </div>

      {/* Metric summary badges */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', 
        gap: '0.75rem', 
        padding: '1rem 1.5rem', 
        backgroundColor: 'var(--bg-card-alt, rgba(0,0,0,0.02))',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Slots</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{totalSlots}</div>
        </div>
        <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--success, #10b981)' }}>Available (Walk-in/Book)</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--success, #10b981)' }}>{availableSlots}</div>
        </div>
        <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--primary, #3b82f6)' }}>Booked / Active</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary, #3b82f6)' }}>{reservedSlots}</div>
        </div>
        <div style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'rgba(107, 114, 128, 0.08)', border: '1px solid rgba(107, 114, 128, 0.2)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Completed / Cancelled</div>
          <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-muted)' }}>{otherSlots}</div>
        </div>
      </div>

      {showGenerateForm && (
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={16} /> Custom Slot Generator
          </h4>
          <form onSubmit={handleCustomGenerate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            {!doctorId && (
              <div>
                <label className="form-label">Doctor</label>
                <select 
                  className="form-select" 
                  value={genData.doctor}
                  onChange={(e) => setGenData({...genData, doctor: e.target.value})}
                  required
                >
                  <option value="">Select Doctor</option>
                  {doctors.map(d => (
                    <option key={d._id} value={d._id}>Dr. {d.firstName} {d.lastName}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="form-label">Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={genData.date}
                onChange={(e) => setGenData({...genData, date: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="form-label">Start Time</label>
              <input 
                type="time" 
                className="form-input" 
                value={genData.startTime}
                onChange={(e) => setGenData({...genData, startTime: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="form-label">End Time</label>
              <input 
                type="time" 
                className="form-input" 
                value={genData.endTime}
                onChange={(e) => setGenData({...genData, endTime: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="form-label">Duration (min)</label>
              <select 
                className="form-select"
                value={genData.duration}
                onChange={(e) => setGenData({...genData, duration: Number(e.target.value)})}
              >
                <option value={15}>15 mins</option>
                <option value={30}>30 mins</option>
                <option value={45}>45 mins</option>
                <option value={60}>60 mins</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={generating}>
                {generating ? 'Generating...' : 'Generate Slots'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Time Window</th>
              {!doctorId && <th>Doctor</th>}
              <th>Status</th>
              <th>Availability</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {slots.length === 0 ? (
              <tr>
                <td colSpan={!doctorId ? 5 : 4} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading slots...' : 'No slots found for this date.'}
                </td>
              </tr>
            ) : (
              slots.map((slot) => (
                <tr key={slot._id}>
                  <td>
                    <strong>{slot.startTime} - {slot.endTime}</strong>
                  </td>
                  {!doctorId && (
                    <td>
                      {slot.doctor ? `Dr. ${slot.doctor.firstName} ${slot.doctor.lastName}` : 'Unassigned'}
                    </td>
                  )}
                  <td>
                    <span className={`badge badge-${slot.status.replace(/\s+/g, '-')}`}>
                      <span className="status-dot"></span>
                      {slot.status}
                    </span>
                  </td>
                  <td>
                    {slot.status === 'Available' ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--success, #10b981)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle2 size={14} /> Open for Walk-ins & Bookings
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {slot.status}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                     <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                       {slot.status === 'Available' && (
                         <button 
                           className="btn btn-danger btn-sm"
                           onClick={() => handleUpdateStatus(slot._id, 'Cancelled')}
                           title="Block / Cancel Slot"
                         >
                           <Trash2 size={14} />
                         </button>
                       )}
                       {slot.status === 'Cancelled' && (
                         <button 
                           className="btn btn-success btn-sm"
                           onClick={() => handleUpdateStatus(slot._id, 'Available')}
                           title="Make Available for Walk-Ins"
                         >
                           <CheckCircle2 size={14} />
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
  );
}
