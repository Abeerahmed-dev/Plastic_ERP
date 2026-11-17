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

    // 3. Liquidity Ledger: Insert INFLOW row into cash_drawer_ledger or bank_accounts
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
      // customer_payments row already serves as the primary bank ledger entry
      await trx('bank_accounts').where('id', bankAccountId).increment('current_balance', advanceAmount);
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
      const bankBalance = await getBankAccountBalance(bank.id, trx);
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

    // Dynamic Transaction Naming (Phase 2)
    const isAdvance = true; // Supplier advances are unlinked from specific invoices
    const dynamicDescription = isAdvance
      ? `Advance Deposit to Supplier: ${supplier.name}`
      : `Payment to Supplier: ${supplier.name}`;
    const description = input.notes || dynamicDescription;

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
        notes: description,
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
          description: description,
          reference_id: payment.id,
          transaction_date: txDate,
          created_by: userId || null,
        });
      }
    } else if (bankAccountId) {
      // Phase 1: Eliminate redundant manual bank_transactions insert.
      // The supplier_payments row already serves as the shared financial record queried by bank ledger,
      // guaranteeing a strictly 1:1 ratio between the bank debit and the supplier wallet credit.
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
