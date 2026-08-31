import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

/**
 * Axios instance pre-configured for the Sabir Plastic ERP API.
 *
 * - Reads the base URL from VITE_API_BASE_URL (falls back to /api/v1
 *   which Vite dev-server proxies to the backend).
 * - Attaches the JWT access token from localStorage on every request.
 * - On 401 responses, automatically attempts to refresh the token using
 *   the refresh_token flow. If it fails, redirects to login.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Request interceptor — attach JWT ──────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor — handle 401 ────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        // Refresh request using base axios to avoid loops
        const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
        const res = await axios.post(`${baseURL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        
        const { access_token } = res.data.data;
        
        // Save new token
        useAuthStore.getState().setAccessToken(access_token);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return api(originalRequest);
      } catch (err) {
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
