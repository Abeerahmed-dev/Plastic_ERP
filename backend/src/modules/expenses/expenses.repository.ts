import db from '../../db/knex';
import { parseDateFilter } from '../../shared/dateFilter';
import { CreateExpenseInput, PayExpenseInput, ExpenseQuery } from './expenses.schemas';
import { getCashDrawerBalance, getBankAccountBalance } from '../bank-accounts/bank-accounts.repository';

export async function createExpenseRecord(input: CreateExpenseInput, userId?: string) {
  return await db.transaction(async (trx) => {
    const payload = input;
    const isPending = payload.status === 'PENDING' || payload.status === 'UNPAID' || payload.payment_method === 'UNPAID';

    const hasStatus = await trx.schema.hasColumn('expenses', 'status');
    const hasPaidAmount = await trx.schema.hasColumn('expenses', 'paid_amount');
    const hasPurchaseId = await trx.schema.hasColumn('expenses', 'purchase_id');
    const hasExpPay = await trx.schema.hasTable('expense_payments');

    // 1. If recording an unpaid/pending expense (e.g. delivery charges or recorded payable):
    // Do NOT deduct from Cash in Drawer or any bank account!
    if (isPending) {
      const expenseInsertData: Record<string, any> = {
        amount: payload.amount,
        category: payload.category || 'Other',
        description: payload.description || null,
        expense_date: payload.expense_date || new Date(),
        payment_method: 'UNPAID',
        bank_account_id: null,
        created_by: userId || null,
      };
      if (hasStatus) expenseInsertData.status = 'PENDING';
      if (hasPaidAmount) expenseInsertData.paid_amount = 0;
      if (hasPurchaseId) expenseInsertData.purchase_id = payload.purchase_id || null;

      const [expense] = await trx('expenses')
        .insert(expenseInsertData)
        .returning('*');

      return {
        ...expense,
        paid_amount: expense.paid_amount !== undefined ? Number(expense.paid_amount) : 0,
        status: expense.status || 'PENDING',
        remaining_amount: Number(expense.amount || payload.amount || 0),
      };
    }

    const hasSpecificBank = Boolean(
      payload.bank_account_id &&
      payload.bank_account_id !== 'CASH_DRAWER' &&
      payload.bank_account_id !== 'cash-drawer'
    );
    const isCashDrawer = !hasSpecificBank;

    if (isCashDrawer) {
      const cashBalance = await getCashDrawerBalance(trx);
      if (cashBalance < Number(payload.amount)) {
        throw new Error(
          `INSUFFICIENT_LIQUIDITY: Cannot log an expense larger than Cash in Drawer balance (Available: Rs. ${cashBalance.toLocaleString()}).`
        );
      }

      const expenseInsertData: Record<string, any> = {
        amount: payload.amount,
        category: payload.category || 'Other',
        description: payload.description || null,
        expense_date: payload.expense_date || new Date(),
        payment_method: 'CASH',
        bank_account_id: null,
        created_by: userId || null,
      };
      if (hasStatus) expenseInsertData.status = 'PAID';
      if (hasPaidAmount) expenseInsertData.paid_amount = payload.amount;
      if (hasPurchaseId) expenseInsertData.purchase_id = payload.purchase_id || null;

      const [expense] = await trx('expenses')
        .insert(expenseInsertData)
        .returning('*');

      // Record payment row if expense_payments table exists
      if (hasExpPay) {
        await trx('expense_payments').insert({
          expense_id: expense.id,
          amount: payload.amount,
          payment_method: 'CASH',
          bank_account_id: null,
          payment_date: payload.expense_date || new Date(),
          notes: payload.description || null,
          created_by: userId || null,
        });
      }

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

      return {
        ...expense,
        paid_amount: expense.paid_amount !== undefined ? Number(expense.paid_amount) : Number(expense.amount || payload.amount || 0),
        status: expense.status || 'PAID',
        remaining_amount: 0,
      };
    }

    // Bank Account Liquidity Wall
    const account = await trx('bank_accounts')
      .where('id', payload.bank_account_id)
      .forUpdate()
      .first();

    if (!account) {
      throw new Error(`NOT_FOUND: Bank account with ID ${payload.bank_account_id} does not exist.`);
    }

    const calculatedBalance = await getBankAccountBalance(account.id, trx);
    const availableBalance = Math.max(Number(account.current_balance || 0), calculatedBalance);
    if (availableBalance < Number(payload.amount)) {
      throw new Error(
        `INSUFFICIENT_LIQUIDITY: Cannot log an expense larger than the account balance (Available: Rs. ${availableBalance.toLocaleString()}).`
      );
    }

    const expenseInsertData: Record<string, any> = {
      amount: payload.amount,
      category: payload.category || 'Other',
      description: payload.description || null,
      expense_date: payload.expense_date || new Date(),
      payment_method: payload.payment_method && payload.payment_method !== 'CASH' ? payload.payment_method : 'BANK',
      bank_account_id: payload.bank_account_id,
      created_by: userId || null,
    };
    if (hasStatus) expenseInsertData.status = 'PAID';
    if (hasPaidAmount) expenseInsertData.paid_amount = payload.amount;
    if (hasPurchaseId) expenseInsertData.purchase_id = payload.purchase_id || null;

    const [expense] = await trx('expenses')
      .insert(expenseInsertData)
      .returning('*');

    // Record payment row if expense_payments table exists
    if (hasExpPay) {
      await trx('expense_payments').insert({
        expense_id: expense.id,
        amount: payload.amount,
        payment_method: 'BANK',
        bank_account_id: payload.bank_account_id,
        payment_date: payload.expense_date || new Date(),
        notes: payload.description || null,
        created_by: userId || null,
      });
    }

    // Deduct the amount from bank_accounts current balance
    const newBal = Math.round((availableBalance - Number(payload.amount)) * 100) / 100;
    await trx('bank_accounts')
      .where('id', payload.bank_account_id)
      .update({
        current_balance: newBal,
        updated_at: new Date(),
      });

    // Insert new row into bank_transactions if table exists
    const hasBankTx = await trx.schema.hasTable('bank_transactions');
    if (hasBankTx) {
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
    }

    return {
      ...expense,
      paid_amount: expense.paid_amount !== undefined ? Number(expense.paid_amount) : Number(expense.amount || payload.amount || 0),
      status: expense.status || 'PAID',
      remaining_amount: 0,
    };
  });
}

export async function payExpenseRecord(
  expenseId: string,
  input: PayExpenseInput,
  userId?: string
) {
  return await db.transaction(async (trx) => {
    const expense = await trx('expenses').where('id', expenseId).forUpdate().first();
    if (!expense) {
      throw new Error('Expense record not found.');
    }

    const payAmount = Math.round(Number(input.amount) * 100) / 100;
    if (payAmount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const hasPaidAmount = await trx.schema.hasColumn('expenses', 'paid_amount');
    const hasStatus = await trx.schema.hasColumn('expenses', 'status');
    const hasExpPay = await trx.schema.hasTable('expense_payments');

    const totalAmount = Number(expense.amount || 0);
    const currentPaid = hasPaidAmount ? Number(expense.paid_amount || 0) : 0;
    const remaining = Math.round((totalAmount - currentPaid) * 100) / 100;

    if (hasPaidAmount && payAmount > remaining + 0.001) {
      throw new Error(
        `Payment amount (Rs. ${payAmount.toLocaleString()}) exceeds outstanding balance (Rs. ${remaining.toLocaleString()}).`
      );
    }

    const hasSpecificBank = Boolean(
      input.bank_account_id &&
      input.bank_account_id !== 'CASH_DRAWER' &&
      input.bank_account_id !== 'cash-drawer'
    );
    const isCashDrawer = !hasSpecificBank;

    if (isCashDrawer) {
      const cashBalance = await getCashDrawerBalance(trx);
      if (cashBalance < payAmount) {
        throw new Error(
          `INSUFFICIENT_LIQUIDITY: Cannot pay Rs. ${payAmount.toLocaleString()} from Cash in Drawer (Available: Rs. ${cashBalance.toLocaleString()}).`
        );
      }

      if (hasExpPay) {
        await trx('expense_payments').insert({
          expense_id: expense.id,
          amount: payAmount,
          payment_method: 'CASH',
          bank_account_id: null,
          payment_date: input.payment_date || new Date(),
          notes: input.notes || null,
          created_by: userId || null,
        });
      }

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
      const account = await trx('bank_accounts')
        .where('id', input.bank_account_id)
        .forUpdate()
        .first();

      if (!account) {
        throw new Error(`NOT_FOUND: Bank account with ID ${input.bank_account_id} does not exist.`);
      }

      const calculatedBalance = await getBankAccountBalance(account.id, trx);
      const availableBalance = Math.max(Number(account.current_balance || 0), calculatedBalance);
      if (availableBalance < payAmount) {
        const avail = availableBalance.toLocaleString();
        throw new Error(
          `INSUFFICIENT_LIQUIDITY: Cannot pay Rs. ${payAmount.toLocaleString()} from ${account?.account_title || account?.bank_name || 'Bank Account'} (Available: Rs. ${avail}).`
        );
      }

      if (hasExpPay) {
        await trx('expense_payments').insert({
          expense_id: expense.id,
          amount: payAmount,
          payment_method: 'BANK',
          bank_account_id: input.bank_account_id,
          payment_date: input.payment_date || new Date(),
          notes: input.notes || null,
          created_by: userId || null,
        });
      }

      const newBal = Math.round((availableBalance - payAmount) * 100) / 100;
      await trx('bank_accounts')
        .where('id', input.bank_account_id)
        .update({
          current_balance: newBal,
          updated_at: new Date(),
        });

      const hasBankTx = await trx.schema.hasTable('bank_transactions');
      if (hasBankTx) {
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
    }

    const newPaidTotal = Math.round((currentPaid + payAmount) * 100) / 100;
    const newStatus = newPaidTotal >= totalAmount - 0.01 ? 'PAID' : 'PARTIAL';

    const updatePayload: Record<string, any> = {
      payment_method: isCashDrawer ? 'CASH' : 'BANK',
      bank_account_id: isCashDrawer ? expense.bank_account_id : input.bank_account_id,
      updated_at: new Date(),
    };
    if (hasPaidAmount) updatePayload.paid_amount = newPaidTotal;
    if (hasStatus) updatePayload.status = newStatus;

    const [updatedExpense] = await trx('expenses')
      .where('id', expense.id)
      .update(updatePayload)
      .returning('*');

    return {
      ...updatedExpense,
      paid_amount: updatedExpense.paid_amount !== undefined ? Number(updatedExpense.paid_amount) : newPaidTotal,
      status: updatedExpense.status || newStatus,
      remaining_amount: Math.max(0, Math.round((totalAmount - newPaidTotal) * 100) / 100),
    };
  });
}

export async function findOutstandingExpenses(category?: string) {
  const hasStatus = await db.schema.hasColumn('expenses', 'status');
  const hasPaidAmount = await db.schema.hasColumn('expenses', 'paid_amount');
  const hasPurchaseId = await db.schema.hasColumn('expenses', 'purchase_id');

  if (!hasStatus && !hasPaidAmount) {
    return [];
  }

  let query = db('expenses as e');
  if (hasPurchaseId) {
    query = query
      .leftJoin('purchase_invoices as pi', 'e.purchase_id', 'pi.id')
      .leftJoin('suppliers as s', 'pi.supplier_id', 's.id')
      .select(
        'e.id',
        'e.amount',
        hasPaidAmount ? 'e.paid_amount' : 'e.amount as paid_amount',
        hasPaidAmount
          ? db.raw('ROUND(CAST(e.amount - COALESCE(e.paid_amount, 0) AS numeric), 2) as remaining_amount')
          : db.raw('0 as remaining_amount'),
        'e.category',
        'e.description',
        'e.expense_date',
        hasStatus ? 'e.status' : db.raw("'PAID' as status"),
        'e.purchase_id',
        'pi.invoice_number as purchase_invoice_number',
        's.name as supplier_name'
      );
  } else {
    query = query.select(
      'e.id',
      'e.amount',
      hasPaidAmount ? 'e.paid_amount' : 'e.amount as paid_amount',
      hasPaidAmount
        ? db.raw('ROUND(CAST(e.amount - COALESCE(e.paid_amount, 0) AS numeric), 2) as remaining_amount')
        : db.raw('0 as remaining_amount'),
      'e.category',
      'e.description',
      'e.expense_date',
      hasStatus ? 'e.status' : db.raw("'PAID' as status"),
      db.raw('NULL as purchase_id'),
      db.raw('NULL as purchase_invoice_number'),
      db.raw('NULL as supplier_name')
    );
  }

  query = query.where((builder) => {
    if (hasStatus) {
      builder.whereIn('e.status', ['PENDING', 'PARTIAL', 'UNPAID']);
    }
    if (hasPaidAmount) {
      builder.orWhereRaw('COALESCE(e.paid_amount, 0) < e.amount');
    }
  });

  if (hasStatus) {
    query = query.where('e.status', '!=', 'PAID');
  }

  query = query.orderBy('e.expense_date', 'desc').orderBy('e.created_at', 'desc');

  if (category && category !== 'All') {
    query = query.where('e.category', category);
  }

  return await query;
}

export async function findExpenses(query: ExpenseQuery = {}) {
  const { startDate: sDateObj, endDate: eDateObj } = parseDateFilter(query.startDate, query.endDate);
  const hasPaidAmount = await db.schema.hasColumn('expenses', 'paid_amount');
  const hasPurchaseId = await db.schema.hasColumn('expenses', 'purchase_id');
  const hasStatus = await db.schema.hasColumn('expenses', 'status');

  let builder = db('expenses as e')
    .leftJoin('users as u', 'e.created_by', 'u.id')
    .leftJoin('bank_accounts as ba', 'e.bank_account_id', 'ba.id');

  if (hasPurchaseId) {
    builder = builder
      .leftJoin('purchase_invoices as pi', 'e.purchase_id', 'pi.id')
      .leftJoin('suppliers as s', 'pi.supplier_id', 's.id')
      .select(
        'e.*',
        hasPaidAmount
          ? db.raw('ROUND(CAST(e.amount - COALESCE(e.paid_amount, 0) AS numeric), 2) as remaining_amount')
          : db.raw('0 as remaining_amount'),
        'u.name as created_by_name',
        'ba.bank_name',
        'ba.account_title',
        'pi.invoice_number as purchase_invoice_number',
        's.name as supplier_name'
      );
  } else {
    builder = builder.select(
      'e.*',
      hasPaidAmount
        ? db.raw('ROUND(CAST(e.amount - COALESCE(e.paid_amount, 0) AS numeric), 2) as remaining_amount')
        : db.raw('0 as remaining_amount'),
      'u.name as created_by_name',
      'ba.bank_name',
      'ba.account_title',
      db.raw('NULL as purchase_invoice_number'),
      db.raw('NULL as supplier_name')
    );
  }

  builder = builder.orderBy('e.expense_date', 'desc').orderBy('e.created_at', 'desc');

  if (sDateObj) {
    builder = builder.whereRaw('COALESCE(e.expense_date, e.created_at::date) >= ?', [sDateObj]);
  }
  if (eDateObj) {
    builder = builder.whereRaw('COALESCE(e.expense_date, e.created_at::date) <= ?', [eDateObj]);
  }
  if (query.category && query.category !== 'All') {
    builder = builder.where('e.category', query.category);
  }
  if (hasStatus && query.status && query.status !== 'All') {
    builder = builder.where('e.status', query.status);
  }
  if (query.payment_method && query.payment_method !== 'All') {
    builder = builder.where('e.payment_method', query.payment_method);
  }
  if (query.bank_account_id && query.bank_account_id !== 'All') {
    builder = builder.where('e.bank_account_id', query.bank_account_id);
  }

  const rows = await builder;
  return rows.map((r: any) => ({
    ...r,
    paid_amount: r.paid_amount !== undefined ? Number(r.paid_amount) : Number(r.amount || 0),
    status: r.status || 'PAID',
    remaining_amount: r.remaining_amount !== undefined ? Number(r.remaining_amount) : 0,
  }));
}

export async function findExpenseById(id: string) {
  const hasPaidAmount = await db.schema.hasColumn('expenses', 'paid_amount');
  const hasPurchaseId = await db.schema.hasColumn('expenses', 'purchase_id');

  let builder = db('expenses as e');
  if (hasPurchaseId) {
    builder = builder
      .leftJoin('purchase_invoices as pi', 'e.purchase_id', 'pi.id')
      .leftJoin('suppliers as s', 'pi.supplier_id', 's.id')
      .select(
        'e.*',
        hasPaidAmount
          ? db.raw('ROUND(CAST(e.amount - COALESCE(e.paid_amount, 0) AS numeric), 2) as remaining_amount')
          : db.raw('0 as remaining_amount'),
        'pi.invoice_number as purchase_invoice_number',
        's.name as supplier_name'
      );
  } else {
    builder = builder.select(
      'e.*',
      hasPaidAmount
        ? db.raw('ROUND(CAST(e.amount - COALESCE(e.paid_amount, 0) AS numeric), 2) as remaining_amount')
        : db.raw('0 as remaining_amount'),
      db.raw('NULL as purchase_invoice_number'),
      db.raw('NULL as supplier_name')
    );
  }

  const r = await builder.where('e.id', id).first();
  if (!r) return null;
  return {
    ...r,
    paid_amount: r.paid_amount !== undefined ? Number(r.paid_amount) : Number(r.amount || 0),
    status: r.status || 'PAID',
    remaining_amount: r.remaining_amount !== undefined ? Number(r.remaining_amount) : 0,
  };
}

export async function deleteExpenseRecord(id: string) {
  return await db.transaction(async (trx) => {
    const exp = await trx('expenses').where('id', id).first();
    if (!exp) return 0;

    const hasExpPay = await trx.schema.hasTable('expense_payments');
    if (hasExpPay) {
      const payments = await trx('expense_payments').where('expense_id', id);
      for (const payment of payments) {
        if (payment.bank_account_id && payment.amount) {
          await trx('bank_accounts')
            .where('id', payment.bank_account_id)
            .increment('current_balance', payment.amount);
        }
      }
      await trx('expense_payments').where('expense_id', id).del();
    } else if (exp.bank_account_id && exp.amount) {
      await trx('bank_accounts')
        .where('id', exp.bank_account_id)
        .increment('current_balance', exp.amount);
    }

    // Clean up bank transactions linked to this expense
    const hasBankTx = await trx.schema.hasTable('bank_transactions');
    if (hasBankTx) {
      await trx('bank_transactions').where('reference_id', id).del();
    }

    // Clean up cash drawer ledger entries linked to this expense
    const hasCdl = await trx.schema.hasTable('cash_drawer_ledger');
    if (hasCdl) {
      await trx('cash_drawer_ledger').where('reference_id', id).del();
    }

    // Delete the expense itself
    return trx('expenses').where('id', id).del();
  });
}
