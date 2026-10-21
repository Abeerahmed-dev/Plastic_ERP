import type { Knex } from 'knex';
import db from '../../db/knex';
import { CreateCustomerRefundInput } from './customer-refunds.schemas';
import { computeCustomerNetBalance } from '../customers/customers.repository';
import { ValidationError, NotFoundError, InsufficientLiquidityError } from '../../shared/errors';
import { getBankAccountBalance, getCashDrawerBalance } from '../bank-accounts/bank-accounts.repository';

export async function generateNextRefundNumber(trx: Knex.Transaction | Knex = db): Promise<string> {
  const rows = await trx('customer_payments')
    .where('payment_number', 'like', 'RFD-%')
    .select('payment_number');

  let maxNum = 0;
  for (const r of rows) {
    if (r.payment_number && r.payment_number.startsWith('RFD-')) {
      const numPart = r.payment_number.replace('RFD-', '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `RFD-${(maxNum + 1).toString().padStart(5, '0')}`;
}

export async function createCustomerRefund(
  input: CreateCustomerRefundInput,
  userId?: string
) {
  return await db.transaction(async (trx) => {
    // 1. Verify customer exists and has sufficient advance wallet balance
    const customer = await trx('customers').where({ id: input.customer_id }).first();
    if (!customer) {
      throw new NotFoundError('Customer');
    }

    const currentBalance = await computeCustomerNetBalance(input.customer_id, trx);
    const refundAmount = Math.round(Number(input.amount) * 100) / 100;

    if (currentBalance.advance_credit < refundAmount) {
      throw new ValidationError(
        `Refund amount (Rs. ${refundAmount.toLocaleString()}) exceeds customer's available Advance Wallet credit (Rs. ${currentBalance.advance_credit.toLocaleString()})`
      );
    }

    const refundNumber = await generateNextRefundNumber(trx);
    const isCashDrawer = !input.source || input.source === 'CASH_DRAWER' || input.source === 'CASH';

    let bankAccountId: string | null = null;
    let paymentMethod = 'CASH_REFUND';

    // ── Liquidity Wall: Intercept outgoing customer refund ──
    if (isCashDrawer) {
      const cashBalance = await getCashDrawerBalance(trx);
      if (cashBalance < refundAmount) {
        throw new InsufficientLiquidityError(
          'INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.'
        );
      }
    } else {
      const bank = await trx('bank_accounts').where({ id: input.source }).first();
      if (!bank) {
        throw new NotFoundError('Selected bank account');
      }
      bankAccountId = bank.id;
      paymentMethod = 'BANK_TRANSFER';
      const bankBalance = bank.current_balance !== undefined
        ? Number(bank.current_balance)
        : await getBankAccountBalance(bank.id, trx);
      if (bankBalance < refundAmount) {
        throw new InsufficientLiquidityError(
          'INSUFFICIENT_LIQUIDITY: Cannot withdraw more cash than the account holds.'
        );
      }
    }


    // 2. Customer Ledger: Insert negative payment row
    const [payment] = await trx('customer_payments')
      .insert({
        customer_id: input.customer_id,
        invoice_id: input.linked_invoice_id || null,
        linked_invoice_id: input.linked_invoice_id || null,
        payment_number: refundNumber,
        payment_date: input.refund_date || new Date().toISOString().split('T')[0],
        amount: -Math.abs(refundAmount),
        payment_method: paymentMethod,
        bank_account_id: bankAccountId,
        notes: input.notes || 'Customer Cash Refund from Advance Wallet',
        cheque_status: 'CLEARED',
        created_by: userId || null,
      })
      .returning('*');

    // 3. Liquidity Ledger: Insert outflow row into cash_drawer_ledger or bank_transactions
    if (isCashDrawer) {
      const hasCashDrawerTable = await trx.schema.hasTable('cash_drawer_ledger');
      if (hasCashDrawerTable) {
        await trx('cash_drawer_ledger').insert({
          type: 'OUTFLOW',
          amount: Math.abs(refundAmount),
          description: input.notes || `Cash refund to customer ${customer.name} (${refundNumber})`,
          reference_id: payment.id,
          transaction_date: input.refund_date || trx.fn.now(),
          created_by: userId || null,
        });
      }
    } else if (bankAccountId) {
      const hasBankTxTable = await trx.schema.hasTable('bank_transactions');
      if (hasBankTxTable) {
        await trx('bank_transactions').insert({
          bank_account_id: bankAccountId,
          type: 'OUTFLOW',
          amount: Math.abs(refundAmount),
          description: input.notes || `Bank refund to customer ${customer.name} (${refundNumber})`,
          transaction_date: input.refund_date || trx.fn.now(),
          category: 'CUSTOMER_REFUND',
          created_by: userId || null,
        });
      }
      await trx('bank_accounts').where('id', bankAccountId).decrement('current_balance', Math.abs(refundAmount));
    }

    // 4. Return new balance details
    const updatedBalance = await computeCustomerNetBalance(input.customer_id, trx);

    return {
      payment,
      updated_balance: updatedBalance,
    };
  });
}
