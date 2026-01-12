import axios from 'axios';
import { Request, Response } from 'express';

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'https://platforms-99-backend-839584127235.asia-south1.run.app/api';
const USER_SERVICE_PHONE = process.env.USER_SERVICE_PHONE || '+919999999999';
const USER_SERVICE_PIN = process.env.USER_SERVICE_PIN || '9999';
const USER_SERVICE_PLATFORM = process.env.USER_SERVICE_PLATFORM || 'aarogya-mitra';

let cachedToken: string | null = null;
let lastLoginTs = 0;
const TOKEN_TTL_MS = 10 * 60 * 1000; // refresh token every 10 minutes

const buildUserServiceUrl = (phone: string) => {
  const base = USER_SERVICE_URL.replace(/\/$/, '');
  return `${base}/users/by-phone/${encodeURIComponent(phone)}`;
};

const loginForToken = async (): Promise<string> => {
  const now = Date.now();
  if (cachedToken && now - lastLoginTs < TOKEN_TTL_MS) {
    return cachedToken;
  }
  const loginUrl = USER_SERVICE_URL.replace(/\/$/, '') + '/auth/login';
  const payload = {
    phone: USER_SERVICE_PHONE,
    pin: USER_SERVICE_PIN,
    platform_name: USER_SERVICE_PLATFORM,
  };
  const resp = await axios.post(loginUrl, payload, { timeout: 8000 });
  const token = resp.data?.token;
  if (!token) {
    throw new Error('No token returned from user service');
  }
  cachedToken = token;
  lastLoginTs = now;
  return token;
};

// Proxy user lookup to 99platforms backend to avoid browser CORS
export const proxyGetByPhone = async (req: Request, res: Response) => {
  const { phone } = req.params;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    const token = await loginForToken();
    const url = buildUserServiceUrl(phone);
    const response = await axios.get(url, {
      timeout: 8000,
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status(response.status).json(response.data);
  } catch (error: any) {
    // If unauthorized, clear token and retry once
    if (error?.response?.status === 401) {
      cachedToken = null;
      try {
        const token = await loginForToken();
        const url = buildUserServiceUrl(phone);
        const response = await axios.get(url, {
          timeout: 8000,
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.status(response.status).json(response.data);
      } catch (retryErr: any) {
        const status = retryErr?.response?.status || 502;
        return res.status(status).json({
          message: retryErr?.response?.data?.message || 'User lookup failed',
          error: retryErr?.response?.data || retryErr?.message,
          source: '99platforms',
        });
      }
    }

    // Surface downstream response if available
    if (error.response) {
      const status = error.response.status || 502;
      return res.status(status).json({
        message: error.response.data?.message || 'User lookup failed',
        error: error.response.data || error.message,
        source: '99platforms',
      });
    }
    console.error('❌ [USER PROXY] Downstream lookup error:', error?.message);
    return res.status(502).json({
      message: 'User lookup failed',
      error: error?.message || 'Unknown error',
      source: '99platforms',
    });
  }
};
