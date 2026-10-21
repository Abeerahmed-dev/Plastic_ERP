import type { Knex } from 'knex';
import db from '../../db/knex';
import { CreateCustomerInput, UpdateCustomerInput, CustomerQuery } from './customers.schemas';

export interface CustomerRow {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  customer_type: 'CASH' | 'CREDIT';
  credit_limit: number;
  opening_balance: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerWithBalance extends CustomerRow {
  outstanding?: number;
  outstanding_balance: number;
  advance?: number;
  advance_credit: number;
  net_balance: number;
  total_billed?: number;
  total_returned?: number;
  total_paid?: number;
  net_lifetime_volume_kg: number;
}

/**
  * Generate the next customer code: CUST-NNNN.
  * Uses MAX on the numeric suffix for safety.
  */
export async function generateCustomerCode(trx: Knex.Transaction | Knex = db): Promise<string> {
  const rows = await trx('customers')
    .where('code', 'like', 'CUST-%')
    .select('code');

  let maxNum = 0;
  for (const r of rows) {
    if (r.code && r.code.startsWith('CUST-') && r.code !== 'CUST-WALKIN') {
      const numPart = r.code.replace('CUST-', '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `CUST-${String(maxNum + 1).padStart(4, '0')}`;
}

export interface CustomerBalanceDetails {
  opening_balance: number;
  total_billed: number;
  total_returned: number;
  total_paid: number;
  total_allocated_to_invoices: number;
  total_allocated_from_payments: number;
  net_balance: number;
  outstanding: number;
  outstanding_balance: number;
  advance: number;
  advance_credit: number;
}

/**
 * Compute decoupled balance for a single customer using explicit allocation sums.
 * Outstanding = total_billed - total_allocated_to_invoices
 * Advance = total_paid - total_allocated_from_payments
 */
export async function computeCustomerNetBalance(
  customerId: string,
  trx: Knex.Transaction | Knex = db,
): Promise<CustomerBalanceDetails> {
  const customer = await trx('customers')
    .where({ id: customerId })
    .select('opening_balance')
    .first<{ opening_balance: number }>();

  if (!customer) {
    return {
      opening_balance: 0,
      total_billed: 0,
      total_returned: 0,
      total_paid: 0,
      total_allocated_to_invoices: 0,
      total_allocated_from_payments: 0,
      net_balance: 0,
      outstanding: 0,
      outstanding_balance: 0,
      advance: 0,
      advance_credit: 0,
    };
  }

  const opening_balance = Number(customer.opening_balance || 0);

  const [
    billedResult,
    returnedResult,
    allocToInvoicesResult,
    paidResult,
    allocFromPaymentsResult,
  ] = await Promise.all([
    // Query A (Total Billed Invoices/POS): SUM(total_amount) from sales_invoices where customer_id = X (Exclude CREDIT_NOTEs)
    trx('sales_invoices')
      .where('customer_id', customerId)
      .whereNot('status', 'CANCELLED')
      .where((qb) => {
        qb.whereNull('invoice_type')
          .orWhereNotIn('invoice_type', ['CREDIT_NOTE', 'RETURN']);
      })
      .where('total_amount', '>', 0)
      .sum('total_amount as total_billed')
      .first<{ total_billed: string | number | null }>(),

    // Query Returns (Total Returned): SUM(ABS(total_amount)) where invoice_type = 'CREDIT_NOTE' / 'RETURN'
    trx('sales_invoices')
      .where('customer_id', customerId)
      .whereNot('status', 'CANCELLED')
      .where((qb) => {
        qb.whereIn('invoice_type', ['CREDIT_NOTE', 'RETURN'])
          .orWhere('total_amount', '<', 0);
      })
      .select(trx.raw('SUM(ABS(CAST(COALESCE(total_amount, 0) AS NUMERIC))) as total_returned'))
      .first<{ total_returned: string | number | null }>(),

    // Query C (Total Allocated to Invoices): Allocations tied to non-cancelled invoices
    trx('payment_allocations as pa')
      .join('sales_invoices as si', 'pa.invoice_id', 'si.id')
      .where('si.customer_id', customerId)
      .whereNot('si.status', 'CANCELLED')
      .sum('pa.allocated_amount as total_allocated')
      .first<{ total_allocated: string | number | null }>(),

    // Query B (Total Raw Paid): All raw customer payments received (excluding BOUNCED, FAILED, and synthetic WALLET_ADVANCE)
    trx('customer_payments')
      .where('customer_id', customerId)
      .whereNotIn('cheque_status', ['BOUNCED', 'FAILED'])
      .where((qb) => {
        qb.whereNull('payment_method')
          .orWhereNot('payment_method', 'WALLET_ADVANCE');
      })
      .sum('amount as total_paid')
      .first<{ total_paid: string | number | null }>(),

    // Query D (Total Allocated from Payments): Allocations tied to customer payments
    trx('payment_allocations as pa')
      .join('customer_payments as cp', 'pa.payment_id', 'cp.id')
      .where('cp.customer_id', customerId)
      .whereNotIn('cp.cheque_status', ['BOUNCED', 'FAILED'])
      .sum('pa.allocated_amount as total_allocated')
      .first<{ total_allocated: string | number | null }>(),
  ]);

  const rawBilled = Number(billedResult?.total_billed || 0);
  const totalReturned = Number(returnedResult?.total_returned || 0);
  const totalBilled = Math.max(0, Math.round(((opening_balance + rawBilled) - totalReturned) * 100) / 100);

  const totalAllocatedToInvoices = Number(allocToInvoicesResult?.total_allocated || 0);
  const totalPaid = Math.round(Number(paidResult?.total_paid || 0) * 100) / 100;
  const totalAllocatedFromPayments = Number(allocFromPaymentsResult?.total_allocated || 0);

  // The New Split Math:
  // customer.outstanding = total_billed - total_allocated_to_invoices
  // customer.advance_credit = total_paid - total_allocated_from_payments
  const outstanding = Math.max(0, Math.round((totalBilled - totalAllocatedToInvoices) * 100) / 100);
  const advance_credit = Math.max(0, Math.round((totalPaid - totalAllocatedFromPayments) * 100) / 100);
  const netBalance = Math.round((outstanding - advance_credit) * 100) / 100;

  return {
    opening_balance,
    total_billed: totalBilled,
    total_returned: totalReturned,
    total_paid: totalPaid,
    total_allocated_to_invoices: totalAllocatedToInvoices,
    total_allocated_from_payments: totalAllocatedFromPayments,
    net_balance: netBalance,
    outstanding,
    outstanding_balance: outstanding,
    advance: advance_credit,
    advance_credit,
  };
}

/**
 * Compute outstanding balance for a single customer.
 */
export async function computeOutstandingBalance(customerId: string): Promise<number> {
  const details = await computeCustomerNetBalance(customerId);
  return details.outstanding_balance;
}

/**
 * Compute net lifetime volume (KG) for a single customer (sales minus returns).
 */
export async function computeNetLifetimeVolumeKg(customerId: string): Promise<number> {
  const result = await db('sales_invoices as si')
    .join('sales_invoice_items as sii', 'si.id', 'sii.invoice_id')
    .where('si.customer_id', customerId)
    .select(
      db.raw(`
        SUM(
          CASE 
            WHEN si.invoice_type = 'CREDIT_NOTE' OR sii.quantity < 0 THEN -ABS(sii.net_kg_processed)
            ELSE ABS(sii.net_kg_processed)
          END
        ) as net_volume
      `)
    )
    .first();

  return Math.max(0, Number(result?.net_volume || 0));
}

/**
 * List customers with pagination, search, and filters using isolated Promise.all aggregate queries.
 * Stops all multi-table JOINs to prevent Cartesian fan-out and type mixing.
 */
export async function findAllCustomers(query: CustomerQuery): Promise<{
  rows: CustomerWithBalance[];
  total: number;
}> {
  const { page, limit, search, city, customer_type, region, is_active } = query;
  const offset = (page - 1) * limit;

  const baseQuery = db('customers').modify((qb) => {
    if (search) {
      qb.where((inner) => {
        inner
          .whereILike('customers.name', `%${search}%`)
          .orWhereILike('customers.phone', `%${search}%`)
          .orWhereILike('customers.code', `%${search}%`);
      });
    }
    if (city) qb.whereILike('customers.city', `%${city}%`);
    if (customer_type) qb.where({ 'customers.customer_type': customer_type });
    if (region) qb.where({ 'customers.region': region });
    if (is_active !== undefined) qb.where({ 'customers.is_active': is_active });
    else qb.where({ 'customers.is_active': true });
  });

  const [{ count }] = await baseQuery.clone().count<[{ count: string }]>('customers.id as count');
  const total = parseInt(count, 10);

  // Pure isolated select on customers table only — NO JOINs
  const rawCustomers = await baseQuery
    .clone()
    .select('customers.*')
    .orderBy('customers.name', 'asc')
    .limit(limit)
    .offset(offset);

  const rows: CustomerWithBalance[] = await Promise.all(
    rawCustomers.map(async (customer: any) => {
      const details = await computeCustomerNetBalance(customer.id);
      const net_lifetime_volume_kg = await computeNetLifetimeVolumeKg(customer.id);

      return {
        id: customer.id,
        code: customer.code,
        name: customer.name,
        phone: customer.phone ?? null,
        email: customer.email ?? null,
        address: customer.address ?? null,
        city: customer.city ?? null,
        region: customer.region ?? null,
        customer_type: customer.customer_type,
        credit_limit: Number(customer.credit_limit || 0),
        opening_balance: Number(customer.opening_balance || 0),
        is_active: customer.is_active,
        notes: customer.notes ?? null,
        created_by: customer.created_by ?? null,
        created_at: customer.created_at,
        updated_at: customer.updated_at,
        outstanding: details.outstanding_balance,
        outstanding_balance: details.outstanding_balance,
        advance: details.advance_credit,
        advance_credit: details.advance_credit,
        net_balance: details.net_balance,
        total_billed: details.total_billed,
        total_returned: details.total_returned,
        total_paid: details.total_paid,
        net_lifetime_volume_kg,
      };
    })
  );

  return { rows, total };
}

/**
 * Find a single customer by ID with balance and net volume.
 */
export async function findCustomerById(id: string): Promise<CustomerWithBalance | undefined> {
  const row = await db('customers').where({ id }).first<CustomerRow>();
  if (!row) return undefined;

  const details = await computeCustomerNetBalance(id);
  const net_lifetime_volume_kg = await computeNetLifetimeVolumeKg(id);
  return {
    ...row,
    outstanding: details.outstanding_balance,
    outstanding_balance: details.outstanding_balance,
    advance: details.advance_credit,
    advance_credit: details.advance_credit,
    net_balance: details.net_balance,
    total_billed: details.total_billed,
    total_returned: details.total_returned,
    total_paid: details.total_paid,
    net_lifetime_volume_kg,
  };
}

/**
 * Create a customer. Code is generated here before insert.
 */
export async function createCustomer(
  data: CreateCustomerInput,
  createdBy: string,
): Promise<CustomerWithBalance> {
  return await db.transaction(async (trx) => {
    const code = await generateCustomerCode(trx);

    const openingAdvance = Number(data.opening_advance || 0);
    // If opening_advance > 0, do not touch the customer's outstanding legacy balance column
    const openingBalance = openingAdvance > 0 ? 0 : Number(data.opening_balance || 0);

    const [row] = await trx('customers')
      .insert({
        code,
        name: data.name,
        phone: data.phone ?? null,
        email: data.email || null,
        address: data.address ?? null,
        city: data.city ?? null,
        region: data.region ?? null,
        customer_type: data.customer_type || 'CREDIT',
        credit_limit: data.credit_limit,
        opening_balance: openingBalance,
        notes: data.notes ?? null,
        created_by: createdBy,
      })
      .returning('*');

    if (openingAdvance > 0) {
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
      const paymentNumber = `RCV-${(maxNum + 1).toString().padStart(5, '0')}`;

      await trx('customer_payments').insert({
        customer_id: row.id,
        invoice_id: null,
        payment_number: paymentNumber,
        payment_date: new Date(),
        amount: openingAdvance,
        payment_method: 'DAY_ZERO_ADVANCE',
        notes: 'Day Zero Customer Wallet Seed',
        created_by: createdBy || null,
      });

      // CRITICAL: Do not insert any corresponding row into payment_allocations
    }

    const details = await computeCustomerNetBalance(row.id, trx);
    return {
      ...row,
      outstanding_balance: details.outstanding_balance,
      advance_credit: details.advance_credit,
      net_balance: details.net_balance,
      net_lifetime_volume_kg: 0,
    };
  });
}

/**
 * Update a customer's editable fields.
 */
export async function updateCustomer(
  id: string,
  data: UpdateCustomerInput,
): Promise<CustomerWithBalance | undefined> {
  const [row] = await db('customers')
    .where({ id })
    .update({
      ...data,
      email: data.email || null,
      updated_at: new Date(),
    })
    .returning('*');

  if (!row) return undefined;
  const outstanding_balance = await computeOutstandingBalance(id);
  return { ...row, outstanding_balance };
}

/**
 * Soft-delete: set is_active = false.
 * Hard deletes are blocked — customers may have financial history.
 */
export async function softDeleteCustomer(id: string): Promise<boolean> {
  const count = await db('customers').where({ id }).update({ is_active: false, updated_at: new Date() });
  return count > 0;
}

export interface StatementEntry {
  id: string;
  source_id?: string;
  date: string;
  type: 'INVOICE' | 'CREDIT_NOTE' | 'PAYMENT' | 'ADVANCE_DEPOSIT' | 'CASH_REFUND' | 'OPENING_BALANCE';
  reference_no: string;
  reference: string;
  debit: number;
  credit: number;
  running_balance: number;
  balance: number;
  payment_method?: string | null;
  notes?: string | null;
}

export type LedgerEntry = StatementEntry;

export async function getCustomerStatement(id: string, trx: Knex.Transaction | Knex = db): Promise<StatementEntry[]> {
  const customer = await trx('customers').where({ id }).first();
  if (!customer) return [];

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

  // 1. Invoices & Credit Notes
  const invoices = await trx('sales_invoices')
    .where('customer_id', id)
    .whereNot('status', 'CANCELLED')
    .select('id', 'date', 'invoice_number', 'total_amount', 'invoice_type', 'notes', 'created_at');

  for (const inv of invoices) {
    const total = Number(inv.total_amount);
    const isCreditNote = inv.invoice_type === 'CREDIT_NOTE' || total < 0;
    const invDate = inv.date ? new Date(inv.date) : (inv.created_at ? new Date(inv.created_at) : new Date());

    if (isCreditNote) {
      const positiveAmt = Math.abs(total);
      rawEntries.push({
        id: inv.id,
        source_id: inv.id,
        raw_date: invDate,
        date: invDate.toISOString(),
        type: 'CREDIT_NOTE',
        reference_no: inv.invoice_number,
        reference: inv.invoice_number,
        debit: 0,
        credit: positiveAmt,
        payment_method: null,
        notes: inv.notes || 'Sales Return / Credit Note',
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
        debit: total,
        credit: 0,
        payment_method: null,
        notes: inv.notes || null,
      });
    }
  }

  // 2. Customer Payments, Advances & Cash Refunds
  const payments = await trx('customer_payments')
    .where('customer_id', id)
    .select('id', 'payment_date', 'payment_number', 'amount', 'payment_type', 'payment_method', 'notes', 'cheque_status', 'created_at');

  for (const pay of payments) {
    const amt = Number(pay.amount);
    const payDate = pay.payment_date ? new Date(pay.payment_date) : (pay.created_at ? new Date(pay.created_at) : new Date());

    if (pay.cheque_status === 'BOUNCED') {
      rawEntries.push({
        id: pay.id,
        source_id: pay.id,
        raw_date: payDate,
        date: payDate.toISOString(),
        type: 'PAYMENT',
        reference_no: `${pay.payment_number} (BOUNCED)`,
        reference: `${pay.payment_number} (BOUNCED)`,
        debit: 0,
        credit: 0,
        payment_method: pay.payment_method || null,
        notes: 'Bounced Cheque',
      });
      continue;
    }

    if (pay.payment_type === 'CASH_REFUND' || amt < 0) {
      // Cash Refund: debit: amount, credit: 0
      rawEntries.push({
        id: pay.id,
        source_id: pay.id,
        raw_date: payDate,
        date: payDate.toISOString(),
        type: 'CASH_REFUND',
        reference_no: pay.payment_number,
        reference: pay.payment_number,
        debit: Math.abs(amt),
        credit: 0,
        payment_method: pay.payment_method || null,
        notes: pay.notes || 'Cash Refund from Advance Wallet',
      });
    } else if (pay.payment_type === 'ADVANCE_DEPOSIT') {
      // Advance Deposit: debit: 0, credit: amount
      rawEntries.push({
        id: pay.id,
        source_id: pay.id,
        raw_date: payDate,
        date: payDate.toISOString(),
        type: 'ADVANCE_DEPOSIT',
        reference_no: pay.payment_number,
        reference: pay.payment_number,
        debit: 0,
        credit: amt,
        payment_method: pay.payment_method || null,
        notes: pay.notes || 'Advance Deposit to Wallet',
      });
    } else {
      // Payment (Receipt): debit: 0, credit: amount
      rawEntries.push({
        id: pay.id,
        source_id: pay.id,
        raw_date: payDate,
        date: payDate.toISOString(),
        type: 'PAYMENT',
        reference_no: pay.payment_number,
        reference: pay.payment_number,
        debit: 0,
        credit: amt,
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

  // 4. Opening Balance row (if exists) & running balance math engine
  const statement: StatementEntry[] = [];
  let running_balance = 0;

  const openingBal = Number(customer.opening_balance || 0);
  if (openingBal !== 0) {
    const custDate = customer.created_at ? new Date(customer.created_at) : new Date();
    const firstTxDate = sortedTransactions.length > 0 ? sortedTransactions[0].raw_date : null;
    const openingDate = firstTxDate && firstTxDate.getTime() < custDate.getTime() ? firstTxDate : custDate;
    const debit = openingBal > 0 ? openingBal : 0;
    const credit = openingBal < 0 ? Math.abs(openingBal) : 0;
    running_balance = debit - credit;

    statement.push({
      id: 'opening',
      source_id: 'opening',
      date: openingDate.toISOString(),
      type: 'OPENING_BALANCE',
      reference_no: 'OPENING-BAL',
      reference: 'Opening Balance',
      debit,
      credit,
      running_balance,
      balance: running_balance,
      payment_method: null,
      notes: 'Initial opening balance',
    });
  }

  // Loop through the array to calculate the running_balance. (Previous Balance + Debit - Credit)
  for (const t of sortedTransactions) {
    running_balance = running_balance + t.debit - t.credit;
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

export async function getCustomerLedger(id: string): Promise<LedgerEntry[]> {
  return await getCustomerStatement(id);
}

export interface RefundableCreditSource {
  id: string;
  type: 'OVERPAID_INVOICE' | 'ADVANCE';
  reference: string;
  available_credit: number;
  date: string;
}

export async function getCustomerRefundableCredits(
  customerId: string,
  trx: Knex.Transaction | Knex = db
): Promise<RefundableCreditSource[]> {
  const customer = await trx('customers').where({ id: customerId }).first();
  if (!customer) return [];

  const creditSources: RefundableCreditSource[] = [];

  // 1. Query Overpaid Invoices: Fetch sales invoices where (amount_paid - net_total) > 0
  const salesInvoices = await trx('sales_invoices as si')
    .where('si.customer_id', customerId)
    .whereNot('si.status', 'CANCELLED')
    .where((qb) => {
      qb.whereNull('si.invoice_type')
        .orWhereNotIn('si.invoice_type', ['CREDIT_NOTE', 'RETURN']);
    })
    .where('si.total_amount', '>', 0)
    .select('si.id', 'si.invoice_number', 'si.total_amount', 'si.paid_amount', 'si.date', 'si.created_at');

  const invoiceIds = salesInvoices.map((inv) => inv.id);

  if (invoiceIds.length > 0) {
    const creditNotes = await trx('sales_invoices')
      .whereIn('parent_invoice_id', invoiceIds)
      .where(function () {
        this.whereIn('invoice_type', ['CREDIT_NOTE', 'RETURN'])
          .orWhere('invoice_number', 'like', 'CN-%');
      })
      .whereNot('status', 'CANCELLED')
      .select('parent_invoice_id', 'total_amount');

    const returnedByInvoice = new Map<string, number>();
    for (const cn of creditNotes) {
      if (cn.parent_invoice_id) {
        const prev = returnedByInvoice.get(cn.parent_invoice_id) || 0;
        returnedByInvoice.set(cn.parent_invoice_id, prev + Math.abs(Number(cn.total_amount || 0)));
      }
    }

    const linkedRefunds = await trx('customer_payments')
      .where((qb) => {
        qb.whereIn('linked_invoice_id', invoiceIds)
          .orWhereIn('invoice_id', invoiceIds);
      })
      .andWhere((qb) => {
        qb.where('payment_type', 'CASH_REFUND')
          .orWhere('payment_method', 'CASH_REFUND')
          .orWhere('amount', '<', 0);
      })
      .select('linked_invoice_id', 'invoice_id', 'amount');

    const refundedByInvoice = new Map<string, number>();
    for (const rf of linkedRefunds) {
      const invId = rf.linked_invoice_id || rf.invoice_id;
      if (invId) {
        const prev = refundedByInvoice.get(invId) || 0;
        refundedByInvoice.set(invId, prev + Math.abs(Number(rf.amount || 0)));
      }
    }

    for (const inv of salesInvoices) {
      const originalTotal = Math.abs(Number(inv.total_amount || 0));
      const returnedTotal = returnedByInvoice.get(inv.id) || 0;
      const netTotal = Math.round((originalTotal - returnedTotal) * 100) / 100;
      const alreadyRefunded = refundedByInvoice.get(inv.id) || 0;
      const paidAmount = Math.max(0, Number(inv.paid_amount || 0) - alreadyRefunded);

      const overpayment = Math.round((paidAmount - netTotal) * 100) / 100;
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

  // 2. Query Advance Deposits: Fetch payments where payment_type = 'ADVANCE_DEPOSIT' or (invoice_id is null and linked_invoice_id is null) that have unconsumed balances
  const advancePayments = await trx('customer_payments')
    .where('customer_id', customerId)
    .where((qb) => {
      qb.where('payment_type', 'ADVANCE_DEPOSIT')
        .orWhere('payment_type', 'ADVANCE')
        .orWhere((inner) => {
          inner.whereNull('invoice_id').whereNull('linked_invoice_id');
        });
    })
    .whereNotIn('cheque_status', ['BOUNCED', 'FAILED'])
    .where('amount', '>', 0)
    .where((qb) => {
      qb.whereNull('payment_method')
        .orWhereNot('payment_method', 'WALLET_ADVANCE');
    })
    .select('id', 'payment_number', 'amount', 'payment_date', 'notes', 'created_at');

  const advancePaymentIds = advancePayments.map((p) => p.id);

  const hasAllocationsTable = await trx.schema.hasTable('payment_allocations');
  const allocations = (hasAllocationsTable && advancePaymentIds.length > 0)
    ? await trx('payment_allocations')
        .whereIn('payment_id', advancePaymentIds)
        .select('payment_id', 'allocated_amount')
    : [];

  const allocatedByPayment = new Map<string, number>();
  for (const alloc of allocations) {
    const prev = allocatedByPayment.get(alloc.payment_id) || 0;
    allocatedByPayment.set(alloc.payment_id, prev + Number(alloc.allocated_amount || 0));
  }

  const advanceRefunds = await trx('customer_payments')
    .where('customer_id', customerId)
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

  // 3. Fallback: If customer has advance_credit in balance not covered by individual records, include it as general wallet advance
  const balanceDetails = await computeCustomerNetBalance(customerId, trx);
  const currentTotal = creditSources.reduce((sum, s) => sum + s.available_credit, 0);
  const leftoverAdvance = Math.round((balanceDetails.advance_credit - currentTotal) * 100) / 100;
  if (leftoverAdvance > 0 && creditSources.length === 0) {
    const custDate = customer.created_at ? new Date(customer.created_at) : new Date();
    creditSources.push({
      id: 'customer-wallet-advance',
      type: 'ADVANCE',
      reference: 'Advance Wallet Deposit',
      available_credit: leftoverAdvance,
      date: custDate.toISOString().split('T')[0],
    });
  }

  // Return combined array sorted by date (chronological ASC)
  return creditSources.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}


