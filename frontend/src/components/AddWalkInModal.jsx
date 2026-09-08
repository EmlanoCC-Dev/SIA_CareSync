import React, { useState } from 'react';
import { api } from '../services/api';
import { X, UserPlus } from 'lucide-react';

export default function AddWalkInModal({ isOpen, onClose, onAdded }) {
  const [formData, setFormData] = useState({
    name: '',
    contactNumber: ''
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.createWalkIn(formData);
      onAdded();
      onClose();
      setFormData({ name: '', contactNumber: '' });
    } catch (err) {
      alert(err.message || 'Failed to add walk-in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h3>Add Walk-In Patient</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Patient Name</label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Full Name"
              />
            </div>
            
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label">Contact Number</label>
              <input
                type="text"
                className="form-input"
                required
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                placeholder="Phone number"
              />
            </div>
          </div>
          
          <div className="modal-footer" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <UserPlus size={16} />
              <span>{loading ? 'Adding...' : 'Add to Queue'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
