import api from './api';
import { User, CreateUserData, UpdateUserData, Role } from '../types/user.types';
import { ApiSuccess } from '../types/api.types';

export const usersService = {
  getUsers: async (): Promise<User[]> => {
    const response = await api.get<ApiSuccess<User[]>>('/users');
    return response.data.data;
  },

  getUser: async (id: string): Promise<User> => {
    const response = await api.get<ApiSuccess<User>>(`/users/${id}`);
    return response.data.data;
  },

  createUser: async (data: CreateUserData): Promise<User> => {
    const response = await api.post<ApiSuccess<User>>('/users', data);
    return response.data.data;
  },

  updateUser: async (id: string, data: UpdateUserData): Promise<User> => {
    const response = await api.put<ApiSuccess<User>>(`/users/${id}`, data);
    return response.data.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  getRoles: async (): Promise<Role[]> => {
    const response = await api.get<ApiSuccess<Role[]>>('/users/roles');
    return response.data.data;
  },
};
