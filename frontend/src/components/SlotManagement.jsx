import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useDialog } from '../context/DialogContext';
import WorkingHoursEditor from './WorkingHoursEditor';
import { Clock, Plus, Trash2, CheckCircle2, User, RefreshCw, Sparkles, Filter, ChevronDown } from 'lucide-react';

export default function SlotManagement({ doctorId = null }) {
  const showDialog = useDialog();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [dateFilter, setDateFilter] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(doctorId || '');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedDoctors, setExpandedDoctors] = useState({});
  
  // Custom Generate Form State
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [showWorkingHours, setShowWorkingHours] = useState(false);
  const [loadError, setLoadError] = useState('');
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
    const timer = setInterval(fetchSlots, 10000);
    return () => clearInterval(timer);
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

  useEffect(() => {
    if (currentDate) setGenData(previous => ({ ...previous, date: currentDate }));
  }, [currentDate]);

  const fetchSlots = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const activeDoctor = doctorId || selectedDoctor || undefined;
      const res = await api.getSlots({
        date: dateFilter,
        doctor: activeDoctor,
        status: statusFilter || undefined
      });
      if (res.success && res.data) {
        setSlots(res.data);
        setCurrentDate(res.date);
      } else {
        setSlots([]);
      }
    } catch (err) {
      console.error('Failed to load slots:', err);
      setLoadError(err.message || 'Failed to load slots');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorSearch = (value) => {
    setDoctorSearch(value);
    if (!value) return setSelectedDoctor('');
    const match = doctors.find((doctor) => `Dr. ${doctor.firstName} ${doctor.lastName}`.toLowerCase() === value.toLowerCase());
    if (match) setSelectedDoctor(match._id);
  };

  const handleCustomGenerate = async (e) => {
    e.preventDefault();
    const targetDoc = doctorId || genData.doctor;
    if (!targetDoc) {
      await showDialog({ title: 'CareSync notice', message: "Please select a doctor" });
      return;
    }
    setGenerating(true);
    try {
      const res = await api.generateSlots({
        ...genData,
        doctor: targetDoc
      });
      await showDialog({ title: 'Slots generated', message: `Successfully generated ${res.count || (res.data && res.data.length) || 0} slots.` });
      setShowGenerateForm(false);
      fetchSlots();
    } catch (err) {
      await showDialog({ title: 'Action unsuccessful', danger: true, message: err.message || 'Failed to generate slots' });
    } finally {
      setGenerating(false);
    }
  };

  const handleAutoGenerateAll = async () => {
    const targetDoc = doctorId || selectedDoctor;
    if (!targetDoc && doctors.length === 0) {
      await showDialog({ title: 'CareSync notice', message: "No doctors available to generate slots." });
      return;
    }

    setGenerating(true);
    try {
      if (targetDoc) {
        await api.generateSlots({
          doctor: targetDoc,
          date: dateFilter || currentDate,
        });
      } else {
        // Generate for all doctors
        for (const doc of doctors) {
          await api.generateSlots({
            doctor: doc._id,
            date: dateFilter || currentDate,
          });
        }
      }
      fetchSlots();
    } catch (err) {
      await showDialog({ title: 'Action unsuccessful', danger: true, message: err.message || 'Failed to auto-generate slots' });
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    if (!await showDialog({ kind: 'confirm', title: status === 'Cancelled' ? 'Block slot' : 'Make slot available', message: `Change slot status to ${status}?`, confirmText: status === 'Cancelled' ? 'Block slot' : 'Make available', danger: status === 'Cancelled' })) return;
    try {
      await api.updateSlotStatus(id, status);
      fetchSlots();
    } catch (err) {
      await showDialog({ title: 'Action unsuccessful', danger: true, message: err.message || 'Failed to update slot status' });
    }
  };

  // Metrics summary
  const totalSlots = slots.length;
  const availableSlots = slots.filter(s => s.status === 'Available').length;
  const reservedSlots = slots.filter(s => s.status.startsWith('Reserved') || s.status === 'In Progress').length;
  const otherSlots = totalSlots - availableSlots - reservedSlots;
  const slotGroups = doctorId ? [{ id: doctorId, label: '', slots }] : Object.values(slots.reduce((groups, slot) => {
    const id = slot.doctor?._id || slot.doctor || 'unassigned';
    const label = slot.doctor?.firstName
      ? `Dr. ${slot.doctor.firstName} ${slot.doctor.lastName}`
      : 'Unassigned';
    groups[id] ||= { id, label, slots: [] };
    groups[id].slots.push(slot);
    return groups;
  }, {})).sort((a, b) => a.label.localeCompare(b.label));

  const renderSlotRow = (slot) => (
    <tr key={slot._id}>
      <td><strong>{slot.startTime} - {slot.endTime}</strong></td>
      <td>
        <span className={`badge badge-${slot.status.replace(/\s+/g, '-')}`}>
          <span className="status-dot"></span>
          {slot.status}
        </span>
      </td>
      <td>
        {slot.status === 'Available' ? (
          <span style={{ fontSize: '0.8rem', color: 'var(--success, #10b981)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle2 size={14} /> Open for Walk-ins &amp; Bookings
          </span>
        ) : (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{slot.status}</span>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
          {slot.status === 'Available' && (
            <button className="btn btn-danger btn-sm" onClick={() => handleUpdateStatus(slot._id, 'Cancelled')} title="Block / Cancel Slot">
              <Trash2 size={14} />
            </button>
          )}
          {slot.status === 'Cancelled' && (
            <button className="btn btn-success btn-sm" onClick={() => handleUpdateStatus(slot._id, 'Available')} title="Make Available for Walk-Ins">
              <CheckCircle2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  const toggleDoctor = (id) => setExpandedDoctors((current) => ({ ...current, [id]: !current[id] }));

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
              <input
                type="search"
                list="slot-doctor-options"
                className="form-input"
                style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                value={doctorSearch}
                onChange={(e) => handleDoctorSearch(e.target.value)}
                placeholder={`Search ${doctors.length} doctors`}
                aria-label="Search doctors"
              />
              <datalist id="slot-doctor-options">
                {doctors.map((doctor) => <option key={doctor._id} value={`Dr. ${doctor.firstName} ${doctor.lastName}`} />)}
              </datalist>
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
            value={dateFilter || currentDate}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setGenData(prev => ({ ...prev, date: e.target.value }));
            }}
          />

          <button type="button" className="btn btn-secondary" onClick={() => setDateFilter('')}>Today</button>

          <button onClick={fetchSlots} className="btn btn-secondary" title="Refresh">
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>

          <button 
            onClick={handleAutoGenerateAll} 
            className="btn btn-secondary" 
            title="Create slots using saved weekly working hours"
            disabled={generating}
          >
            <Sparkles size={16} color="var(--primary)" />
            <span>Auto-Fill Day</span>
          </button>

          <button onClick={() => setShowGenerateForm(!showGenerateForm)} className="btn btn-primary">
            <Plus size={16} />
            <span>Custom Generator</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setShowWorkingHours(!showWorkingHours)} aria-expanded={showWorkingHours}>Weekly hours</button>
        </div>
      </div>

      {loadError && <p className="alert alert-error" role="alert">{loadError}</p>}
      {showWorkingHours && <WorkingHoursEditor doctorId={doctorId} doctors={doctors} onSaved={fetchSlots} />}

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
              <th>Status</th>
              <th>Availability</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {slots.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  {loading ? 'Loading slots...' : 'No slots found for this date.'}
                </td>
              </tr>
            ) : (
              slotGroups.map((group) => (
                <React.Fragment key={group.id}>
                  {!doctorId && (
                    <tr className="slot-doctor-group">
                      <td colSpan={4}>
                        <button type="button" className="slot-doctor-toggle" onClick={() => toggleDoctor(group.id)} aria-expanded={!!expandedDoctors[group.id]}>
                          <span className="slot-doctor-name"><User size={16} /><strong>{group.label}</strong></span>
                          <span className="slot-doctor-count">{group.slots.length} slots <ChevronDown className={expandedDoctors[group.id] ? 'is-expanded' : ''} size={18} /></span>
                        </button>
                      </td>
                    </tr>
                  )}
                  {(doctorId || expandedDoctors[group.id]) && group.slots.map(renderSlotRow)}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
