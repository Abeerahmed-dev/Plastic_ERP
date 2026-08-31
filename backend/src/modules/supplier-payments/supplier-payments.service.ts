import { CreateSupplierPaymentInput, PaymentQuery } from './supplier-payments.schemas';
import * as repo from './supplier-payments.repository';
import { PaginationMeta } from '../../shared/apiResponse';
import { NotFoundError } from '../../shared/errors';

export async function createSupplierPayment(data: CreateSupplierPaymentInput, userId: string) {
  return await repo.createSupplierPayment(data, userId);
}

export async function getPayments(query: PaymentQuery): Promise<{ data: any[]; meta: PaginationMeta }> {
  const { rows, total } = await repo.findAllPayments(query);
  return {
    data: rows,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    }
  };
}

export async function getPayment(id: string) {
  const payment = await repo.findPaymentById(id);
  if (!payment) throw new NotFoundError('Payment not found');
  return payment;
}
