import type { Knex } from 'knex';
import db from '../../db/knex';
import { CreatePaymentInput } from './payments.schemas';

export async function generateNextPaymentNumber(trx: Knex.Transaction | Knex = db): Promise<string> {
  const rows = await trx('customer_payments')
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
        payment_type: input.invoice_id ? 'INVOICE_SETTLEMENT' : 'ADVANCE_DEPOSIT',
        bank_account_id: input.bank_account_id || null,
        notes: input.notes || null,
        cheque_number: input.cheque_number || null,
        cheque_bank_name: input.cheque_bank_name || null,
        cheque_due_date: input.cheque_due_date || null,
        cheque_status: chequeStatus,
        created_by: userId || null,
      })
      .returning('*');

    // 1b. If PDC / Cheque, insert into incoming_pdcs table
    if (isCheque) {
      await trx('incoming_pdcs').insert({
        payment_id: payment.id,
        customer_id: input.customer_id,
        destination_bank_account_id: input.bank_account_id || null,
        cheque_number: input.cheque_number || 'CHQ-UNKNOWN',
        cheque_bank_name: input.cheque_bank_name || 'Customer Bank',
        cheque_due_date: input.cheque_due_date || input.payment_date,
        amount: input.amount,
        status: 'PENDING',
        notes: input.notes || null,
        created_by: userId || null,
      });
    }

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
        payment_type: 'INVOICE_SETTLEMENT',
        bank_account_id: null,
        notes: contraNotes,
        cheque_status: 'CLEARED',
        created_by: userId || null,
      });
    }

    // 3. If it's linked to an invoice, strictly cap allocation to remaining invoice balance and insert payment_allocation
    if (input.invoice_id) {
      const invoice = await trx('sales_invoices').where('id', input.invoice_id).first();
      if (!invoice) {
        throw new Error('Invoice not found');
      }

      const allocRes = await trx('payment_allocations')
        .where('invoice_id', input.invoice_id)
        .sum('allocated_amount as total_allocated')
        .first();

      const retRes = await trx('sales_invoices')
        .where('parent_invoice_id', input.invoice_id)
        .where(function() {
          this.where('invoice_type', 'CREDIT_NOTE')
            .orWhere('invoice_type', 'RETURN')
            .orWhere('invoice_number', 'like', 'CN-%');
        })
        .whereNot('status', 'CANCELLED')
        .sum('total_amount as total_returned')
        .first();

      const returnedTotal = Math.abs(Number(retRes?.total_returned || 0));
      const currentAllocated = Number(allocRes?.total_allocated || 0);
      const invTotal = Number(invoice.total_amount || 0);
      const netInvoiceTotal = invTotal - returnedTotal;
      const remainingUnpaid = Math.round((netInvoiceTotal - currentAllocated) * 100) / 100;

      if (remainingUnpaid <= 0 || Number(input.amount) > remainingUnpaid) {
        throw new Error('PAYMENT_EXCEEDS_BALANCE');
      }

      const allocatedAmount = Number(input.amount);
      if (allocatedAmount > 0) {
        await trx('payment_allocations').insert({
          payment_id: payment.id,
          invoice_id: input.invoice_id,
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

      await trx('sales_invoices')
        .where('id', input.invoice_id)
        .update({
          paid_amount: newPaidAmount,
          status: newStatus,
          updated_at: trx.fn.now(),
        });
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

  // 1. Fetch Invoices with their linked payments
  const invoicesQuery = db('sales_invoices as si')
    .join('customers as c', 'si.customer_id', 'c.id')
    .whereNot('si.status', 'CANCELLED')
    .modify((qb) => {
      if (customer_id) qb.where('si.customer_id', customer_id);
      if (invoice_id) qb.where('si.id', invoice_id);
      if (search) {
        qb.where((inner) => {
          inner.whereILike('si.invoice_number', `%${search}%`)
               .orWhereILike('c.name', `%${search}%`)
               .orWhereILike('c.code', `%${search}%`);
        });
      }
    })
    .select(
      'si.id as invoice_id',
      'si.parent_invoice_id',
      'si.invoice_number',
      'si.invoice_type',
      'si.total_amount',
      'si.paid_amount',
      'si.status as invoice_status',
      'si.date as invoice_date',
      'si.created_at',
      'c.id as customer_id',
      'c.name as customer_name',
      'c.code as customer_code',
      'c.city as city',
      'c.city as customer_city'
    )
    .orderBy('si.created_at', 'desc');

  const invoices = await invoicesQuery;
  const invoiceIds = invoices.map((inv: any) => inv.invoice_id);

  // 1a. Fetch incoming positive payments linked to these invoices
  const rawPayments = invoiceIds.length > 0
    ? await db('customer_payments')
        .whereIn('invoice_id', invoiceIds)
        .where('amount', '>', 0)
        .where('payment_method', '!=', 'CASH_REFUND')
        .whereNotIn('cheque_status', ['BOUNCED', 'FAILED'])
        .orderBy('created_at', 'asc')
    : [];

  const linkedPaymentsMap = new Map<string, any[]>();
  for (const p of rawPayments) {
    if (p.invoice_id) {
      const list = linkedPaymentsMap.get(p.invoice_id) || [];
      list.push({
        id: p.id,
        type: 'PAYMENT',
        payment_no: p.payment_number,
        payment_number: p.payment_number,
        date: p.payment_date,
        payment_date: p.payment_date,
        method: p.payment_method,
        payment_method: p.payment_method,
        amount: Math.abs(Number(p.amount || 0)),
        notes: p.notes,
        cheque_number: p.cheque_number,
        cheque_bank_name: p.cheque_bank_name,
        cheque_due_date: p.cheque_due_date,
        cheque_status: p.cheque_status,
        polarity: 'POSITIVE',
        display_type: 'Payment Received',
        created_at: p.created_at,
      });
      linkedPaymentsMap.set(p.invoice_id, list);
    }
  }

  // 1b. Fetch linked Credit Notes (sales_invoices where parent_invoice_id IN invoiceIds)
  const linkedCreditNotes = invoiceIds.length > 0
    ? await db('sales_invoices')
        .whereIn('parent_invoice_id', invoiceIds)
        .where('invoice_type', 'CREDIT_NOTE')
        .whereNot('status', 'CANCELLED')
        .select(
          'id',
          'parent_invoice_id',
          'invoice_number',
          'date',
          'total_amount',
          'return_reason',
          'notes',
          'created_at'
        )
        .orderBy('created_at', 'asc')
    : [];

  const linkedCreditNotesMap = new Map<string, any[]>();
  for (const cn of linkedCreditNotes) {
    if (cn.parent_invoice_id) {
      const list = linkedCreditNotesMap.get(cn.parent_invoice_id) || [];
      list.push({
        id: cn.id,
        type: 'CREDIT_NOTE',
        credit_note_number: cn.invoice_number,
        payment_no: cn.invoice_number,
        payment_number: cn.invoice_number,
        invoice_number: cn.invoice_number,
        date: cn.date,
        payment_date: cn.date,
        method: 'CREDIT_NOTE',
        payment_method: 'CREDIT_NOTE',
        amount: Math.abs(Number(cn.total_amount || 0)),
        notes: cn.notes || cn.return_reason || 'Goods Returned',
        return_reason: cn.return_reason,
        polarity: 'NEGATIVE',
        display_type: 'Goods Returned',
        created_at: cn.created_at,
      });
      linkedCreditNotesMap.set(cn.parent_invoice_id, list);
    }
  }

  // 1c. Fetch linked Cash Refunds (customer_payments linked to invoice via linked_invoice_id or invoice_id)
  const linkedRefunds = invoiceIds.length > 0
    ? await db('customer_payments')
        .where((qb) => {
          qb.whereIn('linked_invoice_id', invoiceIds)
            .orWhereIn('invoice_id', invoiceIds);
        })
        .andWhere((qb) => {
          qb.where('payment_method', 'CASH_REFUND')
            .orWhere('amount', '<', 0);
        })
        .whereNotIn('cheque_status', ['BOUNCED', 'FAILED'])
        .orderBy('created_at', 'asc')
    : [];

  const linkedRefundsMap = new Map<string, any[]>();
  for (const rf of linkedRefunds) {
    const parentId = rf.linked_invoice_id || rf.invoice_id;
    if (parentId) {
      const list = linkedRefundsMap.get(parentId) || [];
      list.push({
        id: rf.id,
        type: 'REFUND',
        payment_no: rf.payment_number,
        payment_number: rf.payment_number,
        date: rf.payment_date,
        payment_date: rf.payment_date,
        method: rf.payment_method || 'CASH_REFUND',
        payment_method: rf.payment_method || 'CASH_REFUND',
        amount: Math.abs(Number(rf.amount || 0)),
        notes: rf.notes || 'Cash Refunded to Customer',
        polarity: 'NEGATIVE',
        display_type: 'Cash Refunded to Customer',
        created_at: rf.created_at,
      });
      linkedRefundsMap.set(parentId, list);
    }
  }

  // 1d. Fetch line items for these invoices
  const rawLineItems = invoiceIds.length > 0
    ? await db('sales_invoice_items as sii')
        .join('products as p', 'sii.product_id', 'p.id')
        .whereIn('sii.invoice_id', invoiceIds)
        .select(
          'sii.id',
          'sii.invoice_id',
          'sii.product_id',
          'p.name as product_name',
          'p.size as product_size',
          'sii.quantity',
          'sii.selected_unit',
          'sii.actual_weight_per_unit',
          'sii.net_kg_processed',
          'sii.unit_price',
          'sii.total_price'
        )
    : [];

  const lineItemsMap = new Map<string, any[]>();
  for (const item of rawLineItems) {
    const list = lineItemsMap.get(item.invoice_id) || [];
    list.push({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_size: item.product_size,
      size: item.product_size,
      quantity: Number(item.quantity || 0),
      net_qty: Number(item.quantity || 0),
      selected_unit: item.selected_unit,
      actual_weight_per_unit: item.actual_weight_per_unit ? Number(item.actual_weight_per_unit) : null,
      net_kg_processed: item.net_kg_processed ? Number(item.net_kg_processed) : null,
      unit_price: Number(item.unit_price || 0),
      total_price: Number(item.total_price || 0),
      total: Number(item.total_price || 0),
    });
    lineItemsMap.set(item.invoice_id, list);
  }

  const invoiceResults = invoices.map((inv: any) => {
    const payments = linkedPaymentsMap.get(inv.invoice_id) || [];
    const creditNotes = linkedCreditNotesMap.get(inv.invoice_id) || [];
    const refunds = linkedRefundsMap.get(inv.invoice_id) || [];
    const lineItems = lineItemsMap.get(inv.invoice_id) || [];

    const totalPaid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const invoiceTotal = Math.abs(Number(inv.total_amount || 0));

    // Combine mixed items into chronological timeline
    const timeline = [...payments, ...creditNotes, ...refunds].sort((a, b) => {
      const timeA = new Date(a.created_at || a.date || a.payment_date || 0).getTime();
      const timeB = new Date(b.created_at || b.date || b.payment_date || 0).getTime();
      return timeA - timeB;
    });

    return {
      id: inv.invoice_id,
      sales_id: inv.invoice_id,
      invoice_id: inv.invoice_id,
      parent_invoice_id: inv.parent_invoice_id || null,
      invoice_number: inv.invoice_number,
      invoice_type: inv.invoice_type || 'SALE',
      type: inv.invoice_type || 'SALE',
      customer_id: inv.customer_id,
      customer_name: inv.customer_name,
      customer_code: inv.customer_code,
      city: inv.city || null,
      customer_city: inv.customer_city || null,
      original_total: Math.round(invoiceTotal * 100) / 100,
      invoice_total_amount: Math.round(invoiceTotal * 100) / 100,
      total_paid: Math.round(totalPaid * 100) / 100,
      total_paid_against_invoice: Math.round(totalPaid * 100) / 100,
      invoice_status: inv.invoice_status || 'UNPAID',
      line_items: lineItems,
      linked_credit_notes: creditNotes,
      linked_refunds: refunds,
      payment_history: timeline,
      created_at: inv.created_at,
    };
  });

  // 2. Fetch standalone Account Payments (where invoice_id IS NULL AND linked_invoice_id IS NULL)
  let standaloneResults: any[] = [];
  if (!invoice_id) {
    const standaloneQuery = db('customer_payments as p')
      .join('customers as c', 'p.customer_id', 'c.id')
      .whereNull('p.invoice_id')
      .whereNull('p.linked_invoice_id')
      .whereNotIn('p.cheque_status', ['BOUNCED', 'FAILED'])
      .modify((qb) => {
        if (customer_id) qb.where('p.customer_id', customer_id);
        if (search) {
          qb.where((inner) => {
            inner.whereILike('p.payment_number', `%${search}%`)
                 .orWhereILike('c.name', `%${search}%`)
                 .orWhereILike('c.code', `%${search}%`);
          });
        }
      })
      .select(
        'p.id',
        'p.payment_number',
        'p.payment_date',
        'p.payment_method',
        'p.amount',
        'p.notes',
        'p.cheque_number',
        'p.cheque_bank_name',
        'p.cheque_due_date',
        'p.cheque_status',
        'p.created_at',
        'c.id as customer_id',
        'c.name as customer_name',
        'c.code as customer_code',
        'c.city as city',
        'c.city as customer_city'
      )
      .orderBy('p.created_at', 'desc');

    const standalonePayments = await standaloneQuery;

    standaloneResults = standalonePayments.map((p: any) => {
      const amt = Number(p.amount || 0);
      const isRefund = p.payment_method === 'CASH_REFUND' || amt < 0;
      const historyItem = {
        id: p.id,
        type: isRefund ? 'REFUND' : 'PAYMENT',
        payment_no: p.payment_number,
        payment_number: p.payment_number,
        date: p.payment_date,
        payment_date: p.payment_date,
        method: p.payment_method,
        payment_method: p.payment_method,
        amount: Math.abs(amt),
        notes: p.notes,
        cheque_number: p.cheque_number,
        cheque_bank_name: p.cheque_bank_name,
        cheque_due_date: p.cheque_due_date,
        cheque_status: p.cheque_status,
        polarity: isRefund ? 'NEGATIVE' : 'POSITIVE',
        display_type: isRefund ? 'Cash Refunded to Customer' : 'Payment Received',
        created_at: p.created_at,
      };

      return {
        id: p.id,
        sales_id: p.id,
        invoice_id: null,
        parent_invoice_id: null,
        invoice_number: isRefund ? 'Cash Refund' : 'Account Payment',
        invoice_type: isRefund ? 'CASH_REFUND' : 'ACCOUNT_PAYMENT',
        type: isRefund ? 'CASH_REFUND' : 'ACCOUNT_PAYMENT',
        payment_method: p.payment_method,
        customer_id: p.customer_id,
        customer_name: p.customer_name,
        customer_code: p.customer_code,
        city: p.city || null,
        customer_city: p.customer_city || null,
        original_total: 0,
        invoice_total_amount: 0,
        total_paid: Math.round(amt * 100) / 100,
        total_paid_against_invoice: Math.round(amt * 100) / 100,
        invoice_status: isRefund ? 'REFUND' : 'ACCOUNT_PAYMENT',
        line_items: [],
        linked_credit_notes: [],
        linked_refunds: isRefund ? [historyItem] : [],
        payment_history: [historyItem],
        created_at: p.created_at,
      };
    });
  }

  // Combine invoices and standalone payments, sorted newest first
  const combined = [...invoiceResults, ...standaloneResults].sort(
    (a, b) => new Date(b.created_at || Date.now()).getTime() - new Date(a.created_at || Date.now()).getTime()
  );

  return combined;
}
