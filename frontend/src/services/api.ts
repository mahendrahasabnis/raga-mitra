import axios from 'axios';
// import type { AuthResponse, Raga, Artist, Track, ApiResponse } from '../types/index.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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

  signup: async (phone: string, pin: string) => {
    const response = await api.post('/auth/signup', { phone, pin });
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

export const ragaApi = {
  getRagas: async () => {
    const response = await api.get('/ragas');
    return response.data;
  },

  getRagaById: async (id: string) => {
    const response = await api.get(`/ragas/${id}`);
    return response.data;
  },
};

export const artistApi = {
  getArtists: async (raga?: string) => {
    // Don't filter by raga - show all artists
    const response = await api.get('/artists');
    return response.data;
  },

  getArtistById: async (id: string) => {
    const response = await api.get(`/artists/${id}`);
    return response.data;
  },
};

export const trackApi = {
  searchTracks: async (raga: string, artist: string) => {
    const response = await api.get('/tracks/search', {
      params: { raga, artist }
    });
    return response.data;
  },

  getCuratedTracks: async () => {
    const response = await api.get('/tracks/curated');
    return response.data;
  },

  rateTrack: async (trackId: string, rating: number) => {
    const response = await api.post(`/tracks/${trackId}/rate`, { rating });
    return response.data;
  },

  useCredit: async () => {
    const response = await api.post('/tracks/use-credit');
    return response.data;
  },
};

export default api;
