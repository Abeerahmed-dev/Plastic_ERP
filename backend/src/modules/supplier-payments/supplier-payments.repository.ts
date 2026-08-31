import db from '../../db/knex';
import { Knex } from 'knex';
import { CreateSupplierPaymentInput, PaymentQuery } from './supplier-payments.schemas';

export async function generatePaymentNumber(): Promise<string> {
  const row = await db('supplier_payments')
    .where('payment_number', 'like', 'PAY-OUT-%')
    .orderBy('payment_number', 'desc')
    .first('payment_number');

  if (!row || !row.payment_number) {
    return 'PAY-OUT-00001';
  }

  const numPart = row.payment_number.replace('PAY-OUT-', '');
  const nextNum = parseInt(numPart, 10) + 1;
  return `PAY-OUT-${nextNum.toString().padStart(5, '0')}`;
}

export async function createSupplierPayment(data: CreateSupplierPaymentInput, userId: string) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    const payment_number = await generatePaymentNumber();

    const [payment] = await trx('supplier_payments').insert({
      ...data,
      payment_number,
      created_by: userId,
    }).returning('*');

    // If linked to an invoice, update the paid_amount and status of the purchase invoice
    if (data.purchase_invoice_id) {
      const invoice = await trx('purchase_invoices').where('id', data.purchase_invoice_id).first();
      if (invoice) {
        const newPaidAmount = Number(invoice.paid_amount) + data.amount;
        let newStatus = invoice.status;

        if (newPaidAmount >= Number(invoice.total_amount)) {
          newStatus = 'PAID';
        } else if (newPaidAmount > 0) {
          newStatus = 'PARTIAL';
        }

        await trx('purchase_invoices')
          .where('id', invoice.id)
          .update({
            paid_amount: newPaidAmount,
            status: newStatus,
            updated_at: new Date()
          });
      }
    }

    return payment;
  });
}

export async function findAllPayments(query: PaymentQuery) {
  const { page, limit, search, supplier_id, purchase_invoice_id } = query;
  const offset = (page - 1) * limit;

  const baseQuery = db('supplier_payments as sp')
    .join('suppliers as s', 'sp.supplier_id', 's.id')
    .leftJoin('purchase_invoices as pi', 'sp.purchase_invoice_id', 'pi.id')
    .modify((qb: Knex.QueryBuilder) => {
      if (search) {
        qb.where((inner: Knex.QueryBuilder) => {
          inner.whereILike('sp.payment_number', `%${search}%`)
               .orWhereILike('s.name', `%${search}%`)
               .orWhereILike('pi.invoice_number', `%${search}%`);
        });
      }
      if (supplier_id) qb.where('sp.supplier_id', supplier_id);
      if (purchase_invoice_id) qb.where('sp.purchase_invoice_id', purchase_invoice_id);
    });

  const [{ count }] = await baseQuery.clone().count<[{ count: string }]>('sp.id as count');
  const total = parseInt(count, 10);

  const rows = await baseQuery
    .select(
      'sp.*',
      's.name as supplier_name',
      'pi.invoice_number as purchase_invoice_number'
    )
    .orderBy('sp.payment_date', 'desc')
    .orderBy('sp.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  return { rows, total };
}

export async function findPaymentById(id: string) {
  return db('supplier_payments as sp')
    .join('suppliers as s', 'sp.supplier_id', 's.id')
    .leftJoin('purchase_invoices as pi', 'sp.purchase_invoice_id', 'pi.id')
    .where('sp.id', id)
    .select(
      'sp.*',
      's.name as supplier_name',
      'pi.invoice_number as purchase_invoice_number'
    )
    .first();
}
