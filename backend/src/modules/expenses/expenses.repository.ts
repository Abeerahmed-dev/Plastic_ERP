import db from '../../db/knex';
import { parseDateFilter } from '../../shared/dateFilter';
import { CreateExpenseInput, PayExpenseInput, ExpenseQuery } from './expenses.schemas';
import { getCashDrawerBalance } from '../bank-accounts/bank-accounts.repository';

export async function createExpenseRecord(input: CreateExpenseInput, userId?: string) {
  return await db.transaction(async (trx) => {
    const payload = input;
    const isPending = payload.status === 'PENDING' || payload.status === 'UNPAID' || payload.payment_method === 'UNPAID';

    // 1. If recording an unpaid/pending expense (e.g. delivery charges or recorded payable):
    // Do NOT deduct from Cash in Drawer or any bank account!
    if (isPending) {
      const [expense] = await trx('expenses')
        .insert({
          amount: payload.amount,
          category: payload.category || 'Other',
          description: payload.description || null,
          expense_date: payload.expense_date || new Date(),
          payment_method: 'UNPAID',
          status: 'PENDING',
          paid_amount: 0,
          bank_account_id: null,
          purchase_id: payload.purchase_id || null,
          created_by: userId || null,
        })
        .returning('*');

      return expense;
    }

    const isCashDrawer =
      !payload.bank_account_id ||
      payload.bank_account_id === 'CASH_DRAWER' ||
      String(payload.payment_method || '').toUpperCase() === 'CASH';

    if (isCashDrawer) {
      const cashBalance = await getCashDrawerBalance(trx);
      if (cashBalance < Number(payload.amount)) {
        throw new Error(
          `INSUFFICIENT_LIQUIDITY: Cannot log an expense larger than Cash in Drawer balance (Available: Rs. ${cashBalance.toLocaleString()}).`
        );
      }

      const [expense] = await trx('expenses')
        .insert({
          amount: payload.amount,
          category: payload.category || 'Other',
          description: payload.description || null,
          expense_date: payload.expense_date || new Date(),
          payment_method: 'CASH',
          status: 'PAID',
          paid_amount: payload.amount,
          bank_account_id: null,
          purchase_id: payload.purchase_id || null,
          created_by: userId || null,
        })
        .returning('*');

      // Record payment row
      await trx('expense_payments').insert({
        expense_id: expense.id,
        amount: payload.amount,
        payment_method: 'CASH',
        bank_account_id: null,
        payment_date: payload.expense_date || new Date(),
        notes: payload.description || null,
        created_by: userId || null,
      });

      const hasCdl = await trx.schema.hasTable('cash_drawer_ledger');
      if (hasCdl) {
        const hasSourceType = await trx.schema.hasColumn('cash_drawer_ledger', 'source_type');
        const cdlPayload: Record<string, any> = {
          type: 'OUTFLOW',
          amount: payload.amount,
          reference_id: expense.id,
          description: payload.description || `OPEX Expense: ${payload.category || 'General'}`,
          created_by: userId || null,
        };
        if (hasSourceType) {
          cdlPayload.source_type = 'OPEX';
        }
        await trx('cash_drawer_ledger').insert(cdlPayload);
      }

      return expense;
    }

    // Bank Account Liquidity Wall
    const account = await trx('bank_accounts')
      .where('id', payload.bank_account_id)
      .forUpdate()
      .first();

    if (!account || Number(account.current_balance) < Number(payload.amount)) {
      throw new Error('INSUFFICIENT_LIQUIDITY: Cannot log an expense larger than the account balance.');
    }

    const [expense] = await trx('expenses')
      .insert({
        amount: payload.amount,
        category: payload.category || 'Other',
        description: payload.description || null,
        expense_date: payload.expense_date || new Date(),
        payment_method: payload.payment_method || (account.bank_name ? 'BANK' : 'CASH'),
        status: 'PAID',
        paid_amount: payload.amount,
        bank_account_id: payload.bank_account_id,
        purchase_id: payload.purchase_id || null,
        created_by: userId || null,
      })
      .returning('*');

    // Record payment row
    await trx('expense_payments').insert({
      expense_id: expense.id,
      amount: payload.amount,
      payment_method: 'BANK',
      bank_account_id: payload.bank_account_id,
      payment_date: payload.expense_date || new Date(),
      notes: payload.description || null,
      created_by: userId || null,
    });

    // Deduct the amount from bank_accounts current balance
    await trx('bank_accounts')
      .where('id', payload.bank_account_id)
      .decrement('current_balance', payload.amount);

    // Insert new row into bank_transactions
    await trx('bank_transactions').insert({
      bank_account_id: payload.bank_account_id,
      transaction_type: 'WITHDRAWAL',
      type: 'OUTFLOW',
      amount: payload.amount,
      source_type: 'OPEX',
      source: 'OPEX',
      reference_id: expense.id,
      description: payload.description || `OPEX Expense: ${payload.category || 'General'}`,
      transaction_date: payload.expense_date || new Date(),
      category: 'OPEX',
      created_by: userId || null,
    });

    return expense;
  });
}

export async function payExpenseRecord(expenseId: string, input: PayExpenseInput, userId?: string) {
  return await db.transaction(async (trx) => {
    const expense = await trx('expenses').where('id', expenseId).forUpdate().first();
    if (!expense) {
      throw new Error(`Expense record not found: ${expenseId}`);
    }

    const totalAmount = Number(expense.amount || 0);
    const currentPaid = Number(expense.paid_amount || 0);
    const remainingDue = Math.max(0, totalAmount - currentPaid);
    const payAmount = Number(input.amount);

    if (payAmount <= 0) {
      throw new Error('Payment amount must be greater than 0.');
    }
    if (payAmount > remainingDue + 0.01) {
      throw new Error(
        `Cannot pay more than remaining due amount (Remaining: Rs. ${remainingDue.toLocaleString('en-PK', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}).`
      );
    }

    const isCashDrawer =
      !input.bank_account_id ||
      input.bank_account_id === 'CASH_DRAWER' ||
      String(input.payment_method || '').toUpperCase() === 'CASH';

    if (isCashDrawer) {
      const cashBalance = await getCashDrawerBalance(trx);
      if (cashBalance < payAmount) {
        throw new Error(
          `INSUFFICIENT_LIQUIDITY: Cannot pay Rs. ${payAmount.toLocaleString()} from Cash in Drawer (Available: Rs. ${cashBalance.toLocaleString()}).`
        );
      }

      // Record cash payment
      await trx('expense_payments').insert({
        expense_id: expense.id,
        amount: payAmount,
        payment_method: 'CASH',
        bank_account_id: null,
        payment_date: input.payment_date || new Date(),
        notes: input.notes || null,
        created_by: userId || null,
      });

      const hasCdl = await trx.schema.hasTable('cash_drawer_ledger');
      if (hasCdl) {
        const hasSourceType = await trx.schema.hasColumn('cash_drawer_ledger', 'source_type');
        const cdlPayload: Record<string, any> = {
          type: 'OUTFLOW',
          amount: payAmount,
          reference_id: expense.id,
          description:
            input.notes ||
            `OPEX Payment: ${expense.category} - ${expense.description || 'Logistics'}`,
          created_by: userId || null,
        };
        if (hasSourceType) {
          cdlPayload.source_type = 'OPEX';
        }
        await trx('cash_drawer_ledger').insert(cdlPayload);
      }
    } else {
      // Bank payment
      const account = await trx('bank_accounts')
        .where('id', input.bank_account_id)
        .forUpdate()
        .first();

      if (!account || Number(account.current_balance) < payAmount) {
        const avail = account ? Number(account.current_balance).toLocaleString() : '0';
        throw new Error(
          `INSUFFICIENT_LIQUIDITY: Cannot pay Rs. ${payAmount.toLocaleString()} from ${account?.account_title || account?.bank_name || 'Bank Account'} (Available: Rs. ${avail}).`
        );
      }

      await trx('expense_payments').insert({
        expense_id: expense.id,
        amount: payAmount,
        payment_method: 'BANK',
        bank_account_id: input.bank_account_id,
        payment_date: input.payment_date || new Date(),
        notes: input.notes || null,
        created_by: userId || null,
      });

      // Decrement bank account current balance
      await trx('bank_accounts')
        .where('id', input.bank_account_id)
        .decrement('current_balance', payAmount);

      // Insert row into bank_transactions
      await trx('bank_transactions').insert({
        bank_account_id: input.bank_account_id,
        transaction_type: 'WITHDRAWAL',
        type: 'OUTFLOW',
        amount: payAmount,
        source_type: 'OPEX',
        source: 'OPEX',
        reference_id: expense.id,
        description:
          input.notes ||
          `OPEX Payment: ${expense.category} - ${expense.description || 'Logistics'}`,
        transaction_date: input.payment_date || new Date(),
        category: 'OPEX',
        created_by: userId || null,
      });
    }

    const newPaidTotal = Math.round((currentPaid + payAmount) * 100) / 100;
    const newStatus = newPaidTotal >= totalAmount - 0.01 ? 'PAID' : 'PARTIAL';

    const [updatedExpense] = await trx('expenses')
      .where('id', expense.id)
      .update({
        paid_amount: newPaidTotal,
        status: newStatus,
        payment_method: isCashDrawer ? 'CASH' : 'BANK',
        bank_account_id: isCashDrawer ? expense.bank_account_id : input.bank_account_id,
        updated_at: new Date(),
      })
      .returning('*');

    return updatedExpense;
  });
}

export async function findOutstandingExpenses(category?: string) {
  let query = db('expenses as e')
    .leftJoin('purchase_invoices as pi', 'e.purchase_id', 'pi.id')
    .leftJoin('suppliers as s', 'pi.supplier_id', 's.id')
    .select(
      'e.id',
      'e.amount',
      'e.paid_amount',
      db.raw('ROUND(CAST(e.amount - COALESCE(e.paid_amount, 0) AS numeric), 2) as remaining_amount'),
      'e.category',
      'e.description',
      'e.expense_date',
      'e.status',
      'e.purchase_id',
      'pi.invoice_number as purchase_invoice_number',
      's.name as supplier_name'
    )
    .where((builder) => {
      builder
        .whereIn('e.status', ['PENDING', 'PARTIAL', 'UNPAID'])
        .orWhereRaw('COALESCE(e.paid_amount, 0) < e.amount');
    })
    .where('e.status', '!=', 'PAID')
    .orderBy('e.expense_date', 'desc')
    .orderBy('e.created_at', 'desc');

  if (category && category !== 'All') {
    query = query.where('e.category', category);
  }

  return await query;
}

export async function findExpenses(query: ExpenseQuery = {}) {
  const { startDate: sDateObj, endDate: eDateObj } = parseDateFilter(query.startDate, query.endDate);

  let builder = db('expenses as e')
    .leftJoin('users as u', 'e.created_by', 'u.id')
    .leftJoin('bank_accounts as ba', 'e.bank_account_id', 'ba.id')
    .leftJoin('purchase_invoices as pi', 'e.purchase_id', 'pi.id')
    .leftJoin('suppliers as s', 'pi.supplier_id', 's.id')
    .select(
      'e.*',
      db.raw('ROUND(CAST(e.amount - COALESCE(e.paid_amount, 0) AS numeric), 2) as remaining_amount'),
      'u.name as created_by_name',
      'ba.bank_name',
      'ba.account_title',
      'pi.invoice_number as purchase_invoice_number',
      's.name as supplier_name'
    )
    .orderBy('e.expense_date', 'desc')
    .orderBy('e.created_at', 'desc');

  if (sDateObj) {
    builder = builder.whereRaw('COALESCE(e.expense_date, e.created_at::date) >= ?', [sDateObj]);
  }
  if (eDateObj) {
    builder = builder.whereRaw('COALESCE(e.expense_date, e.created_at::date) <= ?', [eDateObj]);
  }
  if (query.category && query.category !== 'All') {
    builder = builder.where('e.category', query.category);
  }
  if (query.status && query.status !== 'All') {
    builder = builder.where('e.status', query.status);
  }
  if (query.payment_method && query.payment_method !== 'All') {
    builder = builder.where('e.payment_method', query.payment_method);
  }
  if (query.bank_account_id && query.bank_account_id !== 'All') {
    builder = builder.where('e.bank_account_id', query.bank_account_id);
  }

  return await builder;
}

export async function findExpenseById(id: string) {
  return db('expenses as e')
    .leftJoin('purchase_invoices as pi', 'e.purchase_id', 'pi.id')
    .leftJoin('suppliers as s', 'pi.supplier_id', 's.id')
    .select(
      'e.*',
      db.raw('ROUND(CAST(e.amount - COALESCE(e.paid_amount, 0) AS numeric), 2) as remaining_amount'),
      'pi.invoice_number as purchase_invoice_number',
      's.name as supplier_name'
    )
    .where('e.id', id)
    .first();
}

export async function deleteExpenseRecord(id: string) {
  return await db.transaction(async (trx) => {
    const exp = await trx('expenses').where('id', id).first();
    if (!exp) return 0;

    // Check all payments recorded for this expense
    const payments = await trx('expense_payments').where('expense_id', id);

    for (const payment of payments) {
      if (payment.bank_account_id && payment.amount) {
        await trx('bank_accounts')
          .where('id', payment.bank_account_id)
          .increment('current_balance', payment.amount);
      }
    }

    // Clean up bank transactions linked to this expense
    await trx('bank_transactions').where('reference_id', id).del();

    // Clean up cash drawer ledger entries linked to this expense
    const hasCdl = await trx.schema.hasTable('cash_drawer_ledger');
    if (hasCdl) {
      await trx('cash_drawer_ledger').where('reference_id', id).del();
    }

    // Delete payment records
    await trx('expense_payments').where('expense_id', id).del();

    // Delete the expense itself
    return trx('expenses').where('id', id).del();
  });
}
