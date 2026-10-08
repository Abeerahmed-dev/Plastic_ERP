import api from './api';
import { Employee, CreateEmployeeData, UpdateEmployeeData, EmployeeFilters } from '../types/employee.types';
import { ApiSuccess } from '../types/api.types';

export const employeesService = {
  getEmployees: async (filters: EmployeeFilters = {}): Promise<Employee[]> => {
    const response = await api.get<ApiSuccess<Employee[]>>('/employees', { params: filters });
    return response.data.data;
  },

  getEmployee: async (id: string): Promise<Employee> => {
    const response = await api.get<ApiSuccess<Employee>>(`/employees/${id}`);
    return response.data.data;
  },

  createEmployee: async (data: CreateEmployeeData): Promise<Employee> => {
    const response = await api.post<ApiSuccess<Employee>>('/employees', data);
    return response.data.data;
  },

  updateEmployee: async (id: string, data: UpdateEmployeeData): Promise<Employee> => {
    const response = await api.put<ApiSuccess<Employee>>(`/employees/${id}`, data);
    return response.data.data;
  },

  deleteEmployee: async (id: string): Promise<void> => {
    await api.delete(`/employees/${id}`);
  },
};
