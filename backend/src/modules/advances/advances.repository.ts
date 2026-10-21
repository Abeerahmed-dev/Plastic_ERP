import db from '../../db/knex';
import { CreateCustomerAdvanceInput, CreateSupplierAdvanceInput } from './advances.schemas';
import { generateNextPaymentNumber } from '../payments/payments.repository';
import { generatePaymentNumber as generateSupplierPaymentNumber } from '../supplier-payments/supplier-payments.repository';
import { computeCustomerNetBalance } from '../customers/customers.repository';
import { computeSupplierNetBalance } from '../suppliers/suppliers.repository';
import { NotFoundError, InsufficientLiquidityError } from '../../shared/errors';
import { getBankAccountBalance, getCashDrawerBalance } from '../bank-accounts/bank-accounts.repository';

export async function createCustomerAdvance(
  input: CreateCustomerAdvanceInput,
  userId?: string
) {
  return await db.transaction(async (trx) => {
    // 1. Verify customer exists
    const customer = await trx('customers').where({ id: input.customer_id }).first();
    if (!customer) {
      throw new NotFoundError('Customer');
    }

    const advanceAmount = Math.round(Number(input.amount) * 100) / 100;
    const paymentNumber = await generateNextPaymentNumber(trx);
    const isCashDrawer = !input.source || input.source === 'CASH_DRAWER' || input.source === 'CASH';

    let bankAccountId: string | null = null;
    let paymentMethod = 'CASH';

    if (!isCashDrawer) {
      const bank = await trx('bank_accounts').where({ id: input.source }).first();
      if (!bank) {
        throw new NotFoundError('Selected bank account');
      }
      bankAccountId = bank.id;
      paymentMethod = 'BANK_TRANSFER';
    }

    const txDate = input.payment_date || input.date || new Date().toISOString().split('T')[0];

    // 2. Customer Ledger: Insert payment row with payment_type = 'ADVANCE_DEPOSIT' and NO invoice_id
    const [payment] = await trx('customer_payments')
      .insert({
        customer_id: input.customer_id,
        invoice_id: null,
        linked_invoice_id: null,
        payment_number: paymentNumber,
        payment_date: txDate,
        amount: advanceAmount,
        payment_method: paymentMethod,
        payment_type: 'ADVANCE_DEPOSIT',
        bank_account_id: bankAccountId,
        notes: input.notes || `Customer Advance Deposit - ${customer.name}`,
        cheque_status: 'CLEARED',
        created_by: userId || null,
      })
      .returning('*');

    // 3. Liquidity Ledger: Insert INFLOW row into cash_drawer_ledger or bank_transactions
    if (isCashDrawer) {
      const hasCashDrawerTable = await trx.schema.hasTable('cash_drawer_ledger');
      if (hasCashDrawerTable) {
        await trx('cash_drawer_ledger').insert({
          type: 'INFLOW',
          amount: advanceAmount,
          description: input.notes || `Advance deposit from customer ${customer.name} (${paymentNumber})`,
          reference_id: payment.id,
          transaction_date: txDate,
          created_by: userId || null,
        });
      }
    } else if (bankAccountId) {
      const hasBankTxTable = await trx.schema.hasTable('bank_transactions');
      if (hasBankTxTable) {
        await trx('bank_transactions').insert({
          bank_account_id: bankAccountId,
          type: 'INFLOW',
          amount: advanceAmount,
          description: input.notes || `Advance deposit from customer ${customer.name} (${paymentNumber})`,
          transaction_date: txDate,
          category: 'CUSTOMER_ADVANCE',
          created_by: userId || null,
        });
      }
    }

    // 4. Return new balance details
    const updatedBalance = await computeCustomerNetBalance(input.customer_id, trx);

    return {
      payment,
      updated_balance: updatedBalance,
    };
  });
}

export async function createSupplierAdvance(
  input: CreateSupplierAdvanceInput,
  userId?: string
) {
  return await db.transaction(async (trx) => {
    // 1. Verify supplier exists
    const supplier = await trx('suppliers').where({ id: input.supplier_id }).first();
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }

    const advanceAmount = Math.round(Number(input.amount) * 100) / 100;
    const paymentNumber = await generateSupplierPaymentNumber(trx);
    const isCashDrawer = !input.source || input.source === 'CASH_DRAWER' || input.source === 'CASH';

    let bankAccountId: string | null = null;
    let paymentMethod = 'CASH';

    if (!isCashDrawer) {
      const bank = await trx('bank_accounts').where({ id: input.source }).first();
      if (!bank) {
        throw new NotFoundError('Selected bank account');
      }
      bankAccountId = bank.id;
      paymentMethod = 'BANK_TRANSFER';
      const bankBalance = bank.current_balance !== undefined
        ? Number(bank.current_balance)
        : await getBankAccountBalance(bank.id, trx);
      if (bankBalance < advanceAmount) {
        throw new InsufficientLiquidityError(
          'INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.'
        );
      }
    } else {
      const cashBalance = await getCashDrawerBalance(trx);
      if (cashBalance < advanceAmount) {
        throw new InsufficientLiquidityError(
          'INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.'
        );
      }
    }

    const txDate = input.payment_date || input.date || new Date().toISOString().split('T')[0];

    // 2. Supplier Ledger: Insert row into supplier_payments with payment_type = 'ADVANCE_DEPOSIT' and NO purchase_invoice_id
    const [payment] = await trx('supplier_payments')
      .insert({
        supplier_id: input.supplier_id,
        purchase_invoice_id: null,
        payment_number: paymentNumber,
        payment_date: txDate,
        amount: advanceAmount,
        payment_method: paymentMethod,
        payment_type: 'ADVANCE_DEPOSIT',
        bank_account_id: bankAccountId,
        notes: input.notes || `Supplier Advance Deposit - ${supplier.name}`,
        cheque_status: 'CLEARED',
        created_by: userId || null,
      })
      .returning('*');

    // 3. Liquidity Ledger: Log OUTFLOW from business cash drawer or bank account
    if (isCashDrawer) {
      const hasCashDrawerTable = await trx.schema.hasTable('cash_drawer_ledger');
      if (hasCashDrawerTable) {
        await trx('cash_drawer_ledger').insert({
          type: 'OUTFLOW',
          amount: advanceAmount,
          description: input.notes || `Advance deposit to supplier ${supplier.name} (${paymentNumber})`,
          reference_id: payment.id,
          transaction_date: txDate,
          created_by: userId || null,
        });
      }
    } else if (bankAccountId) {
      const hasBankTxTable = await trx.schema.hasTable('bank_transactions');
      if (hasBankTxTable) {
        await trx('bank_transactions').insert({
          bank_account_id: bankAccountId,
          type: 'OUTFLOW',
          amount: advanceAmount,
          description: input.notes || `Advance deposit to supplier ${supplier.name} (${paymentNumber})`,
          transaction_date: txDate,
          category: 'SUPPLIER_ADVANCE',
          created_by: userId || null,
        });
      }
      await trx('bank_accounts').where('id', bankAccountId).decrement('current_balance', advanceAmount);
    }

    // 4. Return new balance details
    const updatedBalance = await computeSupplierNetBalance(input.supplier_id, trx);

    return {
      payment,
      updated_balance: updatedBalance,
    };
  });
}
