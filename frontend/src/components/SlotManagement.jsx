import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Calendar, Clock, Plus, Trash2, CheckCircle2, User, RefreshCw } from 'lucide-react';

export default function SlotManagement({ doctorId = null }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  
  // Generate Form State
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
    fetchSlots();
    if (!doctorId && doctors.length === 0) {
      fetchDoctors();
    }
  }, [dateFilter, doctorId]);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await api.getSlots({ date: dateFilter, doctor: doctorId });
      if (res.success && res.data) {
        setSlots(res.data);
      } else {
        setSlots([]);
      }
    } catch (err) {
      console.error('Failed to load slots:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await api.getUsers('Doctor');
      if (res.success && res.data) {
        setDoctors(res.data);
      }
    } catch (err) {
      console.error('Failed to load doctors:', err);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!genData.doctor) {
      alert("Please select a doctor");
      return;
    }
    setGenerating(true);
    try {
      const res = await api.generateSlots(genData);
      alert(`Successfully generated ${res.data.count} slots.`);
      setShowGenerateForm(false);
      fetchSlots();
    } catch (err) {
      alert(err.message || 'Failed to generate slots');
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

  return (
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={20} color="var(--primary)" />
          <h3>Time Slot Management</h3>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <input 
            type="date" 
            className="form-input" 
            style={{ width: 'auto', padding: '0.35rem 0.75rem' }}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <button onClick={fetchSlots} className="btn btn-secondary" title="Refresh">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          <button onClick={() => setShowGenerateForm(!showGenerateForm)} className="btn btn-primary">
            <Plus size={16} />
            <span>Generate Slots</span>
          </button>
        </div>
      </div>

      {showGenerateForm && (
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}>
          <h4 style={{ marginBottom: '1rem' }}>Generate New Time Slots</h4>
          <form onSubmit={handleGenerate} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
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
                {generating ? 'Generating...' : 'Generate'}
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
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {slots.length === 0 ? (
              <tr>
                <td colSpan={doctorId ? 3 : 4} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
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
                      {slot.doctor ? `Dr. ${slot.doctor.firstName} ${slot.doctor.lastName}` : 'N/A'}
                    </td>
                  )}
                  <td>
                    <span className={`badge badge-${slot.status.replace(/\s+/g, '-')}`}>
                      <span className="status-dot"></span>
                      {slot.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                     <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                       {slot.status === 'Available' && (
                         <button 
                           className="btn btn-danger btn-sm"
                           onClick={() => handleUpdateStatus(slot._id, 'Cancelled')}
                           title="Cancel Slot"
                         >
                           <Trash2 size={14} />
                         </button>
                       )}
                       {slot.status === 'Cancelled' && (
                         <button 
                           className="btn btn-success btn-sm"
                           onClick={() => handleUpdateStatus(slot._id, 'Available')}
                           title="Make Available"
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
