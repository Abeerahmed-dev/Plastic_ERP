import api from './api';
import { UOM, CreateUOMData, UpdateUOMData } from '../types/uom.types';
import { ApiSuccess } from '../types/api.types';

export async function getUOMs(): Promise<UOM[]> {
  const res = await api.get<ApiSuccess<UOM[]>>('/uom');
  return res.data.data;
}

export async function createUOM(data: CreateUOMData): Promise<UOM> {
  const res = await api.post<ApiSuccess<UOM>>('/uom', data);
  return res.data.data;
}

export async function updateUOM(id: string, data: UpdateUOMData): Promise<UOM> {
  const res = await api.put<ApiSuccess<UOM>>(`/uom/${id}`, data);
  return res.data.data;
}

export async function deactivateUOM(id: string): Promise<void> {
  await api.delete(`/uom/${id}`);
}
