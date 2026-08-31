import api from './api';
import { Customer, CreateCustomerData, UpdateCustomerData, CustomerFilters } from '../types/customer.types';
import { ApiSuccess, PaginationMeta } from '../types/api.types';

export async function getCustomers(filters: CustomerFilters = {}): Promise<{
  data: Customer[];
  meta: PaginationMeta;
}> {
  const res = await api.get<ApiSuccess<Customer[]>>('/customers', { params: filters });
  return { data: res.data.data, meta: res.data.meta! };
}

export async function getCustomer(id: string): Promise<Customer> {
  const res = await api.get<ApiSuccess<Customer>>(`/customers/${id}`);
  return res.data.data;
}

export async function createCustomer(data: CreateCustomerData): Promise<Customer> {
  const res = await api.post<ApiSuccess<Customer>>('/customers', data);
  return res.data.data;
}

export async function updateCustomer(id: string, data: UpdateCustomerData): Promise<Customer> {
  const res = await api.put<ApiSuccess<Customer>>(`/customers/${id}`, data);
  return res.data.data;
}

export async function deactivateCustomer(id: string): Promise<void> {
  await api.delete(`/customers/${id}`);
}
