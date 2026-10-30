import axios from 'axios';
import { useAuthStore } from '../store/auth.store';

/**
 * Axios instance pre-configured for the Sabir Plastic ERP API.
 *
 * - Reads the base URL from VITE_API_BASE_URL (falls back to /api/v1
 *   which Vite dev-server proxies to the backend).
 * - Attaches the JWT access token from localStorage on every request.
 * - On 401 responses, automatically attempts to refresh the token using
 *   the refresh_token flow. Queues concurrent 401s to share a single refresh promise.
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

// Single-flight refresh token mutex
let refreshPromise: Promise<string> | null = null;

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

        // Reuse existing in-flight refresh promise if multiple requests hit 401 simultaneously
        if (!refreshPromise) {
          const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
          refreshPromise = axios
            .post(`${baseURL}/auth/refresh`, {
              refresh_token: refreshToken,
            })
            .then((res) => {
              const { access_token } = res.data.data;
              useAuthStore.getState().setAccessToken(access_token);
              return access_token;
            })
            .finally(() => {
              refreshPromise = null;
            });
        }

        const newAccessToken = await refreshPromise;

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (err) {
        refreshPromise = null;
        useAuthStore.getState().clearAuth();
        window.location.href = '/login';
        return Promise.reject(err);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
