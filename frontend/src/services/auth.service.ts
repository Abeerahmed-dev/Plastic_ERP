import api from './api';
import type { LoginRequest, LoginResponse, AuthUser } from '../types/auth.types';

export const authService = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<{ success: boolean; data: LoginResponse }>('/auth/login', data);
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },

  getMe: async (): Promise<AuthUser> => {
    const response = await api.get<{ success: boolean; data: AuthUser }>('/auth/me');
    return response.data.data;
  },

  forgotPassword: async (email: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post<{ success: boolean; data: { success: boolean; message: string } }>('/auth/forgot-password', { email });
    return response.data.data;
  },

  resetPassword: async (token: string, new_password: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post<{ success: boolean; data: { success: boolean; message: string } }>('/auth/reset-password', { token, new_password });
    return response.data.data;
  },
};
