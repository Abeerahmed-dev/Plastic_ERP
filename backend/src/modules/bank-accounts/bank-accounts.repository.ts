import db from '../../db/knex';
import { Knex } from 'knex';
import { CreateBankAccountInput, UpdateBankAccountInput, TransferFundsInput } from './bank-accounts.schemas';
import { NotFoundError, ValidationError, InsufficientLiquidityError } from '../../shared/errors';

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
  name?: string;
  current_balance: number;
  total_in: number;
  total_out: number;
}

export async function getBankAccountBalanceDetail(
  accountId: string,
  trx: Knex.Transaction | Knex = db
): Promise<{ current_balance: number; total_in: number; total_out: number; initial_balance: number }> {
  const account = await trx('bank_accounts').where('id', accountId).first();
  if (!account) {
    throw new NotFoundError('Bank account');
  }

  const allAccounts = await trx('bank_accounts').where('is_active', true).orderBy('created_at', 'asc');
  const isPrimary = allAccounts.length > 0 && allAccounts[0].id === accountId;

  // 1. Customer Payments (Inflows)
  const custQuery = trx('customer_payments as cp')
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
    .sum('cp.amount as total')
    .first();

  // 2. Supplier Payments (Outflows)
  const suppQuery = trx('supplier_payments as sp')
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
    .sum('sp.amount as total')
    .first();

  // 3. Expenses (Outflows)
  const expQuery = trx('expenses as e')
    .where((qb) => {
      if (isPrimary) {
        qb.where('e.bank_account_id', accountId)
          .orWhere((inner) => {
            inner.whereNull('e.bank_account_id')
                 .whereIn('e.payment_method', ['BANK', 'Bank Transfer', 'Online', 'Cheque', 'CHEQUE']);
          });
      } else {
        qb.where('e.bank_account_id', accountId);
      }
    })
    .sum('e.amount as total')
    .first();

  // 4. Bank transactions table (excluding OPEX rows which are already tracked via expenses table)
  const hasBankTx = await trx.schema.hasTable('bank_transactions');
  const manualQuery = hasBankTx
    ? trx('bank_transactions')
        .where('bank_account_id', accountId)
        .where((qb) => {
          qb.whereNull('source').orWhere('source', '!=', 'OPEX');
        })
    : Promise.resolve([]);

  const [custRes, suppRes, expRes, manualRows] = await Promise.all([
    custQuery,
    suppQuery,
    expQuery,
    manualQuery,
  ]);

  let manualInflow = 0;
  let manualOutflow = 0;
  let hasOpeningInjection = false;

  for (const m of (manualRows as any[])) {
    const t = String(m.type || '').toUpperCase();
    if (t === 'INFLOW' || t === 'DEPOSIT') {
      manualInflow += Number(m.amount || 0);
    } else if (t === 'OUTFLOW' || t === 'WITHDRAWAL') {
      manualOutflow += Number(m.amount || 0);
    }
    if (m.description && (m.description.includes('Opening Balance') || m.description.includes('Day Zero'))) {
      hasOpeningInjection = true;
    }
  }

  const baseBalance = hasOpeningInjection ? 0 : Number(account.initial_balance || 0);
  const totalIn = Number(custRes?.total || 0) + manualInflow;
  const totalOut = Number(suppRes?.total || 0) + Number(expRes?.total || 0) + manualOutflow;

  return {
    initial_balance: Number(account.initial_balance || 0),
    current_balance: Math.round((baseBalance + totalIn - totalOut) * 100) / 100,
    total_in: Math.round(totalIn * 100) / 100,
    total_out: Math.round(totalOut * 100) / 100,
  };
}

export async function getBankAccountBalance(accountId: string, trx: Knex.Transaction | Knex = db): Promise<number> {
  const detail = await getBankAccountBalanceDetail(accountId, trx);
  return detail.current_balance;
}

export async function getCashDrawerBalance(trx: Knex.Transaction | Knex = db): Promise<number> {
  // 1. Inflow from customer cash payments (POS retail sales, invoice payments, customer advances)
  const custRes = await trx('customer_payments')
    .whereIn('payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'Cash in Drawer'])
    .andWhere('amount', '>', 0)
    .where(function() {
      this.whereNull('cheque_status')
        .orWhereNotIn('cheque_status', ['BOUNCED', 'FAILED']);
    })
    .sum('amount as total')
    .first();

  // 2. Outflow from customer refunds in cash
  const custRefundRes = await trx('customer_payments')
    .where(function() {
      this.whereIn('payment_method', ['CASH_REFUND', 'cash_refund'])
        .orWhere(function() {
          this.whereIn('payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'Cash in Drawer'])
            .andWhere('amount', '<', 0);
        });
    })
    .sum('amount as total')
    .first();

  // 3. Outflow from supplier payments in cash
  const suppRes = await trx('supplier_payments')
    .whereIn('payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'Cash in Drawer'])
    .andWhere('amount', '>', 0)
    .where(function() {
      this.whereNull('cheque_status')
        .orWhereNotIn('cheque_status', ['BOUNCED', 'FAILED']);
    })
    .sum('amount as total')
    .first();

  // 4. Inflow from supplier refunds in cash
  const suppRefundRes = await trx('supplier_payments')
    .where(function() {
      this.whereIn('payment_method', ['CASH_REFUND', 'cash_refund'])
        .orWhere(function() {
          this.whereIn('payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'Cash in Drawer'])
            .andWhere('amount', '<', 0);
        });
    })
    .sum('amount as total')
    .first();

  // 5. Outflow from actual cash expense payments
  let expTotal = 0;
  const hasExpPay = await trx.schema.hasTable('expense_payments');
  if (hasExpPay) {
    const expRes = await trx('expense_payments')
      .whereIn('payment_method', ['CASH', 'Cash', 'Cash in Drawer', 'CASH_DRAWER'])
      .andWhere('amount', '>', 0)
      .sum('amount as total')
      .first();
    expTotal = Number(expRes?.total || 0);
  } else {
    const expRes = await trx('expenses')
      .whereIn('payment_method', ['CASH', 'Cash', 'Cash in Drawer', 'CASH_DRAWER'])
      .whereIn('status', ['PAID', 'PARTIAL'])
      .andWhere('paid_amount', '>', 0)
      .sum('paid_amount as total')
      .first();
    expTotal = Number(expRes?.total || 0);
  }

  // 6. Net internal bank transfers to/from cash drawer (only internal transfers without reference_id)
  let transferIn = 0;
  let transferOut = 0;
  const hasCdl = await trx.schema.hasTable('cash_drawer_ledger');
  if (hasCdl) {
    const transferRows = await trx('cash_drawer_ledger')
      .where(function() {
        this.whereNull('reference_id')
          .orWhereILike('description', '%transfer%');
      })
      .select('type', 'amount');

    for (const r of transferRows) {
      const t = String(r.type || '').toUpperCase();
      if (t === 'INFLOW' || t === 'DEPOSIT') {
        transferIn += Number(r.amount || 0);
      } else if (t === 'OUTFLOW' || t === 'WITHDRAWAL') {
        transferOut += Number(r.amount || 0);
      }
    }
  }

  // 7. Outflow from legacy unlinked employee salary advances / payments in cash (not tracked via expenses)
  let empCashOut = 0;
  const hasEmpLedger = await trx.schema.hasTable('employee_ledger');
  if (hasEmpLedger) {
    const empRes = await trx('employee_ledger')
      .where('payment_method', 'CASH')
      .whereIn('transaction_type', ['ADVANCE', 'PAYMENT'])
      .whereNull('expense_id')
      .sum('amount as total')
      .first();
    empCashOut = Number(empRes?.total || 0);
  }

  const totalIn = Number(custRes?.total || 0) + Math.abs(Number(suppRefundRes?.total || 0)) + transferIn;
  const totalOut = Number(suppRes?.total || 0) + expTotal + Math.abs(Number(custRefundRes?.total || 0)) + transferOut + empCashOut;

  return Math.round((totalIn - totalOut) * 100) / 100;
}

export async function findAllBankAccounts(): Promise<BankAccountWithBalance[]> {
  const accounts: BankAccountRow[] = await db('bank_accounts')
    .where('is_active', true)
    .orderBy('created_at', 'asc');

  if (accounts.length === 0) {
    return [];
  }

  return await Promise.all(
    accounts.map(async (acc) => {
      const detail = await getBankAccountBalanceDetail(acc.id);
      return {
        ...acc,
        name: acc.account_title || `${acc.bank_name} - ${acc.account_number}`,
        initial_balance: detail.initial_balance,
        current_balance: detail.current_balance,
        total_in: detail.total_in,
        total_out: detail.total_out,
      };
    })
  );
}


export async function findBankAccountById(id: string): Promise<BankAccountWithBalance | undefined> {
  const all = await findAllBankAccounts();
  return all.find((a) => a.id === id);
}

export async function createBankAccount(data: CreateBankAccountInput, userId?: string | null): Promise<BankAccountRow> {
  const openingBalance = data.opening_balance !== undefined
    ? Number(data.opening_balance)
    : Number(data.initial_balance || 0);

  return await db.transaction(async (trx: Knex.Transaction) => {
    const [row] = await trx('bank_accounts')
      .insert({
        account_title: data.account_title.trim(),
        bank_name: data.bank_name.trim(),
        account_number: data.account_number.trim(),
        iban_details: data.iban_details ? data.iban_details.trim() : null,
        initial_balance: openingBalance,
        current_balance: openingBalance,
        is_active: true,
      })
      .returning('*');

    // Day Zero Capital Injection / Opening Balance (Owner Equity)
    if (openingBalance > 0) {
      const hasBankTx = await trx.schema.hasTable('bank_transactions');
      if (hasBankTx) {
        await trx('bank_transactions').insert({
          bank_account_id: row.id,
          type: 'INFLOW',
          amount: openingBalance,
          description: 'Day Zero Capital Injection / Opening Balance',
          category: 'EQUITY',
          transaction_date: new Date(),
          created_by: userId || null,
        });
      }
    }

    return row;
  });
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
  transaction_type: 'DEPOSIT' | 'WITHDRAWAL';
  source: 'POS' | 'CUSTOMER_PAYMENT' | 'OUTFLOW';
  source_type: 'POS' | 'CUSTOMER_PAYMENT' | 'OUTFLOW';
  amount: number;
  running_balance: number;
}

export interface BankAccountTransactionsResult {
  account: BankAccountWithBalance;
  transactions: BankTransactionItem[];
}

export async function getBankAccountTransactions(
  accountId: string,
  filter?: { source?: string; transaction_type?: string }
): Promise<BankAccountTransactionsResult> {
  const account = await findBankAccountById(accountId);
  if (!account) {
    throw new NotFoundError('Bank account');
  }

  const allAccounts = await db('bank_accounts').where('is_active', true).orderBy('created_at', 'asc');
  const isPrimary = allAccounts.length > 0 && allAccounts[0].id === accountId;

  // 1. Customer Payments (Inflows: POS Sales & Customer Invoiced Payments)
  const custQuery = db('customer_payments as cp')
    .leftJoin('customers as c', 'cp.customer_id', 'c.id')
    .leftJoin('sales_invoices as si', 'cp.invoice_id', 'si.id')
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
      'cp.payment_number',
      'cp.notes',
      'si.invoice_number',
      'si.notes as invoice_notes',
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
    .where((qb) => {
      if (isPrimary) {
        qb.where('e.bank_account_id', accountId)
          .orWhere((inner) => {
            inner.whereNull('e.bank_account_id')
                 .whereIn('e.payment_method', ['BANK', 'Bank Transfer', 'Online', 'Cheque', 'CHEQUE']);
          });
      } else {
        qb.where('e.bank_account_id', accountId);
      }
    })
    .select(
      'e.id',
      'e.amount',
      'e.expense_date',
      'e.category',
      'e.description',
      'e.created_at'
    );

  // 4. Day Zero Capital Injections / Bank Transactions (excluding OPEX rows which are tracked via expenses)
  const hasBankTx = await db.schema.hasTable('bank_transactions');
  const manualQuery = hasBankTx
    ? db('bank_transactions')
        .where('bank_account_id', accountId)
        .where((qb) => {
          qb.whereNull('source').orWhere('source', '!=', 'OPEX');
        })
        .select('id', 'amount', 'transaction_date', 'description', 'type', 'created_at')
    : Promise.resolve([]);

  const [custRows, suppRows, expRows, manualRows] = await Promise.all([custQuery, suppQuery, expQuery, manualQuery]);

  const rawTxList: {
    id: string;
    rawDate: Date;
    dateStr: string;
    description: string;
    type: 'INFLOW' | 'OUTFLOW';
    transaction_type: 'DEPOSIT' | 'WITHDRAWAL';
    source: 'POS' | 'CUSTOMER_PAYMENT' | 'OUTFLOW';
    source_type: 'POS' | 'CUSTOMER_PAYMENT' | 'OUTFLOW';
    amount: number;
  }[] = [];

  for (const m of (manualRows as any[])) {
    const rawDate = m.transaction_date ? new Date(m.transaction_date) : new Date(m.created_at || Date.now());
    const dateStr = rawDate.toISOString().split('T')[0];
    const isDeposit = m.type === 'INFLOW';
    rawTxList.push({
      id: m.id,
      rawDate,
      dateStr,
      description: m.description || (isDeposit ? 'Day Zero Capital Injection / Opening Balance' : 'Bank Outflow'),
      type: m.type as 'INFLOW' | 'OUTFLOW',
      transaction_type: isDeposit ? 'DEPOSIT' : 'WITHDRAWAL',
      source: isDeposit ? 'CUSTOMER_PAYMENT' : 'OUTFLOW',
      source_type: isDeposit ? 'CUSTOMER_PAYMENT' : 'OUTFLOW',
      amount: Math.round(Number(m.amount || 0) * 100) / 100,
    });
  }

  for (const c of custRows) {
    const rawDate = c.payment_date ? new Date(c.payment_date) : new Date(c.created_at || Date.now());
    const dateStr = rawDate.toISOString().split('T')[0];
    const isPos = Boolean(
      (c.payment_number && c.payment_number.includes('POS')) ||
      (c.invoice_number && c.invoice_number.startsWith('POS')) ||
      (c.notes && c.notes.toLowerCase().includes('pos')) ||
      (c.invoice_notes && c.invoice_notes.toLowerCase().includes('pos'))
    );
    const source: 'POS' | 'CUSTOMER_PAYMENT' = isPos ? 'POS' : 'CUSTOMER_PAYMENT';
    const description = isPos
      ? `POS Walk-in Sale (${c.customer_name || 'Walk-in Customer'})`
      : `Payment from Customer: ${c.customer_name || 'Walk-in / Cash Customer'}`;

    rawTxList.push({
      id: c.id,
      rawDate,
      dateStr,
      description,
      type: 'INFLOW',
      transaction_type: 'DEPOSIT',
      source,
      source_type: source,
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
      transaction_type: 'WITHDRAWAL',
      source: 'OUTFLOW',
      source_type: 'OUTFLOW',
      amount: Math.round(Number(s.amount || 0) * 100) / 100,
    });
  }

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
      transaction_type: 'WITHDRAWAL',
      source: 'OUTFLOW',
      source_type: 'OUTFLOW',
      amount: Math.round(Number(e.amount || 0) * 100) / 100,
    });
  }

  // Sort ascending chronologically to compute running balance sequentially
  rawTxList.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

  const hasOpeningInjection = (manualRows as any[]).some((m: any) =>
    m.description && (m.description.includes('Opening Balance') || m.description.includes('Day Zero'))
  );
  let currBalance = hasOpeningInjection ? 0 : Number(account.initial_balance || 0);
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
      transaction_type: tx.transaction_type,
      source: tx.source,
      source_type: tx.source_type,
      amount: tx.amount,
      running_balance: currBalance,
    };
  });

  // Return sorted descending (newest first)
  let transactions = withRunningBalance.reverse();

  if (filter?.transaction_type) {
    transactions = transactions.filter((t) => t.transaction_type === filter.transaction_type);
  }
  if (filter?.source) {
    transactions = transactions.filter((t) => t.source === filter.source || t.source_type === filter.source);
  }

  return {
    account,
    transactions,
  };
}

export async function transferFunds(
  input: TransferFundsInput,
  userId?: string
): Promise<{ success: boolean; message: string; from_balance: number; to_balance: number }> {
  const { from_account_id, to_account_id, notes, date } = input;
  const amount = Math.round(Number(input.amount) * 100) / 100;

  if (amount <= 0) {
    throw new ValidationError('Transfer amount must be greater than 0');
  }

  if (from_account_id === to_account_id) {
    throw new ValidationError('Cannot transfer to the same account');
  }

  return await db.transaction(async (trx: Knex.Transaction) => {
    const isFromCash = from_account_id === 'CASH_DRAWER' || from_account_id === 'cash-drawer';
    const isToCash = to_account_id === 'CASH_DRAWER' || to_account_id === 'cash-drawer';

    let fromAccount: any = null;
    let toAccount: any = null;
    let fromBalance = 0;

    // Validate from_account
    if (isFromCash) {
      fromBalance = await getCashDrawerBalance(trx);
      if (fromBalance < amount) {
        throw new InsufficientLiquidityError(
          'INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.'
        );
      }
    } else {
      fromAccount = await trx('bank_accounts').where('id', from_account_id).first();
      if (!fromAccount) {
        throw new NotFoundError('Source bank account');
      }
      fromBalance = fromAccount.current_balance !== undefined
        ? Number(fromAccount.current_balance)
        : await getBankAccountBalance(from_account_id, trx);
      if (fromBalance < amount) {
        throw new InsufficientLiquidityError(
          'INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.'
        );
      }
    }

    // Validate to_account
    if (!isToCash) {
      toAccount = await trx('bank_accounts').where('id', to_account_id).first();
      if (!toAccount) {
        throw new NotFoundError('Destination bank account');
      }
    }

    const txDate = date || new Date().toISOString().split('T')[0];
    const fromLabel = isFromCash ? 'Cash Drawer' : `${fromAccount.account_title} (${fromAccount.bank_name})`;
    const toLabel = isToCash ? 'Cash Drawer' : `${toAccount.account_title} (${toAccount.bank_name})`;

    const isUuid = (str?: string): boolean =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
    const validUserId = isUuid(userId) ? userId : null;

    // 1. Subtract amount from from_account
    if (isFromCash) {
      const hasCdl = await trx.schema.hasTable('cash_drawer_ledger');
      if (hasCdl) {
        await trx('cash_drawer_ledger').insert({
          type: 'OUTFLOW',
          amount,
          description: notes || `Internal Transfer to ${toLabel}`,
          transaction_date: txDate,
          created_by: validUserId,
        });
      }
    } else {
      await trx('bank_accounts')
        .where('id', from_account_id)
        .decrement('current_balance', amount);

      await trx('bank_transactions').insert({
        bank_account_id: from_account_id,
        type: 'WITHDRAWAL',
        amount,
        description: notes || `Internal Transfer to ${toLabel}`,
        transaction_date: txDate,
        category: 'INTERNAL_TRANSFER',
        source: 'INTERNAL_TRANSFER',
        created_by: validUserId,
      });
    }

    // 2. Add amount to to_account
    if (isToCash) {
      const hasCdl = await trx.schema.hasTable('cash_drawer_ledger');
      if (hasCdl) {
        await trx('cash_drawer_ledger').insert({
          type: 'INFLOW',
          amount,
          description: notes || `Internal Transfer from ${fromLabel}`,
          transaction_date: txDate,
          created_by: validUserId,
        });
      }
    } else {
      await trx('bank_accounts')
        .where('id', to_account_id)
        .increment('current_balance', amount);

      await trx('bank_transactions').insert({
        bank_account_id: to_account_id,
        type: 'DEPOSIT',
        amount,
        description: notes || `Internal Transfer from ${fromLabel}`,
        transaction_date: txDate,
        category: 'INTERNAL_TRANSFER',
        source: 'INTERNAL_TRANSFER',
        created_by: validUserId,
      });
    }

    const updatedFromBal = isFromCash
      ? await getCashDrawerBalance(trx)
      : await getBankAccountBalance(from_account_id, trx);
    const updatedToBal = isToCash
      ? await getCashDrawerBalance(trx)
      : await getBankAccountBalance(to_account_id, trx);

    return {
      success: true,
      message: `Successfully transferred Rs. ${amount.toLocaleString()} from ${fromLabel} to ${toLabel}`,
      from_balance: updatedFromBal,
      to_balance: updatedToBal,
    };
  });
}

