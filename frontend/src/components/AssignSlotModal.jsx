import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { X, Search, Clock, Calendar, User, CheckCircle2, AlertCircle, Sparkles, ChevronDown, Check } from 'lucide-react';

export default function AssignSlotModal({ isOpen, onClose, walkIn, onAssigned }) {
  const [doctors, setDoctors] = useState([]);
  const [doctorSearch, setDoctorSearch] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');

  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDoctorDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch doctors on modal open
  useEffect(() => {
    if (isOpen) {
      setError('');
      setDoctorSearch('');
      setSelectedSlotId('');
      setIsDoctorDropdownOpen(false);
      fetchDoctors();
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isDoctorDropdownOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isDoctorDropdownOpen]);

  // Fetch slots whenever selected doctor or date changes
  useEffect(() => {
    if (isOpen && selectedDoctorId) {
      fetchDoctorSlots(selectedDoctorId, date);
    } else {
      setSlots([]);
      setSelectedSlotId('');
    }
  }, [isOpen, selectedDoctorId, date]);

  const fetchDoctors = async () => {
    setLoadingDoctors(true);
    try {
      const res = await api.getDoctors();
      if (res.success && res.data) {
        setDoctors(res.data);
        if (res.data.length > 0 && !selectedDoctorId) {
          setSelectedDoctorId(res.data[0]._id);
        }
      }
    } catch (err) {
      console.error('Failed to load doctors:', err);
      setError('Failed to load doctors list');
    } finally {
      setLoadingDoctors(false);
    }
  };

  const fetchDoctorSlots = async (docId, selectedDate) => {
    setLoadingSlots(true);
    setError('');
    try {
      const res = await api.getSlots({
        doctor: docId,
        date: selectedDate,
        status: 'Available',
      });
      if (res.success && res.data) {
        setSlots(res.data);
        if (res.data.length > 0) {
          setSelectedSlotId(res.data[0]._id);
        } else {
          setSelectedSlotId('');
        }
      } else {
        setSlots([]);
        setSelectedSlotId('');
      }
    } catch (err) {
      console.error('Failed to load slots:', err);
      setError('Failed to load available slots for this doctor');
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleAutoGenerateSlots = async () => {
    if (!selectedDoctorId) return;
    setLoadingSlots(true);
    try {
      await api.generateSlots({
        doctor: selectedDoctorId,
        date,
        startTime: '09:00',
        endTime: '17:00',
        duration: 15,
      });
      await fetchDoctorSlots(selectedDoctorId, date);
    } catch (err) {
      setError(err.message || 'Failed to auto-generate slots');
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!walkIn || !walkIn._id) {
      setError('No walk-in patient selected');
      return;
    }
    if (!selectedSlotId) {
      setError('Please select an available time slot');
      return;
    }

    setAssigning(true);
    setError('');

    try {
      await api.assignSlotToWalkIn(walkIn._id, selectedSlotId);
      onAssigned && onAssigned();
      onClose();
    } catch (err) {
      console.error('Failed to assign slot:', err);
      setError(err.message || 'Failed to assign slot to patient');
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen || !walkIn) return null;

  // Filter doctors by search term
  const filteredDoctors = doctors.filter((doc) => {
    const q = doctorSearch.toLowerCase().trim();
    if (!q) return true;
    const fullName = `${doc.firstName} ${doc.lastName}`.toLowerCase();
    const email = (doc.email || '').toLowerCase();
    return fullName.includes(q) || email.includes(q);
  });

  const selectedDoctor = doctors.find((d) => d._id === selectedDoctorId);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '600px', width: '92%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={20} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Assign Slot to Walk-In Patient</h3>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleAssign}>
          <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Patient Info Banner */}
            <div
              style={{
                background: 'var(--bg-muted, rgba(0,0,0,0.03))',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md, 8px)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                border: '1px solid var(--border-color, #e5e7eb)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Walk-In Patient</div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>{walkIn.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{walkIn.contactNumber}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Queue Number</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary)' }}>
                  #{walkIn.queueNumber}
                </div>
              </div>
            </div>

            {/* Searchable Doctor Dropdown */}
            <div className="form-group" style={{ marginBottom: '1.25rem', position: 'relative' }} ref={dropdownRef}>
              <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
                <User size={15} color="var(--primary)" />
                <span>Attending Doctor</span>
              </label>

              {/* Dropdown Trigger */}
              <div
                onClick={() => setIsDoctorDropdownOpen(!isDoctorDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.6rem 0.85rem',
                  border: isDoctorDropdownOpen ? '1px solid var(--primary)' : '1px solid var(--border-color, #e5e7eb)',
                  borderRadius: '6px',
                  background: 'var(--bg-surface, #fff)',
                  cursor: 'pointer',
                  boxShadow: isDoctorDropdownOpen ? '0 0 0 2px rgba(59, 130, 246, 0.15)' : 'none',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {selectedDoctor ? (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      Dr. {selectedDoctor.firstName} {selectedDoctor.lastName}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {selectedDoctor.email || 'Physician'}
                    </div>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Select Doctor...</span>
                )}
                <ChevronDown
                  size={16}
                  color="var(--text-muted)"
                  style={{
                    transform: isDoctorDropdownOpen ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </div>

              {/* Floating Dropdown Popover */}
              {isDoctorDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'var(--bg-surface, #fff)',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    zIndex: 50,
                    padding: '0.5rem',
                  }}
                >
                  {/* Search Box inside dropdown */}
                  <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                    <Search
                      size={14}
                      color="var(--text-muted)"
                      style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      ref={searchInputRef}
                      type="text"
                      className="form-input"
                      style={{ paddingLeft: '2rem', paddingRight: '0.6rem', fontSize: '0.825rem' }}
                      placeholder="Type doctor name or email..."
                      value={doctorSearch}
                      onChange={(e) => setDoctorSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Doctor Option List */}
                  <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                    {loadingDoctors ? (
                      <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        Loading doctors...
                      </div>
                    ) : filteredDoctors.length === 0 ? (
                      <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        No doctor found matching "{doctorSearch}"
                      </div>
                    ) : (
                      filteredDoctors.map((doc) => {
                        const isSelected = doc._id === selectedDoctorId;
                        return (
                          <div
                            key={doc._id}
                            onClick={() => {
                              setSelectedDoctorId(doc._id);
                              setIsDoctorDropdownOpen(false);
                            }}
                            style={{
                              padding: '0.5rem 0.65rem',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                              marginBottom: '2px',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'var(--bg-muted, #f3f4f6)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div>
                              <div style={{ fontWeight: isSelected ? 600 : 500, fontSize: '0.85rem', color: isSelected ? 'var(--primary)' : 'inherit' }}>
                                Dr. {doc.firstName} {doc.lastName}
                              </div>
                              <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                                {doc.email || 'Physician'}
                              </div>
                            </div>
                            {isSelected && <Check size={16} color="var(--primary)" />}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Date Selection */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
                <Calendar size={15} color="var(--primary)" />
                <span>Date</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>

            {/* Available Time Slots Field */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Clock size={15} color="var(--primary)" />
                  <span>Available Time Slot ({slots.length} available)</span>
                </label>
                {selectedDoctor && slots.length === 0 && !loadingSlots && (
                  <button
                    type="button"
                    onClick={handleAutoGenerateSlots}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Sparkles size={12} color="var(--primary)" />
                    <span>Auto-Fill Today's Slots</span>
                  </button>
                )}
              </div>

              {loadingSlots ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Checking doctor's available slots...
                </div>
              ) : slots.length === 0 ? (
                <div
                  style={{
                    padding: '1.25rem',
                    textAlign: 'center',
                    background: 'var(--bg-muted, rgba(0,0,0,0.02))',
                    border: '1px dashed var(--border-color, #e5e7eb)',
                    borderRadius: '6px',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                  }}
                >
                  <p style={{ margin: '0 0 0.5rem 0' }}>No available slots found for Dr. {selectedDoctor?.lastName || 'selected doctor'} on this date.</p>
                  <button
                    type="button"
                    onClick={handleAutoGenerateSlots}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.8rem' }}
                  >
                    <Sparkles size={13} color="var(--primary)" />
                    <span>Generate 9:00 AM - 5:00 PM Slots</span>
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: '0.5rem',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    padding: '0.5rem',
                    border: '1px solid var(--border-color, #e5e7eb)',
                    borderRadius: '6px',
                    background: 'var(--bg-surface, #fff)',
                  }}
                >
                  {slots.map((slot) => {
                    const isSelected = slot._id === selectedSlotId;
                    return (
                      <button
                        key={slot._id}
                        type="button"
                        onClick={() => setSelectedSlotId(slot._id)}
                        className={`slot-chip ${isSelected ? 'selected' : ''}`}
                        style={{
                          padding: '0.5rem 0.6rem',
                          borderRadius: '6px',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color, #e5e7eb)',
                          background: isSelected ? 'var(--primary)' : 'var(--bg-main, #f9fafb)',
                          color: isSelected ? '#fff' : 'inherit',
                          fontSize: '0.8rem',
                          fontWeight: isSelected ? 600 : 500,
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {slot.startTime} - {slot.endTime}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            className="modal-footer"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color, #e5e7eb)',
            }}
          >
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedSlotId || assigning}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <CheckCircle2 size={16} />
              <span>{assigning ? 'Assigning...' : 'Assign Slot'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
