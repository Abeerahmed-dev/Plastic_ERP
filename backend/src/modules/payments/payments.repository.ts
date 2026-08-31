import db from '../../db/knex';
import { CreatePaymentInput } from './payments.schemas';

export async function generateNextPaymentNumber(): Promise<string> {
  const row = await db('customer_payments')
    .where('payment_number', 'like', 'RCV-%')
    .orderBy('payment_number', 'desc')
    .first('payment_number');

  if (!row || !row.payment_number) {
    return 'RCV-00001';
  }

  const numPart = row.payment_number.replace('RCV-', '');
  const nextNum = parseInt(numPart, 10) + 1;
  return `RCV-${nextNum.toString().padStart(5, '0')}`;
}

export async function createPayment(
  input: CreatePaymentInput,
  paymentNumber: string,
  userId?: string
): Promise<string> {
  return await db.transaction(async (trx) => {
    // 1. Insert Payment
    const [payment] = await trx('customer_payments')
      .insert({
        customer_id: input.customer_id,
        invoice_id: input.invoice_id || null,
        payment_number: paymentNumber,
        payment_date: input.payment_date,
        amount: input.amount,
        payment_method: input.payment_method,
        notes: input.notes,
        created_by: userId,
      })
      .returning('id');

    // 2. If it's linked to an invoice, update the invoice's paid_amount and status
    if (input.invoice_id) {
      const invoice = await trx('sales_invoices').where('id', input.invoice_id).first();
      if (invoice) {
        const newPaidAmount = Number(invoice.paid_amount) + Number(input.amount);
        let newStatus = 'PARTIAL';
        if (newPaidAmount >= Number(invoice.total_amount)) {
          newStatus = 'PAID';
        } else if (newPaidAmount === 0) {
          newStatus = 'UNPAID';
        }

        await trx('sales_invoices')
          .where('id', input.invoice_id)
          .update({
            paid_amount: newPaidAmount,
            status: newStatus,
            updated_at: trx.fn.now(),
          });
      }
    }

    return payment.id;
  });
}

export async function findAllPayments() {
  return db('customer_payments as p')
    .join('customers as c', 'p.customer_id', 'c.id')
    .leftJoin('sales_invoices as si', 'p.invoice_id', 'si.id')
    .select(
      'p.id',
      'p.payment_number',
      'p.payment_date',
      'p.amount',
      'p.payment_method',
      'c.id as customer_id',
      'c.name as customer_name',
      'si.invoice_number'
    )
    .orderBy('p.payment_date', 'desc')
    .orderBy('p.created_at', 'desc');
}
