import type { Knex } from 'knex';
import db from '../../db/knex';
import { CreateSupplierInput, UpdateSupplierInput, SupplierQuery } from './suppliers.schemas';

export interface SupplierRow {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  payment_terms: number;
  opening_payable: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SupplierWithBalance extends SupplierRow {
  outstanding_payable: number;
  advance_payable: number;
  net_balance: number;
  outstanding_balance: number;
  total_billed_liability?: number;
  sum_purchase_invoice?: number;
  sum_debit_note?: number;
}

export interface SupplierLedgerEntry {
  id: string;
  source_id?: string;
  date: string;
  type: 'OPENING_BALANCE' | 'INVOICE' | 'PAYMENT' | 'RETURN' | 'CREDIT_NOTE' | 'ADVANCE_DEPOSIT' | 'CASH_REFUND';
  reference_no?: string;
  reference: string;
  debit: number; // For suppliers, paying them is a debit
  credit: number; // For suppliers, getting an invoice is a credit
  running_balance?: number;
  balance: number;
  payment_method?: string | null;
  notes?: string | null;
}

/**
 * Generate the next supplier code: SUPP-NNNN.
 */
export async function generateSupplierCode(trx: Knex.Transaction | Knex = db): Promise<string> {
  const rows = await trx('suppliers')
    .where('code', 'like', 'SUPP-%')
    .select('code');

  let maxNum = 0;
  for (const r of rows) {
    if (r.code && r.code.startsWith('SUPP-')) {
      const numPart = r.code.replace('SUPP-', '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `SUPP-${String(maxNum + 1).padStart(4, '0')}`;
}

export interface SupplierBalanceDetails {
  opening_payable: number;
  total_billed: number;
  total_billed_liability: number;
  sum_purchase_invoice: number;
  sum_debit_note: number;
  total_paid: number;
  total_allocated_to_invoices: number;
  total_allocated_from_payments: number;
  net_balance: number;
  outstanding_payable: number;
  advance_payable: number;
}

/**
 * Global Netting Formula for Supplier Balance:
 * total_billed_liability = SUM(PURCHASE_INVOICE) - SUM(DEBIT_NOTE) + opening_payable.
 * The supplier's outstanding balance drops.
 * If the supplier was already fully paid, this dynamically pushes the excess cash into the Supplier's Advance Wallet.
 */
export async function computeSupplierNetBalance(
  supplierId: string,
  trx: Knex.Transaction | Knex = db,
): Promise<SupplierBalanceDetails> {
  const supplier = await trx('suppliers')
    .where({ id: supplierId })
    .select('opening_payable')
    .first<{ opening_payable: number }>();

  if (!supplier) {
    return {
      opening_payable: 0,
      total_billed: 0,
      total_billed_liability: 0,
      sum_purchase_invoice: 0,
      sum_debit_note: 0,
      total_paid: 0,
      total_allocated_to_invoices: 0,
      total_allocated_from_payments: 0,
      net_balance: 0,
      outstanding_payable: 0,
      advance_payable: 0,
    };
  }

  const opening_payable = Number(supplier.opening_payable || 0);

  const [billedRes, returnsRes, paidRes, allocToInvoicesRes, allocFromPaymentsRes] = await Promise.all([
    // Query 1 (SUM(PURCHASE_INVOICE)): Total Billed Standard Purchase Invoices
    trx('purchase_invoices')
      .where('supplier_id', supplierId)
      .whereNot('status', 'CANCELLED')
      .where((qb) => {
        qb.whereNull('invoice_type')
          .orWhereNotIn('invoice_type', ['DEBIT_NOTE', 'RETURN']);
      })
      .where('total_amount', '>', 0)
      .select(trx.raw('SUM(ABS(total_amount)) as total'))
      .first<{ total: string | number | null }>(),

    // Query 2 (SUM(DEBIT_NOTE)): Total Debit Notes / Returns
    trx('purchase_invoices')
      .where('supplier_id', supplierId)
      .whereNot('status', 'CANCELLED')
      .where((qb) => {
        qb.whereIn('invoice_type', ['DEBIT_NOTE', 'RETURN'])
          .orWhere('total_amount', '<', 0);
      })
      .select(trx.raw('SUM(ABS(total_amount)) as total'))
      .first<{ total: string | number | null }>(),

    // Query 3 (Total Paid): All raw supplier payments except BOUNCED, FAILED, and synthetic WALLET_ADVANCE
    trx('supplier_payments')
      .where('supplier_id', supplierId)
      .whereNotIn('cheque_status', ['BOUNCED', 'FAILED'])
      .where((qb) => {
        qb.whereNull('payment_method')
          .orWhereNot('payment_method', 'WALLET_ADVANCE');
      })
      .select(trx.raw('SUM(amount) as total'))
      .first<{ total: string | number | null }>(),

    // Query 4 (Total Allocated to Invoices): Allocations tied to non-cancelled purchase invoices
    trx('supplier_payment_allocations as spa')
      .join('purchase_invoices as pi', 'spa.purchase_invoice_id', 'pi.id')
      .where('pi.supplier_id', supplierId)
      .whereNot('pi.status', 'CANCELLED')
      .sum('spa.allocated_amount as total_allocated')
      .first<{ total_allocated: string | number | null }>(),

    // Query 5 (Total Allocated from Payments): Allocations tied to supplier payments
    trx('supplier_payment_allocations as spa')
      .join('supplier_payments as sp', 'spa.payment_id', 'sp.id')
      .where('sp.supplier_id', supplierId)
      .whereNotIn('sp.cheque_status', ['BOUNCED', 'FAILED'])
      .sum('spa.allocated_amount as total_allocated')
      .first<{ total_allocated: string | number | null }>(),
  ]);

  const sum_purchase_invoice = Number(billedRes?.total || 0);
  const sum_debit_note = Number(returnsRes?.total || 0);
  const total_paid = Math.round(Number(paidRes?.total || 0) * 100) / 100;

  // ── Global Netting Formula ──
  // total_billed_liability = SUM(PURCHASE_INVOICE) - SUM(DEBIT_NOTE)
  const net_invoiced = Math.max(0, sum_purchase_invoice - sum_debit_note);
  const total_billed_liability = Math.round((opening_payable + net_invoiced) * 100) / 100;

  const total_allocated_to_invoices = Number(allocToInvoicesRes?.total_allocated || 0);
  const total_allocated_from_payments = Number(allocFromPaymentsRes?.total_allocated || 0);

  // ── Dynamic Advance Push & Outstanding Reduction ──
  // The supplier's outstanding balance drops.
  // If the supplier was already fully paid, this dynamically pushes the excess cash into the Supplier's Advance Wallet.
  let outstanding_payable = 0;
  let advance_payable = 0;

  if (total_paid >= total_billed_liability) {
    outstanding_payable = 0;
    advance_payable = Math.round((total_paid - total_billed_liability) * 100) / 100;
  } else {
    outstanding_payable = Math.round((total_billed_liability - total_paid) * 100) / 100;
    advance_payable = 0;
  }

  const net_balance = Math.round((outstanding_payable - advance_payable) * 100) / 100;

  return {
    opening_payable,
    total_billed: total_billed_liability,
    total_billed_liability,
    sum_purchase_invoice,
    sum_debit_note,
    total_paid,
    total_allocated_to_invoices,
    total_allocated_from_payments,
    net_balance,
    outstanding_payable,
    advance_payable,
  };
}

/**
 * Compute outstanding payable for a single supplier.
 */
export async function computeOutstandingPayable(supplierId: string): Promise<number> {
  const details = await computeSupplierNetBalance(supplierId);
  return details.outstanding_payable;
}

export async function findAllSuppliers(query: SupplierQuery): Promise<{
  rows: SupplierWithBalance[];
  total: number;
}> {
  const { page, limit, search, city, region, is_active } = query;
  const offset = (page - 1) * limit;

  const baseQuery = db('suppliers').modify((qb) => {
    if (search) {
      qb.where((inner) => {
        inner
          .whereILike('name', `%${search}%`)
          .orWhereILike('phone', `%${search}%`)
          .orWhereILike('code', `%${search}%`);
      });
    }
    if (city) qb.whereILike('city', `%${city}%`);
    if (region) qb.where({ region });
    if (is_active !== undefined) qb.where({ is_active });
    else qb.where({ is_active: true });
  });

  const [{ count }] = await baseQuery.clone().count<[{ count: string }]>('id as count');
  const total = parseInt(count, 10);

  const rows = await baseQuery
    .clone()
    .select('*')
    .orderBy('name', 'asc')
    .limit(limit)
    .offset(offset);

  const withBalance: SupplierWithBalance[] = await Promise.all(
    rows.map(async (r: SupplierRow) => {
      const details = await computeSupplierNetBalance(r.id);
      return {
        ...r,
        total_billed_liability: details.total_billed_liability,
        sum_purchase_invoice: details.sum_purchase_invoice,
        sum_debit_note: details.sum_debit_note,
        outstanding_payable: details.outstanding_payable,
        advance_payable: details.advance_payable,
        net_balance: details.net_balance,
        outstanding_balance: details.outstanding_payable,
      };
    })
  );

  return { rows: withBalance, total };
}

export async function findSupplierById(id: string): Promise<SupplierWithBalance | undefined> {
  const row = await db('suppliers').where({ id }).first<SupplierRow>();
  if (!row) return undefined;
  const details = await computeSupplierNetBalance(id);
  return {
    ...row,
    total_billed_liability: details.total_billed_liability,
    sum_purchase_invoice: details.sum_purchase_invoice,
    sum_debit_note: details.sum_debit_note,
    outstanding_payable: details.outstanding_payable,
    advance_payable: details.advance_payable,
    net_balance: details.net_balance,
    outstanding_balance: details.outstanding_payable,
  };
}

export async function createSupplier(
  data: CreateSupplierInput,
  createdBy?: string,
): Promise<SupplierWithBalance> {
  return await db.transaction(async (trx) => {
    const code = await generateSupplierCode(trx);

    const openingAdvance = Number(data.opening_advance || 0);
    const openingPayable = openingAdvance > 0 ? 0 : Number(data.opening_payable ?? data.opening_balance ?? 0);

    const [row] = await trx('suppliers')
      .insert({
        code,
        name: data.name,
        phone: data.phone ?? null,
        email: data.email || null,
        address: data.address ?? null,
        city: data.city ?? null,
        region: data.region ?? null,
        payment_terms: data.payment_terms,
        opening_payable: openingPayable,
        notes: data.notes ?? null,
        created_by: createdBy,
      })
      .returning('*');

    if (openingAdvance > 0) {
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
      const paymentNumber = `PAY-OUT-${(maxNum + 1).toString().padStart(5, '0')}`;

      await trx('supplier_payments').insert({
        supplier_id: row.id,
        purchase_invoice_id: null,
        payment_number: paymentNumber,
        payment_date: new Date(),
        amount: openingAdvance,
        payment_method: 'DAY_ZERO_ADVANCE',
        notes: 'Day Zero Supplier Wallet Seed',
        created_by: createdBy || null,
      });

      // CRITICAL: Do not insert any corresponding row into supplier_payment_allocations!
    }

    const details = await computeSupplierNetBalance(row.id, trx);
    return {
      ...row,
      outstanding_payable: details.outstanding_payable,
      advance_payable: details.advance_payable,
      net_balance: details.net_balance,
      outstanding_balance: details.outstanding_payable,
    };
  });
}

export async function updateSupplier(
  id: string,
  data: UpdateSupplierInput,
): Promise<SupplierWithBalance | undefined> {
  const [row] = await db('suppliers')
    .where({ id })
    .update({ ...data, email: data.email || null, updated_at: new Date() })
    .returning('*');

  if (!row) return undefined;
  const details = await computeSupplierNetBalance(id);
  return {
    ...row,
    outstanding_payable: details.outstanding_payable,
    advance_payable: details.advance_payable,
    net_balance: details.net_balance,
    outstanding_balance: details.outstanding_payable,
  };
}

export async function softDeleteSupplier(id: string): Promise<boolean> {
  const count = await db('suppliers').where({ id }).update({ is_active: false, updated_at: new Date() });
  return count > 0;
}

export async function getSupplierStatement(id: string): Promise<SupplierLedgerEntry[]> {
  const supplier = await db('suppliers').where({ id }).first();
  if (!supplier) return [];

  const rawEntries: Array<{
    id: string;
    source_id: string;
    raw_date: Date;
    date: string;
    type: 'INVOICE' | 'CREDIT_NOTE' | 'PAYMENT' | 'ADVANCE_DEPOSIT' | 'CASH_REFUND' | 'OPENING_BALANCE';
    reference_no: string;
    reference: string;
    debit: number;
    credit: number;
    payment_method: string | null;
    notes: string | null;
  }> = [];

  // 1. Purchase Invoices & Debit Notes (Returns)
  const invoices = await db('purchase_invoices')
    .where('supplier_id', id)
    .whereNot('status', 'CANCELLED')
    .select('id', 'date', 'invoice_number', 'total_amount', 'invoice_type', 'notes', 'created_at');

  for (const inv of invoices) {
    const total = Number(inv.total_amount);
    const isDebitNote = inv.invoice_type === 'DEBIT_NOTE' || total < 0;
    const invDate = inv.date ? new Date(inv.date) : (inv.created_at ? new Date(inv.created_at) : new Date());

    if (isDebitNote) {
      const positiveAmt = Math.abs(total);
      rawEntries.push({
        id: inv.id,
        source_id: inv.id,
        raw_date: invDate,
        date: invDate.toISOString(),
        type: 'CREDIT_NOTE',
        reference_no: inv.invoice_number,
        reference: inv.invoice_number,
        debit: positiveAmt, // Reduces liability
        credit: 0,
        payment_method: null,
        notes: inv.notes || 'Purchase Return / Debit Note',
      });
    } else {
      rawEntries.push({
        id: inv.id,
        source_id: inv.id,
        raw_date: invDate,
        date: invDate.toISOString(),
        type: 'INVOICE',
        reference_no: inv.invoice_number,
        reference: inv.invoice_number,
        debit: 0,
        credit: total, // Increases liability
        payment_method: null,
        notes: inv.notes || null,
      });
    }
  }

  // 2. Supplier Payments, Advances & Cash Refunds
  const payments = await db('supplier_payments')
    .where('supplier_id', id)
    .select('id', 'payment_date', 'payment_number', 'amount', 'payment_type', 'payment_method', 'notes', 'created_at');

  for (const pay of payments) {
    const amt = Number(pay.amount);
    const payDate = pay.payment_date ? new Date(pay.payment_date) : (pay.created_at ? new Date(pay.created_at) : new Date());

    if (pay.payment_type === 'CASH_REFUND' || amt < 0) {
      // Cash Refund from supplier: increases our liability / decreases advance
      rawEntries.push({
        id: pay.id,
        source_id: pay.id,
        raw_date: payDate,
        date: payDate.toISOString(),
        type: 'CASH_REFUND',
        reference_no: pay.payment_number,
        reference: pay.payment_number,
        debit: 0,
        credit: Math.abs(amt),
        payment_method: pay.payment_method || null,
        notes: pay.notes || 'Cash Refund from Supplier',
      });
    } else if (pay.payment_type === 'ADVANCE_DEPOSIT') {
      // Advance to Supplier: reduces liability / creates advance credit
      rawEntries.push({
        id: pay.id,
        source_id: pay.id,
        raw_date: payDate,
        date: payDate.toISOString(),
        type: 'ADVANCE_DEPOSIT',
        reference_no: pay.payment_number,
        reference: pay.payment_number,
        debit: amt,
        credit: 0,
        payment_method: pay.payment_method || null,
        notes: pay.notes || 'Advance Deposit to Supplier',
      });
    } else {
      // Supplier Payment
      rawEntries.push({
        id: pay.id,
        source_id: pay.id,
        raw_date: payDate,
        date: payDate.toISOString(),
        type: 'PAYMENT',
        reference_no: pay.payment_number,
        reference: pay.payment_number,
        debit: amt,
        credit: 0,
        payment_method: pay.payment_method || null,
        notes: pay.notes || null,
      });
    }
  }

  // 3. Chronological Sorting: sort by date ASC
  const sortedTransactions = rawEntries.sort((a, b) => {
    const diff = a.raw_date.getTime() - b.raw_date.getTime();
    if (diff !== 0) return diff;
    if (a.type === 'INVOICE' && b.type !== 'INVOICE') return -1;
    if (a.type !== 'INVOICE' && b.type === 'INVOICE') return 1;
    return 0;
  });

  // 4. Opening Payable row (if exists) & running balance math engine
  const statement: SupplierLedgerEntry[] = [];
  let running_balance = 0;

  const openingPayable = Number(supplier.opening_payable || 0);
  if (openingPayable !== 0) {
    const suppDate = supplier.created_at ? new Date(supplier.created_at) : new Date();
    const firstTxDate = sortedTransactions.length > 0 ? sortedTransactions[0].raw_date : null;
    const openingDate = firstTxDate && firstTxDate.getTime() < suppDate.getTime() ? firstTxDate : suppDate;
    const credit = openingPayable > 0 ? openingPayable : 0;
    const debit = openingPayable < 0 ? Math.abs(openingPayable) : 0;
    running_balance = credit - debit;

    statement.push({
      id: 'opening',
      source_id: 'opening',
      date: openingDate.toISOString(),
      type: 'OPENING_BALANCE',
      reference_no: 'OPENING-PAY',
      reference: 'Opening Payable',
      debit,
      credit,
      running_balance,
      balance: running_balance,
      payment_method: null,
      notes: 'Initial opening payable',
    });
  }

  // Loop through array to calculate running_balance: (Previous Balance + Credit - Debit)
  for (const t of sortedTransactions) {
    running_balance = running_balance + t.credit - t.debit;
    statement.push({
      id: t.id,
      source_id: t.source_id,
      date: t.date,
      type: t.type,
      reference_no: t.reference_no,
      reference: t.reference,
      debit: t.debit,
      credit: t.credit,
      running_balance,
      balance: running_balance,
      payment_method: t.payment_method,
      notes: t.notes,
    });
  }

  return statement;
}

export async function getSupplierLedger(id: string): Promise<SupplierLedgerEntry[]> {
  return await getSupplierStatement(id);
}

export interface RefundableCreditSource {
  id: string;
  type: 'OVERPAID_INVOICE' | 'ADVANCE';
  reference: string;
  available_credit: number;
  date: string;
}

export async function getSupplierRefundableCredits(supplierId: string): Promise<RefundableCreditSource[]> {
  const supplier = await db('suppliers').where({ id: supplierId }).first();
  if (!supplier) return [];

  const creditSources: RefundableCreditSource[] = [];

  // 1. Query Overpaid Invoices: Fetch purchase invoices where (amount_paid - net_total) > 0
  const purchaseInvoices = await db('purchase_invoices as pi')
    .where('pi.supplier_id', supplierId)
    .whereNot('pi.status', 'CANCELLED')
    .where((qb) => {
      qb.whereNull('pi.invoice_type')
        .orWhereNotIn('pi.invoice_type', ['DEBIT_NOTE', 'RETURN']);
    })
    .where('pi.total_amount', '>', 0)
    .select('pi.id', 'pi.invoice_number', 'pi.total_amount', 'pi.paid_amount', 'pi.amount_paid', 'pi.date', 'pi.created_at');

  const invoiceIds = purchaseInvoices.map((inv) => inv.id);

  if (invoiceIds.length > 0) {
    const debitNotes = await db('purchase_invoices')
      .whereIn('parent_invoice_id', invoiceIds)
      .where(function() {
        this.whereIn('invoice_type', ['DEBIT_NOTE', 'RETURN'])
          .orWhere('invoice_number', 'like', 'DN-%');
      })
      .whereNot('status', 'CANCELLED')
      .select('parent_invoice_id', 'total_amount');

    const returnedByInvoice = new Map<string, number>();
    for (const dn of debitNotes) {
      if (dn.parent_invoice_id) {
        const prev = returnedByInvoice.get(dn.parent_invoice_id) || 0;
        returnedByInvoice.set(dn.parent_invoice_id, prev + Math.abs(Number(dn.total_amount || 0)));
      }
    }

    const linkedRefunds = await db('supplier_payments')
      .whereIn('purchase_invoice_id', invoiceIds)
      .where((qb) => {
        qb.where('payment_type', 'CASH_REFUND')
          .orWhere('payment_method', 'CASH_REFUND')
          .orWhere('amount', '<', 0);
      })
      .select('purchase_invoice_id', 'amount');

    const refundedByInvoice = new Map<string, number>();
    for (const rf of linkedRefunds) {
      if (rf.purchase_invoice_id) {
        const prev = refundedByInvoice.get(rf.purchase_invoice_id) || 0;
        refundedByInvoice.set(rf.purchase_invoice_id, prev + Math.abs(Number(rf.amount || 0)));
      }
    }

    for (const inv of purchaseInvoices) {
      const originalTotal = Number(inv.total_amount || 0);
      const returnedTotal = returnedByInvoice.get(inv.id) || 0;
      const netTotal = Math.round((originalTotal - returnedTotal) * 100) / 100;
      const alreadyRefunded = refundedByInvoice.get(inv.id) || 0;
      const amountPaid = Math.max(0, Number(inv.paid_amount || inv.amount_paid || 0) - alreadyRefunded);

      const overpayment = Math.round((amountPaid - netTotal) * 100) / 100;
      if (overpayment > 0) {
        const invDate = inv.date ? new Date(inv.date) : (inv.created_at ? new Date(inv.created_at) : new Date());
        creditSources.push({
          id: inv.id,
          type: 'OVERPAID_INVOICE',
          reference: inv.invoice_number,
          available_credit: overpayment,
          date: invDate.toISOString().split('T')[0],
        });
      }
    }
  }

  // 2. Query Advance Deposits: Fetch payments where payment_type = 'ADVANCE_DEPOSIT' or purchase_invoice_id is null that have not been fully consumed
  const advancePayments = await db('supplier_payments')
    .where('supplier_id', supplierId)
    .where((qb) => {
      qb.where('payment_type', 'ADVANCE_DEPOSIT')
        .orWhere('payment_type', 'ADVANCE')
        .orWhereNull('purchase_invoice_id');
    })
    .whereNotIn('cheque_status', ['BOUNCED', 'FAILED'])
    .where('amount', '>', 0)
    .where((qb) => {
      qb.whereNull('payment_method')
        .orWhereNot('payment_method', 'WALLET_ADVANCE');
    })
    .select('id', 'payment_number', 'amount', 'payment_date', 'notes', 'created_at');

  const advancePaymentIds = advancePayments.map((p) => p.id);

  const hasAllocationsTable = await db.schema.hasTable('supplier_payment_allocations');
  const allocations = (hasAllocationsTable && advancePaymentIds.length > 0)
    ? await db('supplier_payment_allocations')
        .whereIn('payment_id', advancePaymentIds)
        .select('payment_id', 'allocated_amount')
    : [];

  const allocatedByPayment = new Map<string, number>();
  for (const alloc of allocations) {
    const prev = allocatedByPayment.get(alloc.payment_id) || 0;
    allocatedByPayment.set(alloc.payment_id, prev + Number(alloc.allocated_amount || 0));
  }

  const advanceRefunds = await db('supplier_payments')
    .where('supplier_id', supplierId)
    .where((qb) => {
      qb.where('payment_type', 'CASH_REFUND')
        .orWhere('payment_method', 'CASH_REFUND')
        .orWhere('amount', '<', 0);
    })
    .select('notes', 'amount');

  for (const pay of advancePayments) {
    const totalAmount = Number(pay.amount || 0);
    const allocatedAmount = allocatedByPayment.get(pay.id) || 0;

    let refundedFromPay = 0;
    if (pay.payment_number) {
      for (const rf of advanceRefunds) {
        if (rf.notes && rf.notes.includes(pay.payment_number)) {
          refundedFromPay += Math.abs(Number(rf.amount || 0));
        }
      }
    }

    const unallocated = Math.round((totalAmount - allocatedAmount - refundedFromPay) * 100) / 100;
    if (unallocated > 0) {
      const payDate = pay.payment_date ? new Date(pay.payment_date) : (pay.created_at ? new Date(pay.created_at) : new Date());
      creditSources.push({
        id: pay.id,
        type: 'ADVANCE',
        reference: pay.payment_number || 'Advance Payment',
        available_credit: unallocated,
        date: payDate.toISOString().split('T')[0],
      });
    }
  }

  // 3. Fallback: If supplier has advance_payable in balance not covered by individual records, include it as general wallet advance
  const balanceDetails = await computeSupplierNetBalance(supplierId);
  const currentTotal = creditSources.reduce((sum, s) => sum + s.available_credit, 0);
  const leftoverAdvance = Math.round((balanceDetails.advance_payable - currentTotal) * 100) / 100;
  if (leftoverAdvance > 0 && creditSources.length === 0) {
    const suppDate = supplier.created_at ? new Date(supplier.created_at) : new Date();
    creditSources.push({
      id: 'supplier-wallet-advance',
      type: 'ADVANCE',
      reference: 'Advance Wallet Deposit',
      available_credit: leftoverAdvance,
      date: suppDate.toISOString().split('T')[0],
    });
  }

  // Return combined array sorted by date (chronological ASC)
  return creditSources.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

