import db from '../../db/knex';
import { createPayment, generateNextPaymentNumber } from '../payments/payments.repository';

export interface IncomingPdcRow {
  id: string;
  payment_id: string | null;
  customer_id: string;
  customer_name?: string;
  customer_code?: string;
  destination_bank_account_id: string | null;
  destination_bank_name?: string;
  destination_account_title?: string;
  destination_account_number?: string;
  cheque_number: string;
  cheque_bank_name: string;
  cheque_due_date: string;
  amount: number;
  status: 'PENDING' | 'CLEARED' | 'BOUNCED';
  notes: string | null;
  payment_number?: string;
  invoice_id?: string | null;
  invoice_number?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CreateIncomingPdcInput {
  customer_id: string;
  amount: number;
  cheque_number: string;
  cheque_bank_name: string;
  cheque_due_date: string;
  payment_date?: string;
  invoice_id?: string | null;
  destination_bank_account_id?: string | null;
  notes?: string | null;
}

export async function findAllIncomingPdcs(status?: string): Promise<IncomingPdcRow[]> {
  const query = db('incoming_pdcs as p')
    .join('customers as c', 'p.customer_id', 'c.id')
    .leftJoin('bank_accounts as ba', 'p.destination_bank_account_id', 'ba.id')
    .leftJoin('customer_payments as cp', 'p.payment_id', 'cp.id')
    .leftJoin('sales_invoices as si', 'cp.invoice_id', 'si.id');

  if (status) {
    query.where('p.status', status);
  }

  const rows = await query.select(
    'p.id',
    'p.payment_id',
    'p.customer_id',
    'c.name as customer_name',
    'c.code as customer_code',
    'p.destination_bank_account_id',
    'ba.bank_name as destination_bank_name',
    'ba.account_title as destination_account_title',
    'ba.account_number as destination_account_number',
    'p.cheque_number',
    'p.cheque_bank_name',
    'p.cheque_due_date',
    'p.amount',
    'p.status',
    'p.notes',
    'cp.payment_number',
    'cp.invoice_id',
    'si.invoice_number',
    'p.created_at',
    'p.updated_at'
  ).orderBy('p.cheque_due_date', 'asc');

  return rows.map((r: any) => ({
    ...r,
    amount: Number(r.amount || 0),
  }));
}

export async function createIncomingPdc(
  input: CreateIncomingPdcInput,
  userId?: string
): Promise<IncomingPdcRow> {
  if (!input.customer_id) throw new Error('Customer is required');
  if (!input.amount || Number(input.amount) <= 0) throw new Error('Valid amount is required');
  if (!input.cheque_number?.trim()) throw new Error('Cheque number is required');
  if (!input.cheque_bank_name?.trim()) throw new Error('Cheque bank name is required');
  if (!input.cheque_due_date) throw new Error('Cheque due date is required');

  const paymentNumber = await generateNextPaymentNumber();
  const paymentId = await createPayment(
    {
      customer_id: input.customer_id,
      amount: Number(input.amount),
      payment_method: 'CHEQUE',
      payment_date: input.payment_date || new Date().toISOString().split('T')[0],
      invoice_id: input.invoice_id || null,
      bank_account_id: input.destination_bank_account_id || null,
      notes: input.notes || null,
      cheque_number: input.cheque_number.trim(),
      cheque_bank_name: input.cheque_bank_name.trim(),
      cheque_due_date: input.cheque_due_date,
      cheque_status: 'PENDING',
    },
    paymentNumber,
    userId
  );

  const pdc = await db('incoming_pdcs as p')
    .join('customers as c', 'p.customer_id', 'c.id')
    .leftJoin('bank_accounts as ba', 'p.destination_bank_account_id', 'ba.id')
    .leftJoin('customer_payments as cp', 'p.payment_id', 'cp.id')
    .leftJoin('sales_invoices as si', 'cp.invoice_id', 'si.id')
    .where('p.payment_id', paymentId)
    .select(
      'p.id',
      'p.payment_id',
      'p.customer_id',
      'c.name as customer_name',
      'c.code as customer_code',
      'p.destination_bank_account_id',
      'ba.bank_name as destination_bank_name',
      'ba.account_title as destination_account_title',
      'ba.account_number as destination_account_number',
      'p.cheque_number',
      'p.cheque_bank_name',
      'p.cheque_due_date',
      'p.amount',
      'p.status',
      'p.notes',
      'cp.payment_number',
      'cp.invoice_id',
      'si.invoice_number',
      'p.created_at',
      'p.updated_at'
    )
    .first();

  if (!pdc) {
    throw new Error('Failed to create incoming PDC');
  }

  return {
    ...pdc,
    amount: Number(pdc.amount || 0),
  };
}

export async function clearIncomingPdc(pdcId: string, bankAccountId?: string): Promise<IncomingPdcRow> {
  return await db.transaction(async (trx) => {
    const pdc = await trx('incoming_pdcs').where('id', pdcId).first();
    if (!pdc) {
      throw new Error('Incoming PDC not found');
    }

    if (pdc.status !== 'PENDING') {
      throw new Error(`Cannot clear cheque with status: ${pdc.status}`);
    }

    const destinationBankId = bankAccountId || pdc.destination_bank_account_id;

    // Credit bank balance & record bank transaction if destination bank account is specified
    if (destinationBankId) {
      await trx('bank_accounts')
        .where('id', destinationBankId)
        .increment('current_balance', pdc.amount);

      await trx('bank_transactions').insert({
        bank_account_id: destinationBankId,
        transaction_type: 'DEPOSIT',
        type: 'INFLOW',
        amount: pdc.amount,
        source_type: 'PAYMENT',
        source: 'PAYMENT',
        reference_id: pdc.payment_id || pdc.id,
        description: `Cheque Cleared: #${pdc.cheque_number} (${pdc.cheque_bank_name})`,
        transaction_date: trx.fn.now(),
        category: 'SALES',
        created_by: pdc.created_by || null,
      });
    }

    const [updatedPdc] = await trx('incoming_pdcs')
      .where('id', pdcId)
      .update({
        status: 'CLEARED',
        destination_bank_account_id: destinationBankId || pdc.destination_bank_account_id,
        updated_at: trx.fn.now(),
      })
      .returning('*');

    if (pdc.payment_id) {
      await trx('customer_payments')
        .where('id', pdc.payment_id)
        .update({
          cheque_status: 'CLEARED',
          bank_account_id: destinationBankId || pdc.destination_bank_account_id,
          updated_at: trx.fn.now(),
        });
    }

    return {
      ...updatedPdc,
      amount: Number(updatedPdc.amount || 0),
    };
  });
}

export async function bounceIncomingPdc(pdcId: string, bounceReason?: string): Promise<IncomingPdcRow> {
  return await db.transaction(async (trx) => {
    const pdc = await trx('incoming_pdcs').where('id', pdcId).first();
    if (!pdc) {
      throw new Error('Incoming PDC not found');
    }

    if (pdc.status === 'BOUNCED') {
      throw new Error('Cheque is already marked as BOUNCED');
    }

    const wasCleared = pdc.status === 'CLEARED';

    // 1. If cheque was previously CLEARED and deposited into a bank account, reverse bank balance & transaction
    if (wasCleared && pdc.destination_bank_account_id) {
      await trx('bank_accounts')
        .where('id', pdc.destination_bank_account_id)
        .decrement('current_balance', pdc.amount);

      await trx('bank_transactions').insert({
        bank_account_id: pdc.destination_bank_account_id,
        transaction_type: 'WITHDRAWAL',
        type: 'OUTFLOW',
        amount: pdc.amount,
        source_type: 'PAYMENT',
        source: 'PAYMENT',
        reference_id: pdc.payment_id || pdc.id,
        description: `Cheque Bounced Reversal: #${pdc.cheque_number} (${pdc.cheque_bank_name})`,
        transaction_date: trx.fn.now(),
        category: 'SALES',
        created_by: pdc.created_by || null,
      });
    }

    // 2. Mark incoming_pdcs as BOUNCED and log note
    const noteAppend = bounceReason ? ` | BOUNCED: ${bounceReason}` : ' | Dishonored / Bounced by bank';
    const updatedNotes = pdc.notes ? `${pdc.notes}${noteAppend}` : (bounceReason || 'Dishonored / Bounced by bank');

    const [updatedPdc] = await trx('incoming_pdcs')
      .where('id', pdcId)
      .update({
        status: 'BOUNCED',
        notes: updatedNotes,
        updated_at: trx.fn.now(),
      })
      .returning('*');

    // 3. Mark customer_payments as BOUNCED and restore unpaid invoice debt
    if (pdc.payment_id) {
      await trx('customer_payments')
        .where('id', pdc.payment_id)
        .update({
          cheque_status: 'BOUNCED',
          notes: db.raw("COALESCE(notes, '') || ?", [noteAppend]),
          updated_at: trx.fn.now(),
        });

      // Find all payment allocations for this payment and restore invoice debt
      const allocations = await trx('payment_allocations').where('payment_id', pdc.payment_id);
      const handledInvoiceIds = new Set<string>();

      for (const alloc of allocations) {
        handledInvoiceIds.add(alloc.invoice_id);
        const invoice = await trx('sales_invoices').where('id', alloc.invoice_id).first();
        if (invoice) {
          const otherAllocRes = await trx('payment_allocations')
            .where('invoice_id', alloc.invoice_id)
            .whereNot('payment_id', pdc.payment_id)
            .sum('allocated_amount as total')
            .first();

          const remainingPaid = Math.max(0, Math.round(Number(otherAllocRes?.total || 0) * 100) / 100);
          const invTotal = Number(invoice.total_amount || 0);

          let newStatus = 'UNPAID';
          if (remainingPaid >= invTotal) {
            newStatus = 'PAID';
          } else if (remainingPaid > 0) {
            newStatus = 'PARTIAL';
          }

          await trx('sales_invoices')
            .where('id', alloc.invoice_id)
            .update({
              paid_amount: remainingPaid,
              status: newStatus,
              updated_at: trx.fn.now(),
            });
        }
      }

      // Delete the allocations for this bounced payment so customer balance and invoice balance reflect the debt
      await trx('payment_allocations').where('payment_id', pdc.payment_id).delete();

      // Check if payment had invoice_id directly that wasn't in allocations table
      const payRow = await trx('customer_payments').where('id', pdc.payment_id).first();
      if (payRow?.invoice_id && !handledInvoiceIds.has(payRow.invoice_id)) {
        const invoice = await trx('sales_invoices').where('id', payRow.invoice_id).first();
        if (invoice) {
          const remainingPaid = Math.max(0, Math.round((Number(invoice.paid_amount || 0) - Number(pdc.amount || 0)) * 100) / 100);
          const invTotal = Number(invoice.total_amount || 0);
          let newStatus = 'UNPAID';
          if (remainingPaid >= invTotal) {
            newStatus = 'PAID';
          } else if (remainingPaid > 0) {
            newStatus = 'PARTIAL';
          }

          await trx('sales_invoices')
            .where('id', payRow.invoice_id)
            .update({
              paid_amount: remainingPaid,
              status: newStatus,
              updated_at: trx.fn.now(),
            });
        }
      }
    }

    return {
      ...updatedPdc,
      amount: Number(updatedPdc.amount || 0),
    };
  });
}
