import * as paymentsRepo from './payments.repository';
import { CreatePaymentInput } from './payments.schemas';

export async function createPayment(input: CreatePaymentInput, userId?: string) {
  const paymentNumber = await paymentsRepo.generateNextPaymentNumber();
  const paymentId = await paymentsRepo.createPayment(input, paymentNumber, userId);
  return { id: paymentId, payment_number: paymentNumber };
}

export async function getPayments(query?: { search?: string; customer_id?: string; invoice_id?: string }) {
  return await paymentsRepo.findAllPayments(query);
}

export async function clearCheque(paymentId: string) {
  return await paymentsRepo.clearCheque(paymentId);
}
