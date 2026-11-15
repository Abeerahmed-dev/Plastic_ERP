import * as repo from './refunds.repository';
import { CreateCustomerRefundInput, CreateSupplierRefundInput } from './refunds.schemas';

export async function createCustomerRefund(input: CreateCustomerRefundInput, userId?: string) {
  return await repo.createCustomerRefund(input, userId);
}

export async function createSupplierRefund(input: CreateSupplierRefundInput, userId?: string) {
  return await repo.createSupplierRefund(input, userId);
}
