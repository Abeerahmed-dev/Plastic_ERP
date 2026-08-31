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
};
