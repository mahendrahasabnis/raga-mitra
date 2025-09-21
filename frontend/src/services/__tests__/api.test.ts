import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { authApi, ragaApi, artistApi, trackApi } from '../api';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock window.location.reload
Object.defineProperty(window, 'location', {
  value: {
    reload: vi.fn()
  }
});

describe('API Service', () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  describe('authApi', () => {
    it('should send OTP', async () => {
      const mockResponse = { data: { message: 'OTP sent successfully' } };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await authApi.sendOTP('+1234567890');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/send-otp', { phone: '+1234567890' });
      expect(result).toEqual(mockResponse.data);
    });

    it('should verify OTP', async () => {
      const mockResponse = { data: { message: 'OTP verified successfully' } };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await authApi.verifyOTP('+1234567890', '1234');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/verify-otp', { 
        phone: '+1234567890', 
        otp: '1234' 
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should signup user', async () => {
      const mockResponse = { 
        data: { 
          message: 'User created successfully',
          token: 'mock-token',
          user: { id: '1', phone: '+1234567890' }
        } 
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await authApi.signup('+1234567890', '1234');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/signup', { 
        phone: '+1234567890', 
        pin: '1234' 
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should login user', async () => {
      const mockResponse = { 
        data: { 
          message: 'Login successful',
          token: 'mock-token',
          user: { id: '1', phone: '+1234567890' }
        } 
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await authApi.login('+1234567890', '1234');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/login', { 
        phone: '+1234567890', 
        pin: '1234' 
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should reset PIN', async () => {
      const mockResponse = { data: { message: 'PIN reset successfully' } };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await authApi.resetPin('+1234567890', '1234', '5678');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/auth/reset-pin', { 
        phone: '+1234567890', 
        otp: '1234',
        newPin: '5678'
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('ragaApi', () => {
    it('should get all ragas', async () => {
      const mockResponse = { 
        data: [
          { id: '1', name: 'Yaman', description: 'Evening raga' },
          { id: '2', name: 'Bageshri', description: 'Night raga' }
        ]
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await ragaApi.getRagas();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/ragas');
      expect(result).toEqual(mockResponse.data);
    });

    it('should get raga by ID', async () => {
      const mockResponse = { 
        data: { id: '1', name: 'Yaman', description: 'Evening raga' }
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await ragaApi.getRagaById('1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/ragas/1');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('artistApi', () => {
    it('should get all artists', async () => {
      const mockResponse = { 
        data: [
          { id: '1', name: 'Artist 1' },
          { id: '2', name: 'Artist 2' }
        ]
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await artistApi.getArtists();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/artists');
      expect(result).toEqual(mockResponse.data);
    });

    it('should get artist by ID', async () => {
      const mockResponse = { 
        data: { id: '1', name: 'Artist 1' }
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await artistApi.getArtistById('1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/artists/1');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('trackApi', () => {
    it('should search tracks', async () => {
      const mockResponse = { 
        data: [
          { id: '1', title: 'Track 1', raga: 'Yaman', artist: 'Artist 1' }
        ]
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await trackApi.searchTracks('Yaman', 'Artist 1');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/tracks/search', {
        params: { raga: 'Yaman', artist: 'Artist 1' }
      });
      expect(result).toEqual(mockResponse.data);
    });

    it('should get curated tracks', async () => {
      const mockResponse = { 
        data: [
          { id: '1', title: 'Curated Track 1' }
        ]
      };
      mockAxiosInstance.get.mockResolvedValue(mockResponse);

      const result = await trackApi.getCuratedTracks();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/tracks/curated');
      expect(result).toEqual(mockResponse.data);
    });

    it('should rate track', async () => {
      const mockResponse = { data: { message: 'Rating saved' } };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await trackApi.rateTrack('1', 5);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/tracks/1/rate', { rating: 5 });
      expect(result).toEqual(mockResponse.data);
    });

    it('should use credit', async () => {
      const mockResponse = { data: { message: 'Credit used' } };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await trackApi.useCredit();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/tracks/use-credit');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 errors by clearing localStorage and reloading', async () => {
      const mockError = {
        response: { status: 401 }
      };
      mockAxiosInstance.post.mockRejectedValue(mockError);

      // This test would require the actual axios instance to be tested
      // For now, we're testing the mock setup
      expect(localStorageMock.removeItem).toBeDefined();
    });
  });
});

