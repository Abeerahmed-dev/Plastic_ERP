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
  outstanding_balance: number;
}

export interface SupplierLedgerEntry {
  id: string;
  date: string;
  type: 'OPENING_BALANCE' | 'INVOICE' | 'PAYMENT' | 'RETURN';
  reference: string;
  debit: number; // For suppliers, paying them is a debit
  credit: number; // For suppliers, getting an invoice is a credit
  balance: number;
}

/**
 * Generate the next supplier code: SUPP-NNNN.
 */
export async function generateSupplierCode(): Promise<string> {
  const result = await db('suppliers')
    .max('code as max_code')
    .first<{ max_code: string | null }>();

  if (!result?.max_code) {
    return 'SUPP-0001';
  }

  const parts = result.max_code.split('-');
  const num = parseInt(parts[1] ?? '0', 10);
  return `SUPP-${String(num + 1).padStart(4, '0')}`;
}

/**
 * Compute outstanding payable for a single supplier.
 * Session 03: only opening_payable.
 * Sessions 07/09/13 will add purchases/payments/returns.
 */
export async function computeOutstandingPayable(supplierId: string): Promise<number> {
  const supplier = await db('suppliers').where({ id: supplierId }).select('opening_payable').first<{ opening_payable: number }>();
  if (!supplier) return 0;
  
  let balance = Number(supplier.opening_payable);
  
  // Sum of Purchase Invoices
  const invoices = await db('purchase_invoices')
    .where('supplier_id', supplierId)
    .sum('total_amount as total_invoiced')
    .first();
    
  if (invoices && invoices.total_invoiced) {
    balance += Number(invoices.total_invoiced);
  }
  
  // Subtract Supplier Payments
  const payments = await db('supplier_payments')
    .where('supplier_id', supplierId)
    .sum('amount as total_paid')
    .first();
    
  if (payments && payments.total_paid) {
    balance -= Number(payments.total_paid);
  }
  
  return balance;
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
      const outstanding_payable = await computeOutstandingPayable(r.id);
      return {
        ...r,
        outstanding_payable,
        outstanding_balance: outstanding_payable,
      };
    })
  );

  return { rows: withBalance, total };
}

export async function findSupplierById(id: string): Promise<SupplierWithBalance | undefined> {
  const row = await db('suppliers').where({ id }).first<SupplierRow>();
  if (!row) return undefined;
  const outstanding_payable = await computeOutstandingPayable(id);
  return { ...row, outstanding_payable, outstanding_balance: outstanding_payable };
}

export async function createSupplier(
  data: CreateSupplierInput,
  createdBy: string,
): Promise<SupplierWithBalance> {
  const code = await generateSupplierCode();

  const [row] = await db('suppliers')
    .insert({
      code,
      name: data.name,
      phone: data.phone ?? null,
      email: data.email || null,
      address: data.address ?? null,
      city: data.city ?? null,
      region: data.region ?? null,
      payment_terms: data.payment_terms,
      opening_payable: data.opening_payable,
      notes: data.notes ?? null,
      created_by: createdBy,
    })
    .returning('*');

  const balance = Number(row.opening_payable);
  return { ...row, outstanding_payable: balance, outstanding_balance: balance };
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
  const outstanding_payable = await computeOutstandingPayable(id);
  return { ...row, outstanding_payable, outstanding_balance: outstanding_payable };
}

export async function softDeleteSupplier(id: string): Promise<boolean> {
  const count = await db('suppliers').where({ id }).update({ is_active: false, updated_at: new Date() });
  return count > 0;
}

export async function getSupplierLedger(id: string): Promise<SupplierLedgerEntry[]> {
  const supplier = await db('suppliers').where({ id }).first();
  if (!supplier) return [];

  const ledger: SupplierLedgerEntry[] = [];
  let runningBalance = Number(supplier.opening_payable);

  // 1. Opening Payable Entry
  ledger.push({
    id: 'opening',
    date: supplier.created_at.toISOString(),
    type: 'OPENING_BALANCE',
    reference: 'Opening Payable',
    debit: 0,
    credit: runningBalance > 0 ? runningBalance : 0,
    balance: runningBalance
  });

  // 2. Fetch Purchase Invoices
  const invoices = await db('purchase_invoices')
    .where('supplier_id', id)
    .select('id', 'date', 'invoice_number', 'total_amount');
    
  const invoiceEntries = invoices.map(inv => ({
    id: inv.id,
    date: new Date(inv.date).toISOString(),
    type: 'INVOICE' as const,
    reference: inv.invoice_number,
    debit: 0,
    credit: Number(inv.total_amount)
  }));

  // 3. Fetch Supplier Payments
  const payments = await db('supplier_payments')
    .where('supplier_id', id)
    .select('id', 'payment_date', 'payment_number', 'amount');

  const paymentEntries = payments.map(pay => ({
    id: pay.id,
    date: new Date(pay.payment_date).toISOString(),
    type: 'PAYMENT' as const,
    reference: pay.payment_number,
    debit: Number(pay.amount),
    credit: 0
  }));

  const transactions = [...invoiceEntries, ...paymentEntries].sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  for (const t of transactions) {
    runningBalance = runningBalance + t.credit - t.debit;
    ledger.push({
      ...t,
      balance: runningBalance
    });
  }

  return ledger;
}
