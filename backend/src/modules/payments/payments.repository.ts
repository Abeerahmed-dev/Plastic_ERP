import db from '../../db/knex';
import { CreatePaymentInput } from './payments.schemas';

export async function generateNextPaymentNumber(): Promise<string> {
  const rows = await db('customer_payments')
    .where('payment_number', 'like', 'RCV-%')
    .select('payment_number');

  let maxNum = 0;
  for (const r of rows) {
    if (r.payment_number && !r.payment_number.startsWith('RCV-POS-')) {
      const numPart = r.payment_number.replace('RCV-', '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `RCV-${(maxNum + 1).toString().padStart(5, '0')}`;
}

export async function createPayment(
  input: CreatePaymentInput,
  paymentNumber: string,
  userId?: string
): Promise<string> {
  return await db.transaction(async (trx) => {
    const isCheque = input.payment_method === 'CHEQUE' || input.payment_method === 'PDC';
    const chequeStatus = isCheque ? (input.cheque_status || 'PENDING') : 'CLEARED';

    // 1. Insert Payment
    const [payment] = await trx('customer_payments')
      .insert({
        customer_id: input.customer_id,
        invoice_id: input.invoice_id || null,
        payment_number: paymentNumber,
        payment_date: input.payment_date,
        amount: input.amount,
        payment_method: input.payment_method,
        bank_account_id: input.bank_account_id || null,
        notes: input.notes || null,
        cheque_number: input.cheque_number || null,
        cheque_bank_name: input.cheque_bank_name || null,
        cheque_due_date: input.cheque_due_date || null,
        cheque_status: chequeStatus,
        created_by: userId || null,
      })
      .returning('*');

    // 2. If payment_method === 'DIRECT_TO_SUPPLIER' & supplier_id present, execute mirrored AP insert into supplier_payments
    if (input.payment_method === 'DIRECT_TO_SUPPLIER' && input.supplier_id) {
      const rows = await trx('supplier_payments')
        .where('payment_number', 'like', 'PAY-OUT-%')
        .select('payment_number');

      let maxNum = 0;
      for (const r of rows) {
        if (r.payment_number) {
          const numPart = r.payment_number.replace('PAY-OUT-', '');
          const num = parseInt(numPart, 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
      const supplierPaymentNumber = `PAY-OUT-${(maxNum + 1).toString().padStart(5, '0')}`;

      const contraNotes = input.notes 
        ? input.notes 
        : `Direct settlement received from customer ID: ${input.customer_id}`;

      await trx('supplier_payments').insert({
        supplier_id: input.supplier_id,
        purchase_invoice_id: null,
        payment_number: supplierPaymentNumber,
        payment_date: input.payment_date,
        amount: input.amount,
        payment_method: 'CONTRA_CUSTOMER',
        bank_account_id: null,
        notes: contraNotes,
        cheque_status: 'CLEARED',
        created_by: userId || null,
      });
    }

    // 3. If it's linked to an invoice, update the invoice's paid_amount and status
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

export async function clearCheque(paymentId: string): Promise<boolean> {
  const custUpdated = await db('customer_payments')
    .where('id', paymentId)
    .update({
      cheque_status: 'CLEARED',
      updated_at: db.fn.now(),
    });

  if (custUpdated === 0) {
    await db('supplier_payments')
      .where('id', paymentId)
      .update({
        cheque_status: 'CLEARED',
        updated_at: db.fn.now(),
      });
  }

  return true;
}

export async function findAllPayments(query?: { search?: string; customer_id?: string; invoice_id?: string }) {
  const { search, customer_id, invoice_id } = query || {};

  const baseQuery = db('customer_payments as p')
    .join('customers as c', 'p.customer_id', 'c.id')
    .leftJoin('sales_invoices as si', 'p.invoice_id', 'si.id')
    .modify((qb) => {
      if (search) {
        qb.where((inner) => {
          inner.whereILike('p.payment_number', `%${search}%`)
               .orWhereILike('c.name', `%${search}%`)
               .orWhereILike('si.invoice_number', `%${search}%`);
        });
      }
      if (customer_id) qb.where('p.customer_id', customer_id);
      if (invoice_id) qb.where('p.invoice_id', invoice_id);
    });

  const rows = await baseQuery
    .select(
      db.raw('COALESCE(p.invoice_id, p.id) as group_id'),
      'p.customer_id',
      'c.name as customer_name',
      'c.code as customer_code',
      'p.invoice_id',
      'si.invoice_number as sales_invoice_number',
      db.raw('COALESCE(si.total_amount, SUM(p.amount)) as invoice_total_amount'),
      db.raw('SUM(p.amount) as total_paid_against_invoice'),
      'si.status as invoice_status',
      db.raw(`
        json_agg(
          json_build_object(
            'id', p.id,
            'payment_no', p.payment_number,
            'payment_number', p.payment_number,
            'date', p.payment_date,
            'payment_date', p.payment_date,
            'method', p.payment_method,
            'payment_method', p.payment_method,
            'amount', p.amount,
            'notes', p.notes,
            'cheque_number', p.cheque_number,
            'cheque_bank_name', p.cheque_bank_name,
            'cheque_due_date', p.cheque_due_date,
            'cheque_status', p.cheque_status
          ) ORDER BY p.payment_date DESC, p.created_at DESC
        ) as payment_history
      `)
    )
    .groupByRaw('COALESCE(p.invoice_id, p.id), p.customer_id, c.name, c.code, p.invoice_id, si.invoice_number, si.total_amount, si.status')
    .orderBy(db.raw('MAX(p.payment_date)'), 'desc');

  return rows.map((r: any) => {
    const totalPaid = Number(r.total_paid_against_invoice || 0);
    const invoiceTotal = Number(r.invoice_total_amount || 0);

    let status = r.invoice_status;
    if (!status) {
      status = totalPaid >= invoiceTotal ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID';
    }

    const rawHistory = typeof r.payment_history === 'string'
      ? JSON.parse(r.payment_history)
      : r.payment_history;

    return {
      id: r.group_id,
      sales_id: r.invoice_id || r.group_id,
      invoice_id: r.invoice_id,
      invoice_number: r.sales_invoice_number || 'Account Payment',
      customer_id: r.customer_id,
      customer_name: r.customer_name,
      customer_code: r.customer_code,
      invoice_total_amount: Math.round(invoiceTotal * 100) / 100,
      total_paid_against_invoice: Math.round(totalPaid * 100) / 100,
      invoice_status: status,
      payment_history: Array.isArray(rawHistory) ? rawHistory.map((item: any) => ({
        ...item,
        amount: Number(item.amount)
      })) : []
    };
  });
}

export async function createRefund(data: { customer_id: string; amount: number; source: string; notes?: string; linked_invoice_id?: string | null }, userId?: string) {
  return await db.transaction(async (trx) => {
    const paymentNumber = await generateNextPaymentNumber();
    const isCashDrawer = data.source === 'CASH_DRAWER';
    const isBank = !isCashDrawer && data.source;

    const [payment] = await trx('customer_payments').insert({
      customer_id: data.customer_id,
      invoice_id: data.linked_invoice_id || null,
      payment_number: paymentNumber,
      payment_date: new Date().toISOString().split('T')[0],
      amount: data.amount,
      payment_method: isCashDrawer ? 'CASH_REFUND' : 'BANK_TRANSFER',
      bank_account_id: isBank ? data.source : null,
      notes: data.notes || 'Customer Cash Refund from Advance Wallet',
      cheque_status: 'CLEARED',
      created_by: userId || null,
    }).returning('*');

    return payment;
  });
}
