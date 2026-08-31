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
  credit_limit: number;
  opening_balance: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerWithBalance extends CustomerRow {
  outstanding_balance: number;
}

/**
 * Generate the next customer code: CUST-NNNN.
 * Uses MAX on the numeric suffix for safety.
 */
export async function generateCustomerCode(): Promise<string> {
  const result = await db('customers')
    .max('code as max_code')
    .first<{ max_code: string | null }>();

  if (!result?.max_code) {
    return 'CUST-0001';
  }

  const parts = result.max_code.split('-');
  const num = parseInt(parts[1] ?? '0', 10);
  return `CUST-${String(num + 1).padStart(4, '0')}`;
}

/**
 * Compute outstanding balance for a single customer.
 * Session 03: only opening_balance.
 * Sessions 08/09/13 will add sales/payments/returns to this query.
 */
export async function computeOutstandingBalance(customerId: string): Promise<number> {
  const customer = await db('customers').where({ id: customerId }).select('opening_balance').first<{ opening_balance: number }>();
  if (!customer) return 0;

  let balance = Number(customer.opening_balance);

  // Sum of Invoices
  const invoices = await db('sales_invoices')
    .where('customer_id', customerId)
    .sum('total_amount as total_invoiced')
    .first();
    
  if (invoices && invoices.total_invoiced) {
    balance += Number(invoices.total_invoiced);
  }

  // Sum of Payments
  const payments = await db('customer_payments')
    .where('customer_id', customerId)
    .sum('amount as total_paid')
    .first();
    
  if (payments && payments.total_paid) {
    balance -= Number(payments.total_paid);
  }

  return balance;
}

/**
 * List customers with pagination, search, and filters.
 */
export async function findAllCustomers(query: CustomerQuery): Promise<{
  rows: CustomerWithBalance[];
  total: number;
}> {
  const { page, limit, search, city, region, is_active } = query;
  const offset = (page - 1) * limit;

  const baseQuery = db('customers').modify((qb) => {
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
    else qb.where({ is_active: true }); // default: active only
  });

  const [{ count }] = await baseQuery.clone().count<[{ count: string }]>('id as count');
  const total = parseInt(count, 10);

  const rows = await baseQuery
    .clone()
    .select('*')
    .orderBy('name', 'asc')
    .limit(limit)
    .offset(offset);

  // Attach outstanding_balance for each row
  // Dynamically compute balance based on opening balance, sales invoices, and payments
  const withBalance: CustomerWithBalance[] = await Promise.all(
    rows.map(async (r: CustomerRow) => {
      const outstanding_balance = await computeOutstandingBalance(r.id);
      return {
        ...r,
        outstanding_balance,
      };
    })
  );

  return { rows: withBalance, total };
}

/**
 * Find a single customer by ID with balance.
 */
export async function findCustomerById(id: string): Promise<CustomerWithBalance | undefined> {
  const row = await db('customers').where({ id }).first<CustomerRow>();
  if (!row) return undefined;

  const outstanding_balance = await computeOutstandingBalance(id);
  return { ...row, outstanding_balance };
}

/**
 * Create a customer. Code is generated here before insert.
 */
export async function createCustomer(
  data: CreateCustomerInput,
  createdBy: string,
): Promise<CustomerWithBalance> {
  const code = await generateCustomerCode();

  const [row] = await db('customers')
    .insert({
      code,
      name: data.name,
      phone: data.phone ?? null,
      email: data.email || null,
      address: data.address ?? null,
      city: data.city ?? null,
      region: data.region ?? null,
      credit_limit: data.credit_limit,
      opening_balance: data.opening_balance,
      notes: data.notes ?? null,
      created_by: createdBy,
    })
    .returning('*');

  return { ...row, outstanding_balance: Number(row.opening_balance) };
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

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'INVOICE' | 'PAYMENT' | 'OPENING_BALANCE';
  reference: string;
  debit: number;  // increases balance
  credit: number; // decreases balance
  balance: number;
}

export async function getCustomerLedger(id: string): Promise<LedgerEntry[]> {
  const customer = await db('customers').where({ id }).first();
  if (!customer) return [];

  const ledger: LedgerEntry[] = [];
  let runningBalance = Number(customer.opening_balance);

  // 1. Opening Balance Entry
  ledger.push({
    id: 'opening',
    date: customer.created_at.toISOString(),
    type: 'OPENING_BALANCE',
    reference: 'Opening Balance',
    debit: runningBalance >= 0 ? runningBalance : 0,
    credit: runningBalance < 0 ? Math.abs(runningBalance) : 0,
    balance: runningBalance
  });

  // 2. Fetch Invoices
  const invoices = await db('sales_invoices')
    .where('customer_id', id)
    .select('id', 'date', 'invoice_number', 'total_amount');
    
  const invoiceEntries = invoices.map(inv => ({
    id: inv.id,
    date: new Date(inv.date).toISOString(),
    type: 'INVOICE' as const,
    reference: inv.invoice_number,
    debit: Number(inv.total_amount),
    credit: 0
  }));

  // 3. Fetch Payments
  const payments = await db('customer_payments')
    .where('customer_id', id)
    .select('id', 'payment_date', 'payment_number', 'amount');

  const paymentEntries = payments.map(pay => ({
    id: pay.id,
    date: new Date(pay.payment_date).toISOString(),
    type: 'PAYMENT' as const,
    reference: pay.payment_number,
    debit: 0,
    credit: Number(pay.amount)
  }));

  // Combine and sort by date ASC
  const transactions = [...invoiceEntries, ...paymentEntries].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Calculate running balances
  for (const t of transactions) {
    runningBalance = runningBalance + t.debit - t.credit;
    ledger.push({
      ...t,
      balance: runningBalance
    });
  }

  return ledger;
}

