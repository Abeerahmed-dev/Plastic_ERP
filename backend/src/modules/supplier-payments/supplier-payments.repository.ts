import db from '../../db/knex';
import { Knex } from 'knex';
import { CreateSupplierPaymentInput, PaymentQuery } from './supplier-payments.schemas';

export async function generatePaymentNumber(): Promise<string> {
  const rows = await db('supplier_payments')
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

  return `PAY-OUT-${(maxNum + 1).toString().padStart(5, '0')}`;
}

export async function createSupplierPayment(data: CreateSupplierPaymentInput, userId: string) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    const payment_number = await generatePaymentNumber();
    const isCheque = data.payment_method === 'CHEQUE' || data.payment_method === 'PDC';
    const chequeStatus = isCheque ? (data.cheque_status || 'PENDING') : 'CLEARED';

    const [payment] = await trx('supplier_payments').insert({
      ...data,
      bank_account_id: data.bank_account_id || null,
      cheque_number: data.cheque_number || null,
      cheque_bank_name: data.cheque_bank_name || null,
      cheque_due_date: data.cheque_due_date || null,
      cheque_status: chequeStatus,
      payment_number,
      created_by: userId,
    }).returning('*');

    // If linked to an invoice, cap allocation to remaining purchase invoice balance and insert supplier_payment_allocation
    if (data.purchase_invoice_id) {
      const invoice = await trx('purchase_invoices').where('id', data.purchase_invoice_id).first();
      if (invoice) {
        const allocRes = await trx('supplier_payment_allocations')
          .where('purchase_invoice_id', data.purchase_invoice_id)
          .sum('allocated_amount as total_allocated')
          .first();

        const currentAllocated = Number(allocRes?.total_allocated || 0);
        const invTotal = Number(invoice.total_amount || 0);
        const remainingUnpaid = Math.max(0, invTotal - currentAllocated);
        const allocatedAmount = Math.min(Number(data.amount), remainingUnpaid);

        if (allocatedAmount > 0) {
          await trx('supplier_payment_allocations').insert({
            payment_id: payment.id,
            purchase_invoice_id: data.purchase_invoice_id,
            allocated_amount: allocatedAmount,
          });
        }

        const newPaidAmount = currentAllocated + allocatedAmount;
        let newStatus = 'UNPAID';
        if (newPaidAmount >= invTotal) {
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

  // Count distinct invoice/payment groups for pagination
  const [{ count }] = await baseQuery.clone()
    .select(db.raw('COUNT(DISTINCT COALESCE(sp.purchase_invoice_id, sp.id)) as count'));
  const total = parseInt(String(count || 0), 10);

  const rows = await baseQuery
    .select(
      db.raw('COALESCE(sp.purchase_invoice_id, sp.id) as group_id'),
      'sp.supplier_id',
      's.name as supplier_name',
      's.code as supplier_code',
      's.city as city',
      's.city as supplier_city',
      'sp.purchase_invoice_id',
      'pi.invoice_number as purchase_invoice_number',
      db.raw('COALESCE(pi.total_amount, SUM(sp.amount)) as invoice_total_amount'),
      db.raw('SUM(sp.amount) as total_paid_against_invoice'),
      'pi.status as invoice_status',
      db.raw(`
        json_agg(
          json_build_object(
            'id', sp.id,
            'payment_no', sp.payment_number,
            'payment_number', sp.payment_number,
            'date', sp.payment_date,
            'payment_date', sp.payment_date,
            'method', sp.payment_method,
            'payment_method', sp.payment_method,
            'amount', sp.amount,
            'notes', sp.notes,
            'cheque_number', sp.cheque_number,
            'cheque_bank_name', sp.cheque_bank_name,
            'cheque_due_date', sp.cheque_due_date,
            'cheque_status', sp.cheque_status
          ) ORDER BY sp.payment_date DESC, sp.created_at DESC
        ) as payment_history
      `)
    )
    .groupByRaw('COALESCE(sp.purchase_invoice_id, sp.id), sp.supplier_id, s.name, s.code, s.city, sp.purchase_invoice_id, pi.invoice_number, pi.total_amount, pi.status')
    .orderBy(db.raw('MAX(sp.payment_date)'), 'desc')
    .limit(limit)
    .offset(offset);

  const purchaseInvoiceIds = rows
    .map((r: any) => r.purchase_invoice_id)
    .filter(Boolean);

  const rawPurchaseItems = purchaseInvoiceIds.length > 0
    ? await db('purchase_invoice_items as pii')
        .join('products as p', 'pii.product_id', 'p.id')
        .whereIn('pii.purchase_invoice_id', purchaseInvoiceIds)
        .select(
          'pii.id',
          'pii.purchase_invoice_id',
          'pii.product_id',
          'p.name as product_name',
          'p.size as product_size',
          'pii.quantity',
          'pii.selected_unit',
          'pii.unit_price',
          'pii.total_price'
        )
    : [];

  const lineItemsMap = new Map<string, any[]>();
  for (const item of rawPurchaseItems) {
    const list = lineItemsMap.get(item.purchase_invoice_id) || [];
    list.push({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_size: item.product_size,
      size: item.product_size,
      quantity: Number(item.quantity || 0),
      net_qty: Number(item.quantity || 0),
      selected_unit: item.selected_unit,
      unit_price: Number(item.unit_price || 0),
      total_price: Number(item.total_price || 0),
      total: Number(item.total_price || 0),
    });
    lineItemsMap.set(item.purchase_invoice_id, list);
  }

  const formattedRows = rows.map((r: any) => {
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
      purchase_id: r.purchase_invoice_id || r.group_id,
      purchase_invoice_id: r.purchase_invoice_id,
      purchase_invoice_number: r.purchase_invoice_number || 'Direct Payment',
      supplier_id: r.supplier_id,
      supplier_name: r.supplier_name,
      supplier_code: r.supplier_code,
      city: r.city || null,
      supplier_city: r.supplier_city || null,
      invoice_total_amount: Math.round(invoiceTotal * 100) / 100,
      total_paid_against_invoice: Math.round(totalPaid * 100) / 100,
      invoice_status: status,
      line_items: r.purchase_invoice_id ? (lineItemsMap.get(r.purchase_invoice_id) || []) : [],
      payment_history: Array.isArray(rawHistory) ? rawHistory.map((p: any) => ({
        ...p,
        amount: Number(p.amount)
      })) : []
    };
  });

  return { rows: formattedRows, total };
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

export async function clearSupplierCheque(paymentId: string): Promise<boolean> {
  const updated = await db('supplier_payments')
    .where('id', paymentId)
    .update({
      cheque_status: 'CLEARED',
      updated_at: db.fn.now(),
    });

  return updated > 0;
}
