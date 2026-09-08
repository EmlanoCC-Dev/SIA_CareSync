/**
 * CareSync API Client
 * ───────────────────
 * Centralized HTTP request helper with token management.
 */

const API_BASE = '/api';

export function getStoredToken() {
  return localStorage.getItem('caresync_token');
}

export function setStoredToken(token) {
  if (token) {
    localStorage.setItem('caresync_token', token);
  } else {
    localStorage.removeItem('caresync_token');
  }
}

async function request(endpoint, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data.message || data.error || `HTTP error ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // ── Auth ──
  login: (email, password) => request('/users/login', { method: 'POST', body: { email, password } }),
  register: (userData) => request('/users/register', { method: 'POST', body: userData }),
  getMe: () => request('/users/me'),
  getDoctors: () => request('/users/doctors'),
  getUsers: (role) => request(`/users${role ? `?role=${role}` : ''}`),

  // ── Appointments ──
  getAppointments: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.date) query.append('date', params.date);
    const queryString = query.toString();
    return request(`/appointments${queryString ? `?${queryString}` : ''}`);
  },
  getAppointmentById: (id) => request(`/appointments/${id}`),
  createAppointment: (appointmentData) => request('/appointments', { method: 'POST', body: appointmentData }),
  approveAppointment: (id) => request(`/appointments/${id}/approve`, { method: 'PATCH' }),
  declineAppointment: (id, reason) => request(`/appointments/${id}/decline`, { method: 'PATCH', body: { reason } }),
  checkInAppointment: (id) => request(`/appointments/${id}/check-in`, { method: 'PATCH' }),
  noShowAppointment: (id, reason) => request(`/appointments/${id}/no-show`, { method: 'PATCH', body: { reason } }),
  cancelAppointment: (id, reason) => request(`/appointments/${id}/cancel`, { method: 'PATCH', body: { reason } }),
  uploadDocuments: (id, data) => request(`/appointments/${id}/documents`, { method: 'PATCH', body: data }),
  completeAppointment: (id) => request(`/appointments/${id}/complete`, { method: 'PATCH' }),

  // ── Audit Logs ──
  getAuditLogs: () => request('/audit-logs'),

  // ── Slots ──
  generateSlots: (data) => request('/slots/generate', { method: 'POST', body: data }),
  getSlots: (params = {}) => {
    const query = new URLSearchParams();
    if (params.doctor) query.append('doctor', params.doctor);
    if (params.date) query.append('date', params.date);
    if (params.status) query.append('status', params.status);
    const queryString = query.toString();
    return request(`/slots${queryString ? `?${queryString}` : ''}`);
  },
  updateSlotStatus: (id, status) => request(`/slots/${id}/status`, { method: 'PATCH', body: { status } }),

  // ── Walk-ins ──
  createWalkIn: (data) => request('/walkins', { method: 'POST', body: data }),
  getWalkIns: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.date) query.append('date', params.date);
    const queryString = query.toString();
    return request(`/walkins${queryString ? `?${queryString}` : ''}`);
  },
  updateWalkInStatus: (id, status) => request(`/walkins/${id}/status`, { method: 'PATCH', body: { status } }),
  assignSlotToWalkIn: (walkInId, slotId) => request(`/walkins/${walkInId}/assign`, { method: 'POST', body: { slotId } }),
  getNowServing: () => request('/walkins/now-serving'),
};
