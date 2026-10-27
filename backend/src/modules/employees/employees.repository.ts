import db from '../../db/knex';
import {
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeQuery,
  CreateEmployeeLedgerEntryInput,
} from './employees.schemas';
import { NotFoundError } from '../../shared/errors';

export function getCurrentYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function getNextEmployeeId(): Promise<string> {
  const result = await db('employees').count('id as count').first();
  const count = Number(result?.count || 0) + 1;
  const candidate = `EMP-${String(count).padStart(3, '0')}`;
  
  // Verify candidate uniqueness
  const exists = await db('employees').where('employee_id', candidate).first();
  if (!exists) return candidate;
  return `EMP-${Date.now().toString().slice(-4)}`;
}

export async function createEmployeeRecord(data: CreateEmployeeInput, userId?: string) {
  return await db.transaction(async (trx) => {
    const employeeId = data.employee_id?.trim() || (await getNextEmployeeId());

    const [created] = await trx('employees')
      .insert({
        employee_id: employeeId,
        name: data.name,
        phone: data.phone || null,
        designation: data.designation,
        store_timing: data.store_timing || null,
        salary: data.salary ?? 0,
        cnic: data.cnic || null,
        status: data.status || 'ACTIVE',
        joining_date: data.joining_date || null,
        notes: data.notes || null,
      })
      .returning('*');

    // Automatically initialize employee's ledger with current month's salary if salary > 0
    const salaryAmt = Number(created.salary || 0);
    if (salaryAmt > 0) {
      const currentMonth = getCurrentYearMonth();
      await trx('employee_ledger').insert({
        employee_id: created.id,
        transaction_type: 'SALARY',
        date: created.joining_date || new Date().toISOString().split('T')[0],
        reference_month: currentMonth,
        description: `Monthly salary entitlement for ${currentMonth}`,
        amount: salaryAmt,
        payment_method: 'CASH',
        created_by: userId || null,
      });
    }

    return created;
  });
}

export async function findEmployees(query: EmployeeQuery = {}) {
  let builder = db('employees').select('*').orderBy('created_at', 'desc');

  if (query.status) {
    builder = builder.where('status', query.status);
  }

  if (query.designation) {
    builder = builder.whereILike('designation', `%${query.designation}%`);
  }

  if (query.search) {
    const s = `%${query.search.trim()}%`;
    builder = builder.where(function () {
      this.whereILike('name', s)
        .orWhereILike('employee_id', s)
        .orWhereILike('phone', s)
        .orWhereILike('designation', s);
    });
  }

  const employees = await builder;
  const currentMonth = getCurrentYearMonth();

  // Fetch summary for all employees for current month
  const ledgerRows = await db('employee_ledger')
    .where('reference_month', currentMonth)
    .select('employee_id', 'transaction_type', 'amount');

  const advanceMap = new Map<string, number>();
  const salaryMap = new Map<string, number>();

  for (const row of ledgerRows) {
    const empId = row.employee_id;
    const amt = Number(row.amount || 0);
    const type = row.transaction_type;

    if (type === 'SALARY' || type === 'BONUS') {
      salaryMap.set(empId, (salaryMap.get(empId) || 0) + amt);
    } else {
      advanceMap.set(empId, (advanceMap.get(empId) || 0) + amt);
    }
  }

  return employees.map((emp) => {
    const baseSalary = Number(emp.salary || 0);
    const accruedSalary = salaryMap.has(emp.id) ? (salaryMap.get(emp.id) || 0) : baseSalary;
    const advances = advanceMap.get(emp.id) || 0;
    const remainingSalary = accruedSalary - advances;

    return {
      ...emp,
      current_month: currentMonth,
      current_month_advances: advances,
      current_month_remaining: remainingSalary,
    };
  });
}

export async function findEmployeeById(id: string) {
  const employee = await db('employees').where('id', id).first();
  if (!employee) return null;

  const currentMonth = getCurrentYearMonth();
  const ledgerRows = await db('employee_ledger')
    .where('employee_id', id)
    .select('reference_month', 'transaction_type', 'amount');

  let currentMonthAdvances = 0;
  let currentMonthSalary = 0;
  let allTimeBalance = 0;

  for (const row of ledgerRows) {
    const amt = Number(row.amount || 0);
    const isCredit = row.transaction_type === 'SALARY' || row.transaction_type === 'BONUS';
    if (isCredit) {
      allTimeBalance += amt;
    } else {
      allTimeBalance -= amt;
    }

    if (row.reference_month === currentMonth) {
      if (isCredit) {
        currentMonthSalary += amt;
      } else {
        currentMonthAdvances += amt;
      }
    }
  }

  const baseSalary = Number(employee.salary || 0);
  const totalAccrued = currentMonthSalary > 0 ? currentMonthSalary : baseSalary;

  return {
    ...employee,
    current_month: currentMonth,
    current_month_salary: totalAccrued,
    current_month_advances: currentMonthAdvances,
    current_month_remaining: totalAccrued - currentMonthAdvances,
    all_time_balance: Math.round(allTimeBalance * 100) / 100,
  };
}

export async function updateEmployeeRecord(id: string, data: UpdateEmployeeInput) {
  const updatePayload: Record<string, any> = {
    updated_at: new Date(),
  };

  if (data.employee_id !== undefined) updatePayload.employee_id = data.employee_id;
  if (data.name !== undefined) updatePayload.name = data.name;
  if (data.phone !== undefined) updatePayload.phone = data.phone;
  if (data.designation !== undefined) updatePayload.designation = data.designation;
  if (data.store_timing !== undefined) updatePayload.store_timing = data.store_timing;
  if (data.salary !== undefined) updatePayload.salary = data.salary;
  if (data.cnic !== undefined) updatePayload.cnic = data.cnic;
  if (data.status !== undefined) updatePayload.status = data.status;
  if (data.joining_date !== undefined) updatePayload.joining_date = data.joining_date;
  if (data.notes !== undefined) updatePayload.notes = data.notes;

  const [updated] = await db('employees')
    .where('id', id)
    .update(updatePayload)
    .returning('*');

  return updated;
}

export async function deleteEmployeeRecord(id: string) {
  return db('employees').where('id', id).del();
}

export async function getEmployeeLedger(employeeId: string, filterMonth?: string) {
  const employee = await db('employees').where('id', employeeId).first();
  if (!employee) {
    throw new NotFoundError('Employee');
  }

  const currentMonth = filterMonth || getCurrentYearMonth();

  const transactions = await db('employee_ledger as el')
    .leftJoin('bank_accounts as ba', 'el.bank_account_id', 'ba.id')
    .leftJoin('users as u', 'el.created_by', 'u.id')
    .where('el.employee_id', employeeId)
    .select(
      'el.*',
      'ba.bank_name',
      'ba.account_number',
      'u.name as created_by_name'
    )
    .orderBy('el.date', 'asc')
    .orderBy('el.created_at', 'asc');

  let runningBalance = 0;
  let totalSalaryAccruedThisMonth = 0;
  let totalAdvancesThisMonth = 0;

  const mappedTransactions = transactions.map((t) => {
    const amt = Number(t.amount || 0);
    const type = t.transaction_type;
    const isCredit = type === 'SALARY' || type === 'BONUS';
    const isDebit = type === 'ADVANCE' || type === 'PAYMENT' || type === 'DEDUCTION';

    if (isCredit) {
      runningBalance += amt;
    } else {
      runningBalance -= amt;
    }

    if (t.reference_month === currentMonth) {
      if (isCredit) {
        totalSalaryAccruedThisMonth += amt;
      } else {
        totalAdvancesThisMonth += amt;
      }
    }

    return {
      id: t.id,
      employee_id: t.employee_id,
      transaction_type: t.transaction_type,
      date: t.date,
      reference_month: t.reference_month,
      description: t.description,
      amount: amt,
      debit: isDebit ? amt : 0,
      credit: isCredit ? amt : 0,
      running_balance: Math.round(runningBalance * 100) / 100,
      payment_method: t.payment_method,
      bank_account_id: t.bank_account_id,
      bank_name: t.bank_name,
      account_number: t.account_number,
      created_by_name: t.created_by_name,
      created_at: t.created_at,
    };
  });

  const baseSalary = Number(employee.salary || 0);
  const salaryAccrued = totalSalaryAccruedThisMonth > 0 ? totalSalaryAccruedThisMonth : baseSalary;
  const remainingSalaryThisMonth = salaryAccrued - totalAdvancesThisMonth;

  return {
    employee,
    current_month: currentMonth,
    monthly_salary: baseSalary,
    total_salary_accrued_this_month: salaryAccrued,
    total_advances_this_month: totalAdvancesThisMonth,
    remaining_salary_this_month: remainingSalaryThisMonth,
    all_time_balance: Math.round(runningBalance * 100) / 100,
    transactions: mappedTransactions.reverse(), // newest first
  };
}

export async function addEmployeeLedgerEntry(
  employeeId: string,
  input: CreateEmployeeLedgerEntryInput,
  userId?: string
) {
  return await db.transaction(async (trx) => {
    const employee = await trx('employees').where('id', employeeId).first();
    if (!employee) {
      throw new NotFoundError('Employee');
    }

    const txDate = input.date || new Date().toISOString().split('T')[0];
    const refMonth = input.reference_month || getCurrentYearMonth();
    const amount = Math.round(Number(input.amount) * 100) / 100;
    const isOutflow = input.transaction_type === 'ADVANCE' || input.transaction_type === 'PAYMENT';
    let expenseId: string | null = null;

    // 1. If it's an advance or payment disbursed to employee, register as operating expense
    if (isOutflow) {
      const [expense] = await trx('expenses')
        .insert({
          amount: amount,
          category: 'Salaries',
          description: input.description || `Staff Salary / Advance: ${employee.name} (${employee.employee_id}) - ${refMonth}`,
          expense_date: txDate,
          payment_method: input.payment_method === 'BANK_TRANSFER' ? 'BANK' : 'CASH',
          bank_account_id: input.payment_method === 'BANK_TRANSFER' ? (input.bank_account_id || null) : null,
          created_by: userId || null,
        })
        .returning('*');

      expenseId = expense.id;

      if (input.payment_method === 'CASH') {
        const hasCashDrawer = await trx.schema.hasTable('cash_drawer_ledger');
        if (hasCashDrawer) {
          await trx('cash_drawer_ledger').insert({
            type: 'OUTFLOW',
            amount: amount,
            source_type: 'OPEX',
            reference_id: expense.id,
            description: input.description || `Staff Salary: ${employee.name} (${employee.employee_id})`,
            transaction_date: txDate,
            created_by: userId || null,
          });
        }
      } else if (input.payment_method === 'BANK_TRANSFER' && input.bank_account_id) {
        const hasBankTx = await trx.schema.hasTable('bank_transactions');
        if (hasBankTx) {
          await trx('bank_transactions').insert({
            bank_account_id: input.bank_account_id,
            type: 'OUTFLOW',
            transaction_type: 'WITHDRAWAL',
            source: 'OPEX',
            source_type: 'OPEX',
            reference_id: expense.id,
            amount: amount,
            description: input.description || `Staff Salary: ${employee.name} (${employee.employee_id})`,
            transaction_date: txDate,
            category: 'OPEX',
            created_by: userId || null,
          });

          await trx('bank_accounts')
            .where({ id: input.bank_account_id })
            .decrement('current_balance', amount);
        }
      }
    }

    // 2. Insert into employee_ledger
    const [entry] = await trx('employee_ledger')
      .insert({
        employee_id: employeeId,
        transaction_type: input.transaction_type,
        date: txDate,
        reference_month: refMonth,
        description: input.description || `${input.transaction_type} for ${employee.name} (${refMonth})`,
        amount: amount,
        payment_method: input.payment_method || 'CASH',
        bank_account_id: input.payment_method === 'BANK_TRANSFER' ? (input.bank_account_id || null) : null,
        expense_id: expenseId,
        created_by: userId || null,
      })
      .returning('*');

    return entry;
  });
}

export async function deleteEmployeeLedgerEntry(entryId: string) {
  return await db.transaction(async (trx) => {
    const entry = await trx('employee_ledger').where('id', entryId).first();
    if (!entry) {
      throw new NotFoundError('Ledger entry');
    }

    // If it was cash outflow or bank outflow, reverse it and clean up linked expense
    if (entry.transaction_type === 'ADVANCE' || entry.transaction_type === 'PAYMENT') {
      if (entry.expense_id) {
        if (entry.payment_method === 'CASH') {
          const hasCashDrawer = await trx.schema.hasTable('cash_drawer_ledger');
          if (hasCashDrawer) {
            await trx('cash_drawer_ledger').where('reference_id', entry.expense_id).del();
          }
        } else if (entry.payment_method === 'BANK_TRANSFER' && entry.bank_account_id) {
          const hasBankTx = await trx.schema.hasTable('bank_transactions');
          if (hasBankTx) {
            await trx('bank_transactions').where('reference_id', entry.expense_id).del();
          }
          await trx('bank_accounts')
            .where({ id: entry.bank_account_id })
            .increment('current_balance', entry.amount);
        }
        await trx('expenses').where('id', entry.expense_id).del();
      } else {
        // Fallback for legacy entries without expense_id
        if (entry.payment_method === 'CASH') {
          const hasCashDrawer = await trx.schema.hasTable('cash_drawer_ledger');
          if (hasCashDrawer) {
            await trx('cash_drawer_ledger').where('reference_id', entry.id).del();
          }
        } else if (entry.payment_method === 'BANK_TRANSFER' && entry.bank_account_id) {
          const hasBankTx = await trx.schema.hasTable('bank_transactions');
          if (hasBankTx) {
            await trx('bank_transactions')
              .where(function() {
                this.where('reference_id', entry.id)
                  .orWhere(function() {
                    this.where({
                      bank_account_id: entry.bank_account_id,
                      transaction_date: entry.date,
                      amount: entry.amount,
                    });
                  });
              })
              .del();
          }
          await trx('bank_accounts')
            .where({ id: entry.bank_account_id })
            .increment('current_balance', entry.amount);
        }
      }
    }

    await trx('employee_ledger').where('id', entryId).del();
    return { success: true };
  });
}

