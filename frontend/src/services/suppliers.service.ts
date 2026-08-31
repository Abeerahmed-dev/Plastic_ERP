import api from './api';
import { Supplier, CreateSupplierData, UpdateSupplierData, SupplierFilters } from '../types/supplier.types';
import { ApiSuccess, PaginationMeta } from '../types/api.types';

export async function getSuppliers(filters: SupplierFilters = {}): Promise<{
  data: Supplier[];
  meta: PaginationMeta;
}> {
  const res = await api.get<ApiSuccess<Supplier[]>>('/suppliers', { params: filters });
  return { data: res.data.data, meta: res.data.meta! };
}

export async function getSupplier(id: string): Promise<Supplier> {
  const res = await api.get<ApiSuccess<Supplier>>(`/suppliers/${id}`);
  return res.data.data;
}

export async function createSupplier(data: CreateSupplierData): Promise<Supplier> {
  const res = await api.post<ApiSuccess<Supplier>>('/suppliers', data);
  return res.data.data;
}

export async function updateSupplier(id: string, data: UpdateSupplierData): Promise<Supplier> {
  const res = await api.put<ApiSuccess<Supplier>>(`/suppliers/${id}`, data);
  return res.data.data;
}

export async function deactivateSupplier(id: string): Promise<void> {
  await api.delete(`/suppliers/${id}`);
}
