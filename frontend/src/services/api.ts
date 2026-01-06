import axios from 'axios';
// import type { AuthResponse, Raga, Artist, Track, ApiResponse } from '../types/index.js';

// Support local development, IP-based backend, and Google Cloud Run
const getApiBaseUrl = () => {
  // Check if we're running locally (localhost or 127.0.0.1)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '192.168.1.14') {
    return 'http://localhost:3002/api';
  }
  // Check if we're running from the specific IP
  if (window.location.hostname === '34.117.220.98' || window.location.hostname.includes('34.117.220.98')) {
    return 'http://34.117.220.98/api';
  }
  // Default to Google Cloud Run (integrated backend)
  return import.meta.env.VITE_API_BASE_URL || 'https://aarogya-mitra-backend-integrated-bnbuvw3hkq-el.a.run.app/api';
};

const API_BASE_URL = getApiBaseUrl();

// Log which backend is being used
console.log('🔗 [API] Using backend URL:', API_BASE_URL);
console.log('🔗 [API] Current hostname:', window.location.hostname);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
    const response = await api.post('/users/lookup', { phone });
    return response.data;
  },

  getByPhone: async (phone: string) => {
    const response = await api.get(`/users/by-phone/${phone}`);
    return response.data;
  },

  searchUsers: async (searchTerm: string) => {
    const response = await api.get('/users/search', {
      params: { searchTerm }
    });
    return response.data;
  },

  searchDoctors: async (searchTerm: string) => {
    const response = await api.get('/users/search/doctors', {
      params: { searchTerm }
    });
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
