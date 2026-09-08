import React, { useState } from 'react';
import { api } from '../services/api';
import { X, UserPlus, AlertCircle, CheckCircle2, ShieldCheck, Stethoscope, UserCog } from 'lucide-react';

export default function AddUserModal({ isOpen, onClose, onUserAdded }) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'Staff', // 'Staff' | 'Doctor'
    contactNumber: '',
    consultationDuration: 15,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await api.createUser(formData);
      if (res.success) {
        onUserAdded && onUserAdded();
        onClose();
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          role: 'Staff',
          contactNumber: '',
          consultationDuration: 15,
        });
      }
    } catch (err) {
      console.error('Failed to create user:', err);
      setError(err.message || 'Failed to create user account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '520px', width: '90%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={20} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Add Doctor or Staff Account</h3>
          </div>
          <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ background: 'var(--bg-muted, rgba(0,0,0,0.02))', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', border: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Create operational accounts for clinical doctors and front-desk clinic staff.
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  className="form-input"
                  placeholder="e.g. John"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div>
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  className="form-input"
                  placeholder="e.g. Smith"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Email Address</label>
              <input
                type="email"
                name="email"
                className="form-input"
                placeholder="doctor.smith@clinic.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                name="password"
                className="form-input"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label">Account Role</label>
                <select
                  name="role"
                  className="form-select"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="Staff">Staff (Clinic Reception)</option>
                  <option value="Doctor">Doctor (Attending Physician)</option>
                </select>
              </div>
              <div>
                <label className="form-label">Contact Number</label>
                <input
                  type="tel"
                  name="contactNumber"
                  className="form-input"
                  placeholder="09123456789"
                  value={formData.contactNumber}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Doctor Consultation Slot Duration */}
            {formData.role === 'Doctor' && (
              <div className="form-group" style={{ marginBottom: '1rem', background: 'rgba(59, 130, 246, 0.05)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <label className="form-label" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                  Default Consultation Duration (min)
                </label>
                <select
                  name="consultationDuration"
                  className="form-select"
                  value={formData.consultationDuration}
                  onChange={handleChange}
                >
                  <option value={15}>15 minutes (Standard)</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Used to automatically split doctor availability into independent time slots.
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid var(--border-color, #e5e7eb)' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <UserPlus size={16} />
              <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
