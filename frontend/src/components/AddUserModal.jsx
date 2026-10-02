import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { X, UserPlus, AlertCircle } from 'lucide-react';

export default function AddUserModal({ isOpen, onClose, onUserAdded, user = null }) {
  const dialog = useRef(null);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'Staff',
    contactNumber: user?.contactNumber || '',
    status: user?.status || 'Active',
    consultationDuration: 15,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (isOpen && !dialog.current?.open) dialog.current?.showModal();
  }, [isOpen]);

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

    if (!user && formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = user ? await api.updateUser(user._id, {
        firstName: formData.firstName, lastName: formData.lastName, email: formData.email,
        role: formData.role, contactNumber: formData.contactNumber, status: formData.status,
      }) : await api.createUser(formData);
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
    <dialog ref={dialog} className="care-dialog" aria-labelledby="account-form-title" onCancel={event => { if (loading) event.preventDefault(); else onClose(); }} style={{ padding: 0, border: 0, background: 'transparent', width: 'min(520px, 90vw)', maxHeight: '90vh' }}>
      <div className="modal-content" style={{ width: '100%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={20} color="var(--primary)" />
            <h3 id="account-form-title" style={{ margin: 0 }}>{user ? 'Edit account' : 'Add Doctor or Staff Account'}</h3>
          </div>
          <button onClick={onClose} disabled={loading} aria-label="Close account form" className="btn btn-secondary btn-sm" style={{ padding: '0.25rem' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            {error && (
              <div role="alert" className="alert alert-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div style={{ background: 'var(--bg-muted, rgba(0,0,0,0.02))', padding: '0.75rem 1rem', borderRadius: '6px', marginBottom: '1.25rem', border: '1px solid var(--border-color, #e5e7eb)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {user ? 'Update account details and access. Deactivation keeps the account and its records.' : 'Create operational accounts for clinical doctors and front-desk clinic staff.'}
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label" htmlFor="account-first-name">First Name</label>
                <input
                  id="account-first-name"
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
                <label className="form-label" htmlFor="account-last-name">Last Name</label>
                <input
                  id="account-last-name"
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
              <label className="form-label" htmlFor="account-email">Email Address</label>
              <input
                id="account-email"
                type="email"
                name="email"
                className="form-input"
                placeholder="doctor.smith@clinic.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            {!user && <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="account-password">Password</label>
              <input
                id="account-password"
                type="password"
                name="password"
                className="form-input"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>}

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label" htmlFor="account-role">Account Role</label>
                <select
                  id="account-role"
                  name="role"
                  className="form-select"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="Staff">Staff (Clinic Reception)</option>
                  <option value="Doctor">Doctor (Attending Physician)</option>
                  {user && <option value="Patient">Patient</option>}
                  {user && <option value="Admin">Admin</option>}
                </select>
              </div>
              <div>
                <label className="form-label" htmlFor="account-contact">Contact Number</label>
                <input
                  id="account-contact"
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
            {user && <div className="form-group">
              <label className="form-label" htmlFor="account-status">Account status</label>
              <select id="account-status" name="status" className="form-select" value={formData.status} onChange={handleChange}>
                <option value="Active">Active</option>
                <option value="Deactivated">Deactivated</option>
              </select>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Deactivated accounts cannot sign in or continue using existing sessions.</p>
            </div>}
            {!user && formData.role === 'Doctor' && (
              <div className="form-group" style={{ marginBottom: '1rem', background: 'rgba(59, 130, 246, 0.05)', padding: '0.75rem', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                <label className="form-label" htmlFor="account-duration" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                  Default Consultation Duration (min)
                </label>
                <select
                  id="account-duration"
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
            <button type="button" onClick={onClose} disabled={loading} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <UserPlus size={16} />
              <span>{loading ? 'Saving...' : user ? 'Save changes' : 'Create Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
