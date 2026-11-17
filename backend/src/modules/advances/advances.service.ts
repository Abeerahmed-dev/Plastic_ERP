import * as repo from './advances.repository';
import { CreateCustomerAdvanceInput, CreateSupplierAdvanceInput } from './advances.schemas';

export async function createCustomerAdvance(input: CreateCustomerAdvanceInput, userId?: string) {
  return await repo.createCustomerAdvance(input, userId);
}

export async function createSupplierAdvance(input: CreateSupplierAdvanceInput, userId?: string) {
  return await repo.createSupplierAdvance(input, userId);
}
