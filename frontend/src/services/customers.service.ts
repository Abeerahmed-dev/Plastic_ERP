import api from './api';
import { Customer, CreateCustomerData, UpdateCustomerData, CustomerFilters } from '../types/customer.types';
import { ApiSuccess, PaginationMeta } from '../types/api.types';
import { RefundableCreditSource } from '../types/payment.types';
import { offlineMasterCache } from './offline-master-cache.service';

export async function getCustomers(filters: CustomerFilters = {}): Promise<{
  data: Customer[];
  meta: PaginationMeta;
}> {
  const isMasterDropdownFetch =
    !filters.search &&
    !filters.city &&
    !filters.customer_type &&
    !filters.region &&
    (!filters.page || filters.page === 1) &&
    typeof filters.limit === 'number' &&
    filters.limit >= 1000;

  const fetchFn = async () => {
    const res = await api.get<ApiSuccess<Customer[]>>('/customers', { params: filters });
    return { data: res.data.data, meta: res.data.meta! };
  };

  if (isMasterDropdownFetch) {
    return offlineMasterCache.fetchWithCache('customers', fetchFn);
  }
  return fetchFn();
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

export async function getCustomerStatement(id: string): Promise<any[]> {
  const res = await api.get<ApiSuccess<any[]>>(`/customers/${id}/statement`);
  return res.data.data;
}

export async function getCustomerRefundableCredits(id: string): Promise<RefundableCreditSource[]> {
  const res = await api.get<ApiSuccess<RefundableCreditSource[]>>(`/customers/${id}/refundable-credits`);
  return res.data.data;
}

