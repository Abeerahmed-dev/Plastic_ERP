import { CreateCustomerRefundInput } from './customer-refunds.schemas';
import * as customerRefundsRepo from './customer-refunds.repository';

export async function processCustomerRefund(
  input: CreateCustomerRefundInput,
  userId?: string
) {
  return await customerRefundsRepo.createCustomerRefund(input, userId);
}
