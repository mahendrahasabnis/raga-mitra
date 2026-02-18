import axios from 'axios';
// import type { AuthResponse, Raga, Artist, Track, ApiResponse } from '../types/index.js';

// Support separate base URLs for core health APIs and user/identity APIs (99platforms)
const getApiBaseUrl = () => {
  // Health/data backend (Aarogya Mitra)
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  // In dev, use relative /api so Vite proxies to the backend (avoids ERR_CONNECTION_REFUSED when browser can't reach localhost:5001)
  if (import.meta.env.DEV && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '192.168.1.14')) {
    return '/api';
  }
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '192.168.1.14') {
    return 'http://localhost:5001/api';
  }
  if (window.location.hostname === '34.117.220.98' || window.location.hostname.includes('34.117.220.98')) {
    return 'http://34.117.220.98/api';
  }
  // Default: aarogya-mitra project backend (same hash as frontend when deployed together)
  return 'https://aarogya-mitra-backend-integrated-nwwg5e5xbq-el.a.run.app/api';
};

const getUserApiBaseUrl = () => {
  // Prefer local backend while running locally to avoid hitting remote auth endpoints
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return API_BASE_URL;
  }
  // 99platforms user/identity backend
  if (import.meta.env.VITE_USER_API_BASE_URL) return import.meta.env.VITE_USER_API_BASE_URL;
  // Default to Aarogya backend (which proxies to 99platforms to avoid CORS/auth issues)
  return API_BASE_URL;
};

const API_BASE_URL = getApiBaseUrl();
const USER_API_BASE_URL = getUserApiBaseUrl();

// Log which backend is being used
console.log('🔗 [API] Using backend URL:', API_BASE_URL);
console.log('🔗 [API] Current hostname:', window.location.hostname);
console.log('🔗 [API] Using user backend URL:', USER_API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const userApiClient = axios.create({
  baseURL: USER_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
const attachAuth = (config: any) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

api.interceptors.request.use(attachAuth);
userApiClient.interceptors.request.use(attachAuth);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if this is a test token or test mode - don't logout on 401 for test users
      const token = localStorage.getItem('token');
      const isTestMode = localStorage.getItem('test-mode') === 'true';
      
      if (token && (token.startsWith('test-token-') || isTestMode)) {
        // Test mode - don't clear auth, just reject the error silently
        console.log('🧪 [API] Test mode detected, skipping logout on 401. Error:', error.response?.data?.message || error.message);
        return Promise.reject(error);
      }
      // For non-auth feature routes, avoid hard logout to prevent UX loop while backend warms up
      const url: string = error.config?.url || '';
      const nonAuthPaths = ['/health', '/resources', '/hcp', '/appointments'];
      if (nonAuthPaths.some((p) => url.includes(p))) {
        console.warn('⚠️ [API] 401 on non-auth route, preserving session. Path:', url, 'Message:', error.response?.data?.message);
        return Promise.reject(error);
      }
      // Real token - handle 401 normally
      console.log('🔒 [API] 401 Unauthorized - clearing auth and reloading');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('test-mode');
      localStorage.removeItem('test-role');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  sendOTP: async (phone: string) => {
    const response = await api.post('/auth/send-otp', { phone });
    return response.data;
  },

  verifyOTP: async (phone: string, otp: string) => {
    const response = await api.post('/auth/verify-otp', { phone, otp });
    return response.data;
  },

  checkPhoneExists: async (phone: string) => {
    const response = await api.post('/auth/check-phone', { phone });
    return response.data;
  },

  signup: async (phone: string, pin: string, otp: string, name?: string) => {
    const response = await api.post('/auth/signup', { phone, pin, otp, name });
    return response.data;
  },

  login: async (phone: string, pin: string) => {
    const response = await api.post('/auth/login', { phone, pin });
    return response.data;
  },

  resetPin: async (phone: string, otp: string, newPin: string) => {
    const response = await api.post('/auth/reset-pin', { phone, otp, newPin });
    return response.data;
  },
};

// Health module
export const healthApi = {
  // Appointments
  getAppointments: async (clientId?: string) => {
    const params = clientId ? { client_id: clientId } : {};
    const response = await api.get('/health/appointments', { params });
    return response.data;
  },
  getAppointment: async (id: string) => {
    const response = await api.get(`/health/appointments/${id}`);
    return response.data;
  },
  getAppointmentDetails: async (id: string, clientId?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    const response = await api.get(`/health/appointments/${id}/details`, { params });
    return response.data;
  },
  createAppointment: async (payload: any) => {
    const response = await api.post('/health/appointments', payload);
    return response.data;
  },
  updateAppointment: async (id: string, payload: any) => {
    const response = await api.put(`/health/appointments/${id}`, payload);
    return response.data;
  },
  updateAppointmentDetails: async (id: string, payload: any) => {
    const response = await api.put(`/health/appointments/${id}/details`, payload);
    return response.data;
  },
  addAppointmentAttachment: async (appointmentId: string, payload: any) => {
    const response = await api.post(`/health/appointments/${appointmentId}/attachments`, payload);
    return response.data;
  },
  getSignedUploadUrl: async (payload: any) => {
    const response = await api.post('/health/uploads/signed-url', payload);
    return response.data;
  },
  uploadAppointmentFile: async (appointmentId: string, payload: any) => {
    const response = await api.post(`/health/appointments/${appointmentId}/files`, payload);
    return response.data;
  },
  getAppointmentFile: async (fileId: string, clientId?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    const response = await api.get(`/health/appointments/files/${fileId}`, { params, responseType: 'blob' });
    return response.data;
  },
  summarizeAppointmentAudio: async (appointmentId: string, payload: any) => {
    const response = await api.post(`/health/appointments/${appointmentId}/audio/summary`, payload);
    return response.data;
  },

  // Medicines
  getMedicines: async (clientId?: string, activeOnly?: boolean) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    if (activeOnly) params.active_only = 'true';
    const response = await api.get('/health/medicines', { params });
    return response.data;
  },
  addMedicine: async (payload: any) => {
    const response = await api.post('/health/medicines', payload);
    return response.data;
  },
  updateMedicine: async (id: string, payload: any) => {
    const response = await api.put(`/health/medicines/${id}`, payload);
    return response.data;
  },
  deleteMedicine: async (id: string) => {
    const response = await api.delete(`/health/medicines/${id}`);
    return response.data;
  },

  // Diagnostics
  getDiagnostics: async (clientId?: string) => {
    const params = clientId ? { client_id: clientId } : {};
    const response = await api.get('/health/diagnostics', { params });
    return response.data;
  },
  addDiagnostic: async (payload: any) => {
    const response = await api.post('/health/diagnostics', payload);
    return response.data;
  },
  uploadReport: async (payload: any) => {
    const response = await api.post('/health/reports/upload', payload);
    return response.data;
  },
  listReports: async (clientId?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    const response = await api.get('/health/reports', { params });
    return response.data;
  },
  getReport: async (reportId: string, clientId?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    const response = await api.get(`/health/reports/${reportId}`, { params });
    return response.data;
  },
  getReportFileUrl: async (reportId: string, clientId?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    const response = await api.get(`/health/reports/${reportId}/file`, {
      params,
      responseType: 'blob',
    });
    const blob = response.data;
    const contentType = blob.type || 'application/pdf';
    const url = URL.createObjectURL(new Blob([blob], { type: contentType }));
    return url;
  },
  extractReport: async (reportId: string) => {
    const response = await api.post(`/health/reports/${reportId}/extract`);
    return response.data;
  },
  extractPrescriptionData: async (payload: any) => {
    const response = await api.post('/past-visits/extract-prescription', payload);
    return response.data;
  },
  extractReceiptData: async (payload: any) => {
    const response = await api.post('/past-visits/extract-receipt', payload);
    return response.data;
  },
  extractDocumentData: async (payload: any) => {
    const response = await api.post('/past-visits/extract-document', payload);
    return response.data;
  },
  confirmVitals: async (vitals: any[]) => {
    const response = await api.post('/health/vitals/confirm', { vitals });
    return response.data;
  },

  // Vitals
  getVitals: async (clientId?: string, filters?: { parameter?: string; start_date?: string; end_date?: string }) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    if (filters?.parameter) params.parameter = filters.parameter;
    if (filters?.start_date) params.start_date = filters.start_date;
    if (filters?.end_date) params.end_date = filters.end_date;
    const response = await api.get('/health/vitals', { params });
    return response.data;
  },
  getVitalsGraph: async (parameter: string, clientId?: string, startDate?: string, endDate?: string) => {
    const params: any = { parameter };
    if (clientId) params.client_id = clientId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/health/vitals/graph', { params });
    return response.data;
  },
  getVitalsTrends: async (parameter: string, clientId?: string) => {
    const params: any = { parameter };
    if (clientId) params.client_id = clientId;
    const response = await api.get('/health/vitals/trends', { params });
    return response.data;
  },
  addVital: async (payload: any) => {
    const response = await api.post('/health/vitals', payload);
    return response.data;
  },

  // Live Monitoring (Institution Admissions)
  getAdmissions: async (clientId?: string) => {
    const params = clientId ? { client_id: clientId } : {};
    const response = await api.get('/health/admissions', { params });
    return response.data;
  },
  getAdmission: async (id: string, clientId?: string) => {
    const params = clientId ? { client_id: clientId } : {};
    const response = await api.get(`/health/admissions/${id}`, { params });
    return response.data;
  },
  createAdmission: async (payload: any) => {
    const response = await api.post('/health/admissions', payload);
    return response.data;
  },
  updateAdmission: async (id: string, payload: any) => {
    const response = await api.put(`/health/admissions/${id}`, payload);
    return response.data;
  },
  deleteAdmission: async (id: string, clientId?: string) => {
    const params = clientId ? { client_id: clientId } : {};
    const response = await api.delete(`/health/admissions/${id}`, { params });
    return response.data;
  },
  getMonitoringReadings: async (admissionId: string, clientId?: string, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get(`/health/admissions/${admissionId}/readings`, { params });
    return response.data;
  },
  addMonitoringReadings: async (admissionId: string, readings: any[], clientId?: string) => {
    const response = await api.post(`/health/admissions/${admissionId}/readings`, { readings, client_id: clientId });
    return response.data;
  },
  getMonitoringTemplate: async (admissionId: string, clientId?: string) => {
    const params = clientId ? { client_id: clientId } : {};
    const response = await api.get(`/health/admissions/${admissionId}/readings/template`, {
      params,
      responseType: 'blob',
    });
    return response.data as Blob;
  },
  previewMonitoringImport: async (admissionId: string, file: File, signal?: AbortSignal) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/health/admissions/${admissionId}/readings/preview`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
    });
    return response.data;
  },
  importMonitoringReadings: async (admissionId: string, file: File, clientId?: string, signal?: AbortSignal) => {
    const formData = new FormData();
    formData.append('file', file);
    if (clientId) formData.append('client_id', clientId);
    const response = await api.post(`/health/admissions/${admissionId}/readings/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      signal,
    });
    return response.data;
  },
  getAdmissionTreatments: async (admissionId: string, clientId?: string, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get(`/health/admissions/${admissionId}/treatments`, { params });
    return response.data;
  },
  addAdmissionTreatment: async (admissionId: string, payload: { recorded_at: string; treatment_name: string; quantity?: string; notes?: string; doctor_name?: string }, clientId?: string) => {
    const response = await api.post(`/health/admissions/${admissionId}/treatments`, { ...payload, client_id: clientId });
    return response.data;
  },
};

// Fitness module
export const fitnessApi = {
  // Exercise Templates (Library)
  getExerciseTemplates: async (category?: string, libraryType?: 'own' | 'trainer', clientId?: string) => {
    const params: any = {};
    if (category) params.category = category;
    if (libraryType) params.library_type = libraryType;
    if (clientId) params.client_id = clientId;
    const response = await api.get('/fitness/exercise-templates', { params });
    return response.data;
  },
  getExerciseTemplate: async (id: string) => {
    const response = await api.get(`/fitness/exercise-templates/${id}`);
    return response.data;
  },
  createExerciseTemplate: async (payload: any) => {
    const response = await api.post('/fitness/exercise-templates', payload);
    return response.data;
  },
  updateExerciseTemplate: async (id: string, payload: any) => {
    const response = await api.put(`/fitness/exercise-templates/${id}`, payload);
    return response.data;
  },
  exportExerciseTemplates: async () => {
    const response = await api.get('/fitness/exercise-templates/export', {
      responseType: 'blob' // Important: get binary data for Excel file
    });
    // Return blob directly for Excel file download
    return response.data;
  },
  importExerciseTemplates: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/fitness/exercise-templates/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Weekly Templates
  getWeekTemplates: async (clientId?: string) => {
    const params = clientId ? { client_id: clientId } : {};
    const response = await api.get('/fitness/week-templates', { params });
    return response.data;
  },
  getWeekTemplate: async (id: string) => {
    const response = await api.get(`/fitness/week-templates/${id}`);
    return response.data;
  },
  createWeekTemplate: async (payload: any) => {
    const response = await api.post('/fitness/week-templates', payload);
    return response.data;
  },
  updateWeekTemplate: async (id: string, payload: any) => {
    const response = await api.put(`/fitness/week-templates/${id}`, payload);
    return response.data;
  },

  // Calendar Entries
  getCalendarEntries: async (clientId?: string, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/fitness/calendar', { params });
    return response.data;
  },
  getCalendarEntry: async (date: string, clientId?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    const response = await api.get(`/fitness/calendar/${date}`, { params });
    return response.data;
  },
  createCalendarEntry: async (payload: any) => {
    const response = await api.post('/fitness/calendar', payload);
    return response.data;
  },
  applyWeekTemplate: async (
    startDate: string,
    endDate: string,
    weekTemplateId: string,
    clientId?: string
  ) => {
    const response = await api.post('/fitness/calendar/apply-week', {
      start_date: startDate,
      end_date: endDate,
      week_template_id: weekTemplateId,
      client_id: clientId,
    });
    return response.data;
  },
  removeWeekTemplate: async (
    startDate: string,
    endDate: string,
    weekTemplateId: string,
    clientId?: string
  ) => {
    const response = await api.post('/fitness/calendar/remove-week', {
      start_date: startDate,
      end_date: endDate,
      week_template_id: weekTemplateId,
      client_id: clientId,
    });
    return response.data;
  },

  // Tracking
  getTracking: async (clientId?: string, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/fitness/tracking', { params });
    return response.data;
  },
  createTracking: async (payload: any) => {
    const response = await api.post('/fitness/tracking', payload);
    return response.data;
  },
  updateTracking: async (id: string, payload: any) => {
    const response = await api.put(`/fitness/tracking/${id}`, payload);
    return response.data;
  },

  // Progress & Streak
  getProgress: async (clientId?: string, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/fitness/progress', { params });
    return response.data;
  },
};

// Diet module
export const dietApi = {
  // Meal Templates (Library)
  getMealTemplates: async (category?: string, libraryType?: string, clientId?: string) => {
    const params: any = {};
    if (category) params.category = category;
    if (libraryType) params.library_type = libraryType;
    if (clientId) params.client_id = clientId;
    const response = await api.get('/diet/meal-templates', { params });
    return response.data;
  },
  getMealTemplate: async (id: string) => {
    const response = await api.get(`/diet/meal-templates/${id}`);
    return response.data;
  },
  createMealTemplate: async (payload: any) => {
    const response = await api.post('/diet/meal-templates', payload);
    return response.data;
  },
  updateMealTemplate: async (id: string, payload: any) => {
    const response = await api.put(`/diet/meal-templates/${id}`, payload);
    return response.data;
  },
  exportMealTemplates: async () => {
    const response = await api.get('/diet/meal-templates/export', { responseType: 'blob' });
    return response.data;
  },
  importMealTemplates: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/diet/meal-templates/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Weekly Templates
  getWeekTemplates: async (clientId?: string) => {
    const params = clientId ? { client_id: clientId } : {};
    const response = await api.get('/diet/week-templates', { params });
    return response.data;
  },
  getWeekTemplate: async (id: string) => {
    const response = await api.get(`/diet/week-templates/${id}`);
    return response.data;
  },
  createWeekTemplate: async (payload: any) => {
    const response = await api.post('/diet/week-templates', payload);
    return response.data;
  },
  updateWeekTemplate: async (id: string, payload: any) => {
    const response = await api.put(`/diet/week-templates/${id}`, payload);
    return response.data;
  },

  // Calendar Entries
  getCalendarEntries: async (clientId?: string, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/diet/calendar', { params });
    return response.data;
  },
  getCalendarEntry: async (date: string, clientId?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    const response = await api.get(`/diet/calendar/${date}`, { params });
    return response.data;
  },
  createCalendarEntry: async (payload: any) => {
    const response = await api.post('/diet/calendar', payload);
    return response.data;
  },
  applyWeekTemplate: async (
    startDate: string,
    endDate: string,
    weekTemplateId: string,
    clientId?: string
  ) => {
    const response = await api.post('/diet/calendar/apply-week', {
      start_date: startDate,
      end_date: endDate,
      week_template_id: weekTemplateId,
      client_id: clientId,
    });
    return response.data;
  },
  removeWeekTemplate: async (
    startDate: string,
    endDate: string,
    weekTemplateId: string,
    clientId?: string
  ) => {
    const response = await api.post('/diet/calendar/remove-week', {
      start_date: startDate,
      end_date: endDate,
      week_template_id: weekTemplateId,
      client_id: clientId,
    });
    return response.data;
  },

  // Tracking
  getTracking: async (clientId?: string, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/diet/tracking', { params });
    return response.data;
  },
  createTracking: async (payload: any) => {
    const response = await api.post('/diet/tracking', payload);
    return response.data;
  },
  updateTracking: async (id: string, payload: any) => {
    const response = await api.put(`/diet/tracking/${id}`, payload);
    return response.data;
  },

  // Ad-hoc Entries
  getAdHocEntries: async (clientId?: string, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/diet/ad-hoc', { params });
    return response.data;
  },
  createAdHocEntry: async (payload: any) => {
    const response = await api.post('/diet/ad-hoc', payload);
    return response.data;
  },
  updateAdHocEntry: async (id: string, payload: any) => {
    const response = await api.put(`/diet/ad-hoc/${id}`, payload);
    return response.data;
  },
  deleteAdHocEntry: async (id: string) => {
    const response = await api.delete(`/diet/ad-hoc/${id}`);
    return response.data;
  },

  // Progress & Stats
  getProgress: async (clientId?: string, startDate?: string, endDate?: string) => {
    const params: any = {};
    if (clientId) params.client_id = clientId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/diet/progress', { params });
    return response.data;
  },
};

// Resources / access control
export const resourcesApi = {
  list: async () => {
    console.log('🟢 [API] resourcesApi.list called');
    const response = await api.get('/resources');
    console.log('🟢 [API] resourcesApi.list response:', response.data);
    return response.data;
  },
  listClients: async () => {
    console.log('🟢 [API] resourcesApi.listClients called');
    const response = await api.get('/resources/clients');
    console.log('🟢 [API] resourcesApi.listClients response:', response.data);
    return response.data;
  },
  add: async (payload: any) => {
    console.log('🟢 [API] resourcesApi.add called with payload:', payload);
    try {
      const response = await api.post('/resources', payload);
      console.log('🟢 [API] resourcesApi.add response:', response.data);
      return response.data;
    } catch (err: any) {
      console.error('🟢 [API] resourcesApi.add error:', err);
      console.error('🟢 [API] Error response:', err.response?.data);
      throw err;
    }
  },
  updateAccess: async (id: string, payload: { access_health?: boolean; access_fitness?: boolean; access_diet?: boolean; roles?: string[] }) => {
    console.log('🟢 [API] resourcesApi.updateAccess called with id:', id, 'payload:', payload);
    try {
      const response = await api.put(`/resources/${id}/access`, payload);
      console.log('🟢 [API] resourcesApi.updateAccess response:', response.data);
      return response.data;
    } catch (err: any) {
      console.error('🟢 [API] resourcesApi.updateAccess error:', err);
      console.error('🟢 [API] Error response:', err.response?.data);
      throw err;
    }
  },
  delete: async (id: string) => {
    console.log('🟢 [API] resourcesApi.delete called with id:', id);
    try {
      const response = await api.delete(`/resources/${id}`);
      console.log('🟢 [API] resourcesApi.delete response:', response.data);
      return response.data;
    } catch (err: any) {
      console.error('🟢 [API] resourcesApi.delete error:', err);
      console.error('🟢 [API] Error response:', err.response?.data);
      throw err;
    }
  },
  addPatientByDoctor: async (payload: { phone: string; name?: string }) => {
    const response = await api.post('/resources/patients', payload);
    return response.data;
  },
  getDashPatients: async () => {
    const response = await api.get('/resources/dash-patients');
    return response.data;
  },
};

// HCP API endpoints
export const hcpApi = {
  getAll: async () => {
    const response = await api.get('/hcp/all');
    return response.data;
  },

  create: async (hcpData: any) => {
    const response = await api.post('/hcp', hcpData);
    return response.data;
  },

  getById: async (hcpId: string) => {
    const response = await api.get(`/hcp/${hcpId}`);
    return response.data;
  },

  update: async (hcpId: string, hcpData: any) => {
    const response = await api.put(`/hcp/${hcpId}`, hcpData);
    return response.data;
  },

  // Clinic management
  addClinic: async (hcpId: string, clinicData: any) => {
    console.log('🔍 [API] Adding clinic:', { hcpId, clinicData });
    console.log('🔍 [API] Request URL:', `/hcp/${hcpId}/clinics`);
    console.log('🔍 [API] Request headers:', api.defaults.headers);
    console.log('🔍 [API] Auth token:', localStorage.getItem('token'));
    const response = await api.post(`/hcp/${hcpId}/clinics`, clinicData);
    console.log('✅ [API] Clinic added successfully:', response.data);
    return response.data;
  },

  updateClinic: async (hcpId: string, clinicId: string, clinicData: any) => {
    console.log('🔍 [API] Updating clinic:', { hcpId, clinicId, clinicData });
    console.log('🔍 [API] Request URL:', `/hcp/${hcpId}/clinics/${clinicId}`);
    console.log('🔍 [API] Request headers:', api.defaults.headers);
    console.log('🔍 [API] Auth token:', localStorage.getItem('token'));
    const response = await api.put(`/hcp/${hcpId}/clinics/${clinicId}`, clinicData);
    console.log('✅ [API] Clinic updated successfully:', response.data);
    return response.data;
  },

  deleteClinic: async (hcpId: string, clinicId: string) => {
    console.log('🔍 [API] Deleting clinic:', { hcpId, clinicId });
    const response = await api.delete(`/hcp/${hcpId}/clinic/${clinicId}`);
    console.log('✅ [API] Clinic deleted successfully:', response.data);
    return response.data;
  },

  // Practice management
  addPractice: async (hcpId: string, practiceData: any) => {
    const response = await api.post(`/hcp/${hcpId}/practices`, practiceData);
    return response.data;
  },

  updatePractice: async (hcpId: string, practiceId: string, practiceData: any) => {
    const response = await api.put(`/hcp/${hcpId}/practices/${practiceId}`, practiceData);
    return response.data;
  },

  deletePractice: async (hcpId: string, practiceId: string) => {
    const response = await api.delete(`/hcp/${hcpId}/practices/${practiceId}`);
    return response.data;
  },

  // Doctor management
  addDoctor: async (hcpId: string, doctorData: any) => {
    const response = await api.post(`/hcp/${hcpId}/doctors`, doctorData);
    return response.data;
  },

  updateDoctor: async (hcpId: string, doctorId: string, doctorData: any) => {
    const response = await api.put(`/hcp/${hcpId}/doctors/${doctorId}`, doctorData);
    return response.data;
  },

  deleteDoctor: async (hcpId: string, doctorId: string, clinicId?: string, practiceId?: string) => {
    // Support both old format and new PostgreSQL format
    const url = (clinicId && practiceId) 
      ? `/hcp/${hcpId}/clinic/${clinicId}/practice/${practiceId}/doctors/${doctorId}`
      : `/hcp/${hcpId}/doctors/${doctorId}`;
    const response = await api.delete(url);
    return response.data;
  },

  // Receptionist management
  assignReceptionist: async (hcpId: string, receptionistData: any) => {
    const response = await api.post(`/hcp/${hcpId}/assign-receptionist`, receptionistData);
    return response.data;
  },

  deleteReceptionist: async (hcpId: string, receptionistId: string, clinicId?: string, practiceId?: string) => {
    // Support both old format and new PostgreSQL format
    const url = (clinicId && practiceId) 
      ? `/hcp/${hcpId}/clinic/${clinicId}/practice/${practiceId}/receptionists/${receptionistId}`
      : `/hcp/${hcpId}/receptionists/${receptionistId}`;
    const response = await api.delete(url);
    return response.data;
  },

  addReceptionDuty: async (hcpId: string, dutyData: any) => {
    const response = await api.post(`/hcp/${hcpId}/reception-duty`, dutyData);
    return response.data;
  },

  getReceptionDuties: async (hcpId: string, date?: string) => {
    const params = date ? { date } : {};
    const response = await api.get(`/hcp/${hcpId}/reception-duty`, { params });
    return response.data;
  },

  // NEW: Hierarchical endpoints
  addPracticeToClinic: async (hcpId: string, clinicId: string, practiceData: any) => {
    const response = await api.post(`/hcp/${hcpId}/clinic/${clinicId}/practice`, practiceData);
    return response.data;
  },

  addDoctorToPractice: async (hcpId: string, clinicId: string, practiceId: string, doctorData: any) => {
    const response = await api.post(`/hcp/${hcpId}/clinic/${clinicId}/practice/${practiceId}/doctor`, doctorData);
    return response.data;
  },

  addReceptionistToClinic: async (hcpId: string, clinicId: string, receptionistData: any) => {
    const response = await api.post(`/hcp/${hcpId}/clinic/${clinicId}/receptionist`, receptionistData);
    return response.data;
  },

  addReceptionistToPractice: async (hcpId: string, clinicId: string, practiceId: string, receptionistData: any) => {
    const response = await api.post(`/hcp/${hcpId}/clinic/${clinicId}/practice/${practiceId}/receptionist`, receptionistData);
    return response.data;
  },

  getDoctorsByPractice: async (hcpId: string, practiceId: string) => {
    const response = await api.get(`/hcp/${hcpId}/practice/${practiceId}/doctors`);
    return response.data;
  },

  getReceptionistsByPractice: async (hcpId: string, practiceId: string) => {
    const response = await api.get(`/hcp/${hcpId}/practice/${practiceId}/receptionists`);
    return response.data;
  }
};

// Appointment API endpoints
export const appointmentApi = {
  getAll: async (params?: any) => {
    const response = await api.get('/appointments', { params });
    return response.data;
  },

  create: async (appointmentData: any) => {
    const response = await api.post('/appointments', appointmentData);
    return response.data;
  },

  updateStatus: async (appointmentId: string, status: string) => {
    const response = await api.patch(`/appointments/${appointmentId}/status`, { status });
    return response.data;
  },

  getTimeSlots: async (hcpId: string, date: string) => {
    const response = await api.get('/appointments/time-slots', { 
      params: { hcpId, date } 
    });
    return response.data;
  }
};

// Patient API endpoints
export const patientApi = {
  getAll: async (params?: any) => {
    const response = await api.get('/patients', { params });
    return response.data;
  },

  create: async (patientData: any) => {
    const response = await api.post('/patients', patientData);
    return response.data;
  },

  search: async (query: string) => {
    const response = await api.get('/patients/search', { 
      params: { q: query } 
    });
    return response.data;
  },

  getById: async (patientId: string) => {
    const response = await api.get(`/patients/${patientId}`);
    return response.data;
  },

  update: async (patientId: string, patientData: any) => {
    const response = await api.put(`/patients/${patientId}`, patientData);
    return response.data;
  },

  softDelete: async (patientId: string) => {
    const response = await api.delete(`/patients/${patientId}`);
    return response.data;
  },

  restore: async (patientId: string) => {
    const response = await api.post(`/patients/${patientId}/restore`);
    return response.data;
  }
};

// User API endpoints - NEW
export const userApi = {
  lookup: async (phone: string) => {
    const response = await userApiClient.post('/users/lookup', { phone });
    return response.data;
  },

  getByPhone: async (phone: string) => {
    const response = await userApiClient.get(`/users/by-phone/${encodeURIComponent(phone)}`);
    return response.data;
  },

  searchUsers: async (searchTerm: string, options?: { signal?: AbortSignal }) => {
    const response = await userApiClient.get('/users/search', {
      params: { searchTerm },
      signal: options?.signal
    });
    return response.data;
  },

  searchDoctors: async (searchTerm: string, options?: { signal?: AbortSignal }) => {
    const response = await api.get('/users/search/doctors', {
      params: { searchTerm },
      signal: options?.signal
    });
    return response.data;
  },
  createDoctor: async (payload: { name?: string; phone: string }) => {
    const response = await api.post('/users/doctors', payload);
    return response.data;
  },
  
  searchReceptionists: async (searchTerm: string) => {
    const response = await api.get('/users/search/receptionists', {
      params: { searchTerm }
    });
    return response.data;
  }
};

// Medical History API endpoints
export const medicalHistoryApi = {
  // Past Visits
  createPastVisit: async (visitData: any) => {
    const response = await api.post('/past-visits', visitData);
    return response.data;
  },

  getPastVisits: async (patientId?: string) => {
    const params = patientId ? { patient_id: patientId } : {};
    const response = await api.get('/past-visits', { params });
    return response.data;
  },

  getPastVisitDetails: async (appointmentId: string) => {
    const response = await api.get(`/past-visits/${appointmentId}`);
    return response.data;
  },

  updatePastVisit: async (appointmentId: string, visitData: any) => {
    const response = await api.put(`/past-visits/${appointmentId}`, visitData);
    return response.data;
  },

  deletePastVisit: async (appointmentId: string) => {
    const response = await api.delete(`/past-visits/${appointmentId}`);
    return response.data;
  },

  // Document Uploads
  uploadPrescription: async (appointmentId: string, documentData: any) => {
    const response = await api.post(`/past-visits/${appointmentId}/prescription`, documentData);
    return response.data;
  },

  uploadReceipt: async (appointmentId: string, documentData: any) => {
    const response = await api.post(`/past-visits/${appointmentId}/receipt`, documentData);
    return response.data;
  },

  uploadTestResult: async (appointmentId: string, documentData: any) => {
    const response = await api.post(`/past-visits/${appointmentId}/test-result`, documentData);
    return response.data;
  },

  // Document Updates and Deletes
  updatePrescription: async (prescriptionId: string, updateData: any) => {
    const response = await api.put(`/past-visits/prescriptions/${prescriptionId}`, updateData);
    return response.data;
  },

  deletePrescription: async (prescriptionId: string) => {
    const response = await api.delete(`/past-visits/prescriptions/${prescriptionId}`);
    return response.data;
  },

  updateReceipt: async (receiptId: string, updateData: any) => {
    const response = await api.put(`/past-visits/receipts/${receiptId}`, updateData);
    return response.data;
  },

  deleteReceipt: async (receiptId: string) => {
    const response = await api.delete(`/past-visits/receipts/${receiptId}`);
    return response.data;
  },

  updateTestResult: async (testResultId: string, updateData: any) => {
    const response = await api.put(`/past-visits/test-results/${testResultId}`, updateData);
    return response.data;
  },

  deleteTestResult: async (testResultId: string) => {
    const response = await api.delete(`/past-visits/test-results/${testResultId}`);
    return response.data;
  },

  // Medical History
  getMedicalHistory: async (patientId?: string) => {
    const params = patientId ? { patient_id: patientId } : {};
    const response = await api.get('/medical-history', { params });
    return response.data;
  },

  getAllPrescriptions: async (patientId?: string) => {
    const params = patientId ? { patient_id: patientId } : {};
    const response = await api.get('/medical-history/prescriptions', { params });
    return response.data;
  },

  getAllTestResults: async (patientId?: string) => {
    const params = patientId ? { patient_id: patientId } : {};
    const response = await api.get('/medical-history/test-results', { params });
    return response.data;
  },

  // Repositories
  searchUnverifiedDoctors: async (search?: string, city?: string, specialty?: string) => {
    const params: any = {};
    if (search) params.search = search;
    if (city) params.city = city;
    if (specialty) params.specialty = specialty;
    const response = await api.get('/repositories/unverified-doctors', { params });
    return response.data;
  },

  createUnverifiedDoctor: async (doctorData: any) => {
    const response = await api.post('/repositories/unverified-doctors', doctorData);
    return response.data;
  },

  // Receipt Scanning
  extractReceiptData: async (receiptData: any) => {
    const response = await api.post('/past-visits/extract-receipt', receiptData);
    return response.data;
  },
  extractDocumentData: async (payload: any) => {
    const response = await api.post('/past-visits/extract-document', payload);
    return response.data;
  },
  scanReceiptAndCreateVisit: async (receiptData: any) => {
    const response = await api.post('/past-visits/scan-receipt', receiptData);
    return response.data;
  },

  searchPharmacies: async (search?: string, city?: string, area?: string) => {
    const params: any = {};
    if (search) params.search = search;
    if (city) params.city = city;
    if (area) params.area = area;
    const response = await api.get('/repositories/pharmacies', { params });
    return response.data;
  },

  searchDiagnosticsCenters: async (search?: string, city?: string, area?: string, testType?: string) => {
    const params: any = {};
    if (search) params.search = search;
    if (city) params.city = city;
    if (area) params.area = area;
    if (testType) params.test_type = testType;
    const response = await api.get('/repositories/diagnostics-centers', { params });
    return response.data;
  }
};

// Repository API endpoints - Practice and Specialization Repository
export const repositoryApi = {
  // Get all practices with optional search and category filter
  getPractices: async (search?: string, category?: string) => {
    const params: any = {};
    if (search) params.search = search;
    if (category) params.category = category;
    const response = await api.get('/repository/practices', { params });
    return response.data;
  },

  // Get practice categories
  getPracticeCategories: async () => {
    const response = await api.get('/repository/practices/categories');
    return response.data;
  },

  // Add custom practice
  addCustomPractice: async (practiceData: { name: string; description: string; category: string }) => {
    const response = await api.post('/repository/practices', practiceData);
    return response.data;
  },

  // Get specializations by practice name
  getSpecializations: async (practiceName?: string, search?: string) => {
    const params: any = {};
    if (practiceName) params.practiceName = practiceName;
    if (search) params.search = search;
    const response = await api.get('/repository/specializations', { params });
    return response.data;
  },

  // Add custom specialization
  addCustomSpecialization: async (specializationData: { name: string; description: string; practiceNames?: string[] }) => {
    const response = await api.post('/repository/specializations', specializationData);
    return response.data;
  }
};

// Management Team API endpoints
export const managementTeamApi = {
  // Get predefined management roles
  getRoles: async () => {
    const response = await api.get('/management-team/roles');
    return response.data;
  },

  // Search users by phone
  searchUsers: async (phone: string) => {
    const response = await api.get('/management-team/search', {
      params: { phone }
    });
    return response.data;
  },

  // Bulk import management team
  bulkImport: async (hcpId: string, clinicId: string, members: any[]) => {
    const response = await api.post(
      `/management-team/${hcpId}/clinics/${clinicId}/management-team/bulk`,
      { members }
    );
    return response.data;
  },

  // Add single member
  addMember: async (hcpId: string, clinicId: string, memberData: any) => {
    const response = await api.post(
      `/management-team/${hcpId}/clinics/${clinicId}/management-team`,
      memberData
    );
    return response.data;
  },

  // Update member role
  updateRole: async (hcpId: string, clinicId: string, userId: string, role: string) => {
    const response = await api.put(
      `/management-team/${hcpId}/clinics/${clinicId}/management-team/${userId}/role`,
      { role }
    );
    return response.data;
  },

  // Remove member
  removeMember: async (hcpId: string, clinicId: string, userId: string) => {
    const response = await api.delete(
      `/management-team/${hcpId}/clinics/${clinicId}/management-team/${userId}`
    );
    return response.data;
  }
};

// Vital Parameters API endpoints
export const vitalParametersApi = {
  // Parameter Definitions
  getParameterDefinitions: async (category?: string, subcategory?: string) => {
    const params: any = {};
    if (category) params.category = category;
    if (subcategory) params.subcategory = subcategory;
    const response = await api.get('/vital-parameters/definitions', { params });
    return response.data;
  },

  // Categories
  getParametersByCategory: async () => {
    const response = await api.get('/vital-parameters/categories');
    return response.data;
  },

  // Graph Data
  getGraphData: async (parameterNames: string[], startDate?: string, endDate?: string) => {
    const params: any = {
      parameter_names: Array.isArray(parameterNames) ? parameterNames.join(',') : parameterNames
    };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/vital-parameters/graph-data', { params });
    return response.data;
  },

  // CRUD Operations
  addParameter: async (parameterData: any) => {
    const response = await api.post('/vital-parameters', parameterData);
    return response.data;
  },

  getParameters: async (filters?: {
    parameter_name?: string;
    category?: string;
    start_date?: string;
    end_date?: string;
    include_abnormal_only?: boolean;
  }) => {
    const response = await api.get('/vital-parameters', { params: filters });
    return response.data;
  },

  updateParameter: async (id: string, parameterData: any) => {
    const response = await api.put(`/vital-parameters/${id}`, parameterData);
    return response.data;
  },

  deleteParameter: async (id: string) => {
    const response = await api.delete(`/vital-parameters/${id}`);
    return response.data;
  }
};

export default api;
