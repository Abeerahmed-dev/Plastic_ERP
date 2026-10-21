import type { Knex } from 'knex';
import db from '../../db/knex';
import { CreateCustomerRefundInput, CreateSupplierRefundInput } from './refunds.schemas';
import { computeCustomerNetBalance } from '../customers/customers.repository';
import { computeSupplierNetBalance } from '../suppliers/suppliers.repository';
import { ValidationError, NotFoundError, InsufficientLiquidityError } from '../../shared/errors';
import { getBankAccountBalance, getCashDrawerBalance } from '../bank-accounts/bank-accounts.repository';

export async function generateNextCustomerRefundNumber(trx: Knex.Transaction | Knex = db): Promise<string> {
  const rows = await trx('customer_payments')
    .where('payment_number', 'like', 'RFD-%')
    .select('payment_number');

  let maxNum = 0;
  for (const r of rows) {
    if (r.payment_number && r.payment_number.startsWith('RFD-') && !r.payment_number.startsWith('RFD-SUP-')) {
      const numPart = r.payment_number.replace('RFD-', '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `RFD-${(maxNum + 1).toString().padStart(5, '0')}`;
}

export async function generateNextSupplierRefundNumber(trx: Knex.Transaction | Knex = db): Promise<string> {
  const rows = await trx('supplier_payments')
    .where('payment_number', 'like', 'RFD-SUP-%')
    .select('payment_number');

  let maxNum = 0;
  for (const r of rows) {
    if (r.payment_number && r.payment_number.startsWith('RFD-SUP-')) {
      const numPart = r.payment_number.replace('RFD-SUP-', '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `RFD-SUP-${(maxNum + 1).toString().padStart(5, '0')}`;
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

    const refundNumber = await generateNextCustomerRefundNumber(trx);
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


    const txDate = input.payment_date || input.refund_date || input.date || new Date().toISOString().split('T')[0];

    // Determine credit source and auto-generate traceability notes
    const invoiceId = input.linked_invoice_id || (input.source_type === 'OVERPAID_INVOICE' && input.source_id && input.source_id !== 'customer-wallet-advance' ? input.source_id : null);
    let traceNote = '';

    if (input.source_type === 'OVERPAID_INVOICE' && invoiceId) {
      const inv = await trx('sales_invoices').where({ id: invoiceId }).first();
      if (inv) {
        traceNote = `Refunded overpayment from ${inv.invoice_number}`;
        const currentPaid = Number(inv.paid_amount || 0);
        const newPaid = Math.max(0, Math.round((currentPaid - refundAmount) * 100) / 100);
        const invTotal = Math.abs(Number(inv.total_amount || 0));
        const newStatus = newPaid >= invTotal ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');
        await trx('sales_invoices').where({ id: invoiceId }).update({
          paid_amount: newPaid,
          status: newStatus,
          updated_at: new Date(),
        });
      }
    } else if (input.source_type === 'ADVANCE' && input.source_id && input.source_id !== 'customer-wallet-advance') {
      const pay = await trx('customer_payments').where({ id: input.source_id }).first();
      if (pay) {
        traceNote = `Refunded advance deposit ${pay.payment_number}`;
      }
    }

    let finalNotes = input.notes?.trim() || '';
    if (traceNote) {
      finalNotes = finalNotes ? `${traceNote} — ${finalNotes}` : traceNote;
    } else if (!finalNotes) {
      finalNotes = `Customer Cash Refund from Advance Wallet - ${customer.name}`;
    }

    // 2. Customer Ledger: Insert negative payment row with payment_type = 'CASH_REFUND' and NO invoice_id
    const [payment] = await trx('customer_payments')
      .insert({
        customer_id: input.customer_id,
        invoice_id: null,
        linked_invoice_id: invoiceId,
        payment_number: refundNumber,
        payment_date: txDate,
        amount: -Math.abs(refundAmount),
        payment_method: paymentMethod,
        payment_type: 'CASH_REFUND',
        bank_account_id: bankAccountId,
        notes: finalNotes,
        cheque_status: 'CLEARED',
        created_by: userId || null,
      })
      .returning('*');

    // 3. Liquidity Ledger: Log withdrawal OUTFLOW from business bank or cash drawer
    if (isCashDrawer) {
      const hasCashDrawerTable = await trx.schema.hasTable('cash_drawer_ledger');
      if (hasCashDrawerTable) {
        await trx('cash_drawer_ledger').insert({
          type: 'OUTFLOW',
          amount: Math.abs(refundAmount),
          description: finalNotes || `Cash refund to customer ${customer.name} (${refundNumber})`,
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
          amount: Math.abs(refundAmount),
          description: finalNotes || `Bank refund to customer ${customer.name} (${refundNumber})`,
          transaction_date: txDate,
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

export async function createSupplierRefund(
  input: CreateSupplierRefundInput,
  userId?: string
) {
  return await db.transaction(async (trx) => {
    // 1. Verify supplier exists and has sufficient advance wallet balance
    const supplier = await trx('suppliers').where({ id: input.supplier_id }).first();
    if (!supplier) {
      throw new NotFoundError('Supplier');
    }

    const currentBalance = await computeSupplierNetBalance(input.supplier_id, trx);
    const refundAmount = Math.round(Number(input.amount) * 100) / 100;

    if (currentBalance.advance_payable < refundAmount) {
      throw new ValidationError(
        `Refund amount (Rs. ${refundAmount.toLocaleString()}) exceeds supplier's available Advance Wallet credit (Rs. ${currentBalance.advance_payable.toLocaleString()})`
      );
    }

    const refundNumber = await generateNextSupplierRefundNumber(trx);
    const isCashDrawer = !input.source || input.source === 'CASH_DRAWER' || input.source === 'CASH';

    let bankAccountId: string | null = null;
    let paymentMethod = 'CASH_REFUND';

    // ── Liquidity Wall: Intercept outgoing supplier refund ──
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


    const txDate = input.payment_date || input.refund_date || input.date || new Date().toISOString().split('T')[0];

    // Determine credit source and auto-generate traceability notes
    const purchaseInvoiceId = input.purchase_invoice_id || (input.source_type === 'OVERPAID_INVOICE' && input.source_id && input.source_id !== 'supplier-wallet-advance' ? input.source_id : null);
    let traceNote = '';

    if (input.source_type === 'OVERPAID_INVOICE' && purchaseInvoiceId) {
      const pi = await trx('purchase_invoices').where({ id: purchaseInvoiceId }).first();
      if (pi) {
        traceNote = `Refunded overpayment from ${pi.invoice_number}`;
        const currentPaid = Number(pi.paid_amount || 0);
        const newPaid = Math.max(0, Math.round((currentPaid - refundAmount) * 100) / 100);
        const invTotal = Math.abs(Number(pi.total_amount || 0));
        const newStatus = newPaid >= invTotal ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');
        await trx('purchase_invoices').where({ id: purchaseInvoiceId }).update({
          paid_amount: newPaid,
          status: newStatus,
          updated_at: new Date(),
        });
      }
    } else if (input.source_type === 'ADVANCE' && input.source_id && input.source_id !== 'supplier-wallet-advance') {
      const pay = await trx('supplier_payments').where({ id: input.source_id }).first();
      if (pay) {
        traceNote = `Refunded advance payment ${pay.payment_number}`;
      }
    }

    let finalNotes = input.notes?.trim() || '';
    if (traceNote) {
      finalNotes = finalNotes ? `${traceNote} — ${finalNotes}` : traceNote;
    } else if (!finalNotes) {
      finalNotes = `Supplier Cash Refund from Advance Wallet - ${supplier.name}`;
    }

    // 2. Supplier Ledger: Insert negative payment row with payment_type = 'CASH_REFUND'
    const [payment] = await trx('supplier_payments')
      .insert({
        supplier_id: input.supplier_id,
        purchase_invoice_id: purchaseInvoiceId,
        payment_number: refundNumber,
        payment_date: txDate,
        amount: -Math.abs(refundAmount),
        payment_method: paymentMethod,
        payment_type: 'CASH_REFUND',
        bank_account_id: bankAccountId,
        notes: finalNotes,
        cheque_status: 'CLEARED',
        created_by: userId || null,
      })
      .returning('*');

    // 3. Liquidity Ledger: Log withdrawal OUTFLOW from business bank or cash drawer
    if (isCashDrawer) {
      const hasCashDrawerTable = await trx.schema.hasTable('cash_drawer_ledger');
      if (hasCashDrawerTable) {
        await trx('cash_drawer_ledger').insert({
          type: 'OUTFLOW',
          amount: Math.abs(refundAmount),
          description: finalNotes || `Cash refund to supplier ${supplier.name} (${refundNumber})`,
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
          amount: Math.abs(refundAmount),
          description: finalNotes || `Bank refund to supplier ${supplier.name} (${refundNumber})`,
          transaction_date: txDate,
          category: 'SUPPLIER_REFUND',
          created_by: userId || null,
        });
      }
      await trx('bank_accounts').where('id', bankAccountId).decrement('current_balance', Math.abs(refundAmount));
    }

    // 4. Return new balance details
    const updatedBalance = await computeSupplierNetBalance(input.supplier_id, trx);

    return {
      payment,
      updated_balance: updatedBalance,
    };
  });
}
