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
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  if (config.body && typeof config.body === 'object' && !isFormData) {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  if (response.ok && options.responseType === 'blob') return response.blob();
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
  requestRegistrationOtp: (email) => request('/users/register/otp', { method: 'POST', body: { email } }),
  requestPasswordOtp: (email) => request('/users/password/otp', { method: 'POST', body: { email } }),
  resetPassword: (data) => request('/users/password/reset', { method: 'POST', body: data }),
  getMe: () => request('/users/me'),
  getDoctors: () => request('/users/doctors'),
  getUsers: (role) => request(`/users${role ? `?role=${role}` : ''}`),
  createUser: (userData) => request('/users', { method: 'POST', body: userData }),
  updateUser: (id, userData) => request(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: userData }),
  getDoctorSchedule: (id) => request(`/users/${id}/schedule`),
  updateDoctorSchedule: (id, data) => request(`/users/${id}/schedule`, { method: 'PATCH', body: data }),
  getReports: (params) => request(`/reports?${new URLSearchParams(params)}`),
  getNotifications: (params = {}) => request(`/notifications?${new URLSearchParams(params)}`),
  readNotification: (id) => request(`/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }),
  readAllNotifications: () => request('/notifications/read-all', { method: 'PATCH' }),

  // ── Appointments ──
  getAppointments: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.date) query.append('date', params.date);
    const queryString = query.toString();
    return request(`/appointments${queryString ? `?${queryString}` : ''}`);
  },
  getAppointmentById: (id) => request(`/appointments/${id}`),
  getAppointmentVersions: (id) => request(`/appointments/${encodeURIComponent(id)}/versions`),
  getAppointmentComments: (id) => request(`/appointments/${encodeURIComponent(id)}/comments`),
  addAppointmentComment: (id, message) => request(`/appointments/${encodeURIComponent(id)}/comments`, { method: 'POST', body: { message } }),
  createAppointment: (appointmentData) => request('/appointments', { method: 'POST', body: appointmentData }),
  approveAppointment: (id) => request(`/appointments/${id}/approve`, { method: 'PATCH' }),
  requestAppointmentCorrection: (id, explanation, bookingRevision) => request(`/appointments/${id}/request-correction`, { method: 'PATCH', body: { explanation, bookingRevision } }),
  resubmitAppointment: (id, reason, bookingRevision) => request(`/appointments/${id}/resubmit`, { method: 'PATCH', body: { reason, bookingRevision } }),
  assignAppointmentSlot: (id, slotId) => request(`/appointments/${id}/assign`, { method: 'PATCH', body: { slotId } }),
  declineAppointment: (id, reason) => request(`/appointments/${id}/decline`, { method: 'PATCH', body: { reason } }),
  checkInAppointment: (id) => request(`/appointments/${id}/check-in`, { method: 'PATCH' }),
  startConsultation: (id) => request(`/appointments/${id}/start`, { method: 'PATCH' }),
  noShowAppointment: (id, reason) => request(`/appointments/${id}/no-show`, { method: 'PATCH', body: { reason } }),
  cancelAppointment: (id, reason) => request(`/appointments/${id}/cancel`, { method: 'PATCH', body: { reason } }),
  uploadDocuments: (id, data) => request(`/appointments/${id}/documents`, { method: 'PATCH', body: data }),
  uploadAppointmentFile: (id, formData) => request(`/appointments/${id}/upload`, { method: 'POST', body: formData }),
  replaceAppointmentDocument: (id, docId, formData) => request(`/appointments/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}/replace`, { method: 'POST', body: formData }),
  deleteAppointmentDocument: (id, docId, version) => request(`/appointments/${id}/documents/${docId}`, { method: 'DELETE', body: { version } }),
  downloadAppointmentDocument: async (id, doc, version) => {
    const history = version === undefined ? '' : `/versions/${encodeURIComponent(version)}`;
    const blob = await request(`/appointments/${encodeURIComponent(id)}/documents/${encodeURIComponent(doc._id)}${history}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.filename || 'Medical document';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  completeAppointment: (id) => request(`/appointments/${id}/complete`, { method: 'PATCH' }),

  // ── Audit Logs ──
  getAuditLogs: () => request('/audit-logs'),

  // ── Slots ──
  generateSlots: (data) => request('/slots/generate', { method: 'POST', body: data }),
  getSlots: (params = {}) => {
    const query = new URLSearchParams();
    const docId = params.doctor || params.doctorId;
    if (docId) query.append('doctorId', docId);
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

  // ── System Time & Settings ──
  getSystemTime: () => request('/system/time'),
  setSystemTime: (data) => request('/system/time', { method: 'POST', body: data }),
};
