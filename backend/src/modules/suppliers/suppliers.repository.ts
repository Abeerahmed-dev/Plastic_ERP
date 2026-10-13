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
  total_paid: number;
  total_allocated_to_invoices: number;
  total_allocated_from_payments: number;
  net_balance: number;
  outstanding_payable: number;
  advance_payable: number;
}

/**
 * Compute decoupled balance for a single supplier using explicit allocation sums.
 * Outstanding = total_billed - total_allocated_to_invoices
 * Advance = total_paid - total_allocated_from_payments
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
    // Query 1 (Total Billed Purchase Invoices):
    trx('purchase_invoices')
      .where('supplier_id', supplierId)
      .whereNot('status', 'CANCELLED')
      .where('total_amount', '>=', 0)
      .select(trx.raw('SUM(ABS(total_amount)) as total'))
      .first<{ total: string | number | null }>(),

    // Query 2 (Total Returns / Debit Notes):
    trx('purchase_invoices')
      .where('supplier_id', supplierId)
      .whereNot('status', 'CANCELLED')
      .where('total_amount', '<', 0)
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

  const total_invoiced = Number(billedRes?.total || 0);
  const total_returns = Number(returnsRes?.total || 0);
  const total_paid = Math.round(Number(paidRes?.total || 0) * 100) / 100;

  const net_invoiced = Math.max(0, total_invoiced - total_returns);
  const total_billed = Math.round((opening_payable + net_invoiced) * 100) / 100;

  const total_allocated_to_invoices = Number(allocToInvoicesRes?.total_allocated || 0);
  const total_allocated_from_payments = Number(allocFromPaymentsRes?.total_allocated || 0);

  // The New Split Math:
  // supplier.outstanding_payable = total_billed - total_allocated_to_invoices
  // supplier.advance_payable = total_paid - total_allocated_from_payments
  const outstanding_payable = Math.max(0, Math.round((total_billed - total_allocated_to_invoices) * 100) / 100);
  const advance_payable = Math.max(0, Math.round((total_paid - total_allocated_from_payments) * 100) / 100);
  const net_balance = Math.round((outstanding_payable - advance_payable) * 100) / 100;

  return {
    opening_payable,
    total_billed,
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
    outstanding_payable: details.outstanding_payable,
    advance_payable: details.advance_payable,
    net_balance: details.net_balance,
    outstanding_balance: details.outstanding_payable,
  };
}

export async function createSupplier(
  data: CreateSupplierInput,
  createdBy: string,
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
