import db from '../../db/knex';
import { CreateBankAccountInput, UpdateBankAccountInput } from './bank-accounts.schemas';

export interface BankAccountRow {
  id: string;
  account_title: string;
  bank_name: string;
  account_number: string;
  iban_details: string | null;
  initial_balance: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BankAccountWithBalance extends BankAccountRow {
  current_balance: number;
  total_in: number;
  total_out: number;
}

export async function findAllBankAccounts(): Promise<BankAccountWithBalance[]> {
  const accounts: BankAccountRow[] = await db('bank_accounts')
    .where('is_active', true)
    .orderBy('created_at', 'asc');

  if (accounts.length === 0) {
    return [];
  }

  const primaryAccountId = accounts[0].id;

  // Aggregate customer payments into bank accounts
  const custPayments = await db('customer_payments')
    .where((qb) => {
      qb.whereIn('payment_method', ['Bank Transfer', 'Online', 'BANK', 'BANK_TRANSFER'])
        .orWhere((inner) => {
          inner.whereIn('payment_method', ['Cheque', 'CHEQUE', 'PDC', 'POST_DATED_CHEQUE'])
               .andWhere('cheque_status', 'CLEARED');
        });
    })
    .select('bank_account_id')
    .sum('amount as total')
    .groupBy('bank_account_id');

  // Aggregate supplier payments out of bank accounts
  const suppPayments = await db('supplier_payments')
    .where((qb) => {
      qb.whereIn('payment_method', ['Bank Transfer', 'Online', 'BANK', 'BANK_TRANSFER'])
        .orWhere((inner) => {
          inner.whereIn('payment_method', ['Cheque', 'CHEQUE', 'PDC', 'POST_DATED_CHEQUE'])
               .andWhere('cheque_status', 'CLEARED');
        });
    })
    .select('bank_account_id')
    .sum('amount as total')
    .groupBy('bank_account_id');

  const custMap = new Map<string | null, number>();
  for (const c of custPayments) {
    custMap.set(c.bank_account_id || null, Number(c.total || 0));
  }

  const suppMap = new Map<string | null, number>();
  for (const s of suppPayments) {
    suppMap.set(s.bank_account_id || null, Number(s.total || 0));
  }

  // Unassigned payments get mapped to primary bank account
  const unassignedIn = custMap.get(null) || 0;
  const unassignedOut = suppMap.get(null) || 0;

  return accounts.map((acc) => {
    let totalIn = custMap.get(acc.id) || 0;
    let totalOut = suppMap.get(acc.id) || 0;

    if (acc.id === primaryAccountId) {
      totalIn += unassignedIn;
      totalOut += unassignedOut;
    }

    const init = Number(acc.initial_balance || 0);
    const current_balance = Math.round((init + totalIn - totalOut) * 100) / 100;

    return {
      ...acc,
      initial_balance: init,
      current_balance,
      total_in: Math.round(totalIn * 100) / 100,
      total_out: Math.round(totalOut * 100) / 100,
    };
  });
}

export async function findBankAccountById(id: string): Promise<BankAccountWithBalance | undefined> {
  const all = await findAllBankAccounts();
  return all.find((a) => a.id === id);
}

export async function createBankAccount(data: CreateBankAccountInput): Promise<BankAccountRow> {
  const [row] = await db('bank_accounts')
    .insert({
      account_title: data.account_title.trim(),
      bank_name: data.bank_name.trim(),
      account_number: data.account_number.trim(),
      iban_details: data.iban_details ? data.iban_details.trim() : null,
      initial_balance: data.initial_balance || 0,
      is_active: true,
    })
    .returning('*');
  return row;
}

export async function updateBankAccount(
  id: string,
  data: UpdateBankAccountInput
): Promise<BankAccountRow | undefined> {
  const updateData: Record<string, any> = { updated_at: new Date() };
  if (data.account_title !== undefined) updateData.account_title = data.account_title.trim();
  if (data.bank_name !== undefined) updateData.bank_name = data.bank_name.trim();
  if (data.account_number !== undefined) updateData.account_number = data.account_number.trim();
  if (data.iban_details !== undefined) updateData.iban_details = data.iban_details ? data.iban_details.trim() : null;
  if (data.initial_balance !== undefined) updateData.initial_balance = data.initial_balance;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  const [row] = await db('bank_accounts')
    .where('id', id)
    .update(updateData)
    .returning('*');

  return row;
}

export async function softDeleteBankAccount(id: string): Promise<boolean> {
  const count = await db('bank_accounts')
    .where('id', id)
    .update({ is_active: false, updated_at: new Date() });
  return count > 0;
}

export interface BankTransactionItem {
  id: string;
  date: string;
  description: string;
  type: 'INFLOW' | 'OUTFLOW';
  amount: number;
  running_balance: number;
}

export interface BankAccountTransactionsResult {
  account: BankAccountWithBalance;
  transactions: BankTransactionItem[];
}

export async function getBankAccountTransactions(accountId: string): Promise<BankAccountTransactionsResult> {
  const account = await findBankAccountById(accountId);
  if (!account) {
    throw new Error('Bank account not found');
  }

  const allAccounts = await db('bank_accounts').where('is_active', true).orderBy('created_at', 'asc');
  const isPrimary = allAccounts.length > 0 && allAccounts[0].id === accountId;

  // 1. Customer Payments (Inflows)
  const custQuery = db('customer_payments as cp')
    .leftJoin('customers as c', 'cp.customer_id', 'c.id')
    .where((qb) => {
      qb.whereIn('cp.payment_method', ['Bank Transfer', 'Online', 'BANK', 'BANK_TRANSFER'])
        .orWhere((inner) => {
          inner.whereIn('cp.payment_method', ['Cheque', 'CHEQUE', 'PDC', 'POST_DATED_CHEQUE'])
               .andWhere('cp.cheque_status', 'CLEARED');
        });
    })
    .where((qb) => {
      if (isPrimary) {
        qb.where('cp.bank_account_id', accountId).orWhereNull('cp.bank_account_id');
      } else {
        qb.where('cp.bank_account_id', accountId);
      }
    })
    .select(
      'cp.id',
      'cp.amount',
      'cp.payment_date',
      'cp.created_at',
      'c.name as customer_name'
    );

  // 2. Supplier Payments (Outflows)
  const suppQuery = db('supplier_payments as sp')
    .leftJoin('suppliers as s', 'sp.supplier_id', 's.id')
    .where((qb) => {
      qb.whereIn('sp.payment_method', ['Bank Transfer', 'Online', 'BANK', 'BANK_TRANSFER'])
        .orWhere((inner) => {
          inner.whereIn('sp.payment_method', ['Cheque', 'CHEQUE', 'PDC', 'POST_DATED_CHEQUE'])
               .andWhere('sp.cheque_status', 'CLEARED');
        });
    })
    .where((qb) => {
      if (isPrimary) {
        qb.where('sp.bank_account_id', accountId).orWhereNull('sp.bank_account_id');
      } else {
        qb.where('sp.bank_account_id', accountId);
      }
    })
    .select(
      'sp.id',
      'sp.amount',
      'sp.payment_date',
      'sp.created_at',
      's.name as supplier_name'
    );

  // 3. Expenses Paid via Bank (Outflows)
  const expQuery = db('expenses as e')
    .whereIn('e.payment_method', ['Bank Transfer', 'Online', 'BANK', 'Cheque', 'CHEQUE'])
    .select(
      'e.id',
      'e.amount',
      'e.expense_date',
      'e.category',
      'e.description',
      'e.created_at'
    );

  const [custRows, suppRows, expRows] = await Promise.all([custQuery, suppQuery, expQuery]);

  const rawTxList: {
    id: string;
    rawDate: Date;
    dateStr: string;
    description: string;
    type: 'INFLOW' | 'OUTFLOW';
    amount: number;
  }[] = [];

  for (const c of custRows) {
    const rawDate = c.payment_date ? new Date(c.payment_date) : new Date(c.created_at || Date.now());
    const dateStr = rawDate.toISOString().split('T')[0];
    rawTxList.push({
      id: c.id,
      rawDate,
      dateStr,
      description: `Payment from Customer: ${c.customer_name || 'Walk-in / Cash Customer'}`,
      type: 'INFLOW',
      amount: Math.round(Number(c.amount || 0) * 100) / 100,
    });
  }

  for (const s of suppRows) {
    const rawDate = s.payment_date ? new Date(s.payment_date) : new Date(s.created_at || Date.now());
    const dateStr = rawDate.toISOString().split('T')[0];
    rawTxList.push({
      id: s.id,
      rawDate,
      dateStr,
      description: `Payment to Supplier: ${s.supplier_name || 'Vendor'}`,
      type: 'OUTFLOW',
      amount: Math.round(Number(s.amount || 0) * 100) / 100,
    });
  }

  if (isPrimary) {
    for (const e of expRows) {
      const rawDate = e.expense_date ? new Date(e.expense_date) : new Date(e.created_at || Date.now());
      const dateStr = rawDate.toISOString().split('T')[0];
      const desc = `Expense: ${e.category || 'General'}${e.description ? ` (${e.description})` : ''}`;
      rawTxList.push({
        id: e.id,
        rawDate,
        dateStr,
        description: desc,
        type: 'OUTFLOW',
        amount: Math.round(Number(e.amount || 0) * 100) / 100,
      });
    }
  }

  // Sort ascending chronologically to compute running balance sequentially
  rawTxList.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

  let currBalance = Number(account.initial_balance || 0);
  const withRunningBalance = rawTxList.map((tx) => {
    if (tx.type === 'INFLOW') {
      currBalance += tx.amount;
    } else {
      currBalance -= tx.amount;
    }
    currBalance = Math.round(currBalance * 100) / 100;
    return {
      id: tx.id,
      date: tx.dateStr,
      description: tx.description,
      type: tx.type,
      amount: tx.amount,
      running_balance: currBalance,
    };
  });

  // Return sorted descending (newest first)
  const transactions = withRunningBalance.reverse();

  return {
    account,
    transactions,
  };
}
