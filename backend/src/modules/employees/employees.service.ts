import {
  createEmployeeRecord,
  findEmployees,
  findEmployeeById,
  updateEmployeeRecord,
  deleteEmployeeRecord,
} from './employees.repository';
import { CreateEmployeeInput, UpdateEmployeeInput, EmployeeQuery } from './employees.schemas';

export const employeesService = {
  create: async (data: CreateEmployeeInput) => {
    return createEmployeeRecord(data);
  },

  getAll: async (query: EmployeeQuery = {}) => {
    return findEmployees(query);
  },

  getById: async (id: string) => {
    const employee = await findEmployeeById(id);
    if (!employee) throw new Error('Employee not found');
    return employee;
  },

  update: async (id: string, data: UpdateEmployeeInput) => {
    const existing = await findEmployeeById(id);
    if (!existing) throw new Error('Employee not found');
    return updateEmployeeRecord(id, data);
  },

  delete: async (id: string) => {
    const existing = await findEmployeeById(id);
    if (!existing) throw new Error('Employee not found');
    return deleteEmployeeRecord(id);
  },
};
