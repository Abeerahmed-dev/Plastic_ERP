import db from '../../db/knex';
import { Knex } from 'knex';
import { CreateSupplierPaymentInput, PaymentQuery } from './supplier-payments.schemas';
import { InsufficientLiquidityError } from '../../shared/errors';
import { getCashDrawerBalance } from '../bank-accounts/bank-accounts.repository';

export async function generatePaymentNumber(trx: Knex.Transaction | Knex = db): Promise<string> {
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

  return `PAY-OUT-${(maxNum + 1).toString().padStart(5, '0')}`;
}

async function allocateSupplierPaymentToInvoices(
  trx: Knex.Transaction,
  payment: any,
  amountToAllocate: number,
  supplierId: string,
  purchaseInvoiceId?: string | null
) {
  if (purchaseInvoiceId) {
    const invoice = await trx('purchase_invoices').where('id', purchaseInvoiceId).first();
    if (!invoice) {
      throw new Error('Purchase invoice not found');
    }

    const allocRes = await trx('supplier_payment_allocations')
      .where('purchase_invoice_id', purchaseInvoiceId)
      .sum('allocated_amount as total_allocated')
      .first();

    const retRes = await trx('purchase_invoices')
      .where('parent_invoice_id', purchaseInvoiceId)
      .where(function() {
        this.where('invoice_type', 'DEBIT_NOTE')
          .orWhere('invoice_type', 'RETURN')
          .orWhere('invoice_number', 'like', 'DN-%');
      })
      .whereNot('status', 'CANCELLED')
      .sum('total_amount as total_returned')
      .first();

    const returnedTotal = Math.abs(Number(retRes?.total_returned || 0));
    const currentAllocated = Number(allocRes?.total_allocated || 0);
    const invTotal = Number(invoice.total_amount || 0);
    const netInvoiceTotal = invTotal - returnedTotal;
    const remainingUnpaid = Math.round((netInvoiceTotal - currentAllocated) * 100) / 100;

    if (remainingUnpaid <= 0 || amountToAllocate > remainingUnpaid) {
      throw new Error('PAYMENT_EXCEEDS_BALANCE');
    }

    if (amountToAllocate > 0) {
      await trx('supplier_payment_allocations').insert({
        payment_id: payment.id,
        purchase_invoice_id: purchaseInvoiceId,
        allocated_amount: amountToAllocate,
      });
    }

    const newPaidAmount = currentAllocated + amountToAllocate;
    let newStatus = 'UNPAID';
    if (newPaidAmount >= netInvoiceTotal) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIAL';
    }

    await trx('purchase_invoices')
      .where('id', invoice.id)
      .update({
        paid_amount: newPaidAmount,
        status: newStatus,
        updated_at: new Date()
      });
  } else {
    // ON-ACCOUNT PAYMENT: Automatically allocate FIFO across supplier's unpaid purchase invoices
    let remainingToAllocate = amountToAllocate;

    const unpaidInvoices = await trx('purchase_invoices')
      .where('supplier_id', supplierId)
      .whereNot('status', 'CANCELLED')
      .whereNot('status', 'PAID')
      .where(function() {
        this.whereNull('invoice_type')
          .orWhere(function() {
            this.whereNot('invoice_type', 'DEBIT_NOTE')
              .whereNot('invoice_type', 'RETURN')
              .whereNot('invoice_number', 'like', 'DN-%');
          });
      })
      .orderBy('date', 'asc')
      .orderBy('created_at', 'asc');

    let anyAllocated = false;

    for (const inv of unpaidInvoices) {
      if (remainingToAllocate <= 0) break;

      const allocRes = await trx('supplier_payment_allocations')
        .where('purchase_invoice_id', inv.id)
        .sum('allocated_amount as total_allocated')
        .first();

      const retRes = await trx('purchase_invoices')
        .where('parent_invoice_id', inv.id)
        .where(function() {
          this.where('invoice_type', 'DEBIT_NOTE')
            .orWhere('invoice_type', 'RETURN')
            .orWhere('invoice_number', 'like', 'DN-%');
        })
        .whereNot('status', 'CANCELLED')
        .sum('total_amount as total_returned')
        .first();

      const returnedTotal = Math.abs(Number(retRes?.total_returned || 0));
      const currentAllocated = Number(allocRes?.total_allocated || 0);
      const invTotal = Number(inv.total_amount || 0);
      const netInvoiceTotal = invTotal - returnedTotal;
      const remainingUnpaid = Math.round((netInvoiceTotal - currentAllocated) * 100) / 100;

      if (remainingUnpaid > 0) {
        const allocationForThisInv = Math.min(remainingToAllocate, remainingUnpaid);
        await trx('supplier_payment_allocations').insert({
          payment_id: payment.id,
          purchase_invoice_id: inv.id,
          allocated_amount: allocationForThisInv,
        });

        const newPaidAmount = currentAllocated + allocationForThisInv;
        let newStatus = 'UNPAID';
        if (newPaidAmount >= netInvoiceTotal) {
          newStatus = 'PAID';
        } else if (newPaidAmount > 0) {
          newStatus = 'PARTIAL';
        }

        await trx('purchase_invoices')
          .where('id', inv.id)
          .update({
            paid_amount: newPaidAmount,
            status: newStatus,
            updated_at: new Date(),
          });

        remainingToAllocate = Math.round((remainingToAllocate - allocationForThisInv) * 100) / 100;
        anyAllocated = true;
      }
    }

    if (anyAllocated) {
      await trx('supplier_payments')
        .where('id', payment.id)
        .update({
          payment_type: 'INVOICE_SETTLEMENT',
        });
      payment.payment_type = 'INVOICE_SETTLEMENT';
    }
  }
}

export async function createSupplierPayment(data: CreateSupplierPaymentInput, userId: string) {
  return await db.transaction(async (trx: Knex.Transaction) => {
    // ── Handle Split Payment (Cash + Bank) ──
    if (data.payment_method === 'SPLIT') {
      const splitCash = Math.round(Number(data.split_cash_amount || 0) * 100) / 100;
      const splitBank = Math.round(Number(data.split_bank_amount || 0) * 100) / 100;
      const totalAmount = Math.round((splitCash + splitBank) * 100) / 100;

      if (totalAmount <= 0) {
        throw new Error('VALIDATION_ERROR: Total payment amount must be greater than 0.');
      }

      // Check cash drawer liquidity if cash portion > 0
      if (splitCash > 0) {
        const cashBalance = await getCashDrawerBalance(trx);
        const availableBalance = parseFloat(String(cashBalance || 0));
        if (availableBalance < splitCash) {
          throw new InsufficientLiquidityError(
            `INSUFFICIENT_LIQUIDITY: Cannot withdraw ${splitCash} in Cash. Cash drawer only holds ${availableBalance}.`
          );
        }
      }

      // Check bank liquidity if bank portion > 0
      if (splitBank > 0) {
        if (!data.bank_account_id) {
          throw new Error('VALIDATION_ERROR: No bank_account_id provided for the bank transfer portion.');
        }
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.bank_account_id);
        const account = isUuid ? await trx('bank_accounts').where('id', data.bank_account_id).first() : null;
        if (!account) {
          throw new Error(`NOT_FOUND: Bank account with ID ${data.bank_account_id} does not exist.`);
        }
        const availableBalance = parseFloat(account.current_balance || 0);
        if (availableBalance < splitBank) {
          throw new InsufficientLiquidityError(
            `INSUFFICIENT_LIQUIDITY: Cannot withdraw ${splitBank} from Bank. Account only holds ${availableBalance}.`
          );
        }
      }

      // Check invoice balance if linked to invoice
      if (data.purchase_invoice_id) {
        const invoice = await trx('purchase_invoices').where('id', data.purchase_invoice_id).first();
        if (!invoice) {
          throw new Error('Purchase invoice not found');
        }
        const allocRes = await trx('supplier_payment_allocations')
          .where('purchase_invoice_id', data.purchase_invoice_id)
          .sum('allocated_amount as total_allocated')
          .first();
        const retRes = await trx('purchase_invoices')
          .where('parent_invoice_id', data.purchase_invoice_id)
          .where(function() {
            this.where('invoice_type', 'DEBIT_NOTE')
              .orWhere('invoice_type', 'RETURN')
              .orWhere('invoice_number', 'like', 'DN-%');
          })
          .whereNot('status', 'CANCELLED')
          .sum('total_amount as total_returned')
          .first();
        const returnedTotal = Math.abs(Number(retRes?.total_returned || 0));
        const currentAllocated = Number(allocRes?.total_allocated || 0);
        const invTotal = Number(invoice.total_amount || 0);
        const netInvoiceTotal = invTotal - returnedTotal;
        const remainingUnpaid = Math.round((netInvoiceTotal - currentAllocated) * 100) / 100;

        if (remainingUnpaid <= 0 || totalAmount > remainingUnpaid) {
          throw new Error('PAYMENT_EXCEEDS_BALANCE');
        }
      }

      const payment_number = await generatePaymentNumber(trx);
      let primaryPayment: any = null;

      // 1. Record Cash Portion
      if (splitCash > 0) {
        const [cashPayment] = await trx('supplier_payments').insert({
          supplier_id: data.supplier_id,
          purchase_invoice_id: data.purchase_invoice_id || null,
          payment_date: data.payment_date,
          amount: splitCash,
          payment_method: 'CASH',
          bank_account_id: null,
          notes: data.notes ? `${data.notes} [Split Cash Portion]` : 'Split Payment - Cash Portion',
          cheque_number: null,
          cheque_bank_name: null,
          cheque_due_date: null,
          cheque_status: 'CLEARED',
          payment_type: data.purchase_invoice_id ? 'INVOICE_SETTLEMENT' : 'ADVANCE_DEPOSIT',
          payment_number: splitBank > 0 ? `${payment_number}-CASH` : payment_number,
          created_by: userId,
        }).returning('*');

        primaryPayment = cashPayment;

        const hasCdl = await trx.schema.hasTable('cash_drawer_ledger');
        if (hasCdl) {
          await trx('cash_drawer_ledger').insert({
            type: 'OUTFLOW',
            amount: splitCash,
            reference_id: cashPayment.id,
            description: `Supplier Split Cash Payment (${payment_number})`,
            created_by: userId || null,
          });
        }

        await allocateSupplierPaymentToInvoices(
          trx,
          cashPayment,
          splitCash,
          data.supplier_id,
          data.purchase_invoice_id
        );
      }

      // 2. Record Bank Portion
      if (splitBank > 0) {
        const [bankPayment] = await trx('supplier_payments').insert({
          supplier_id: data.supplier_id,
          purchase_invoice_id: data.purchase_invoice_id || null,
          payment_date: data.payment_date,
          amount: splitBank,
          payment_method: 'BANK_TRANSFER',
          bank_account_id: data.bank_account_id,
          notes: data.notes ? `${data.notes} [Split Bank Portion]` : 'Split Payment - Bank Portion',
          cheque_number: null,
          cheque_bank_name: null,
          cheque_due_date: null,
          cheque_status: 'CLEARED',
          payment_type: data.purchase_invoice_id ? 'INVOICE_SETTLEMENT' : 'ADVANCE_DEPOSIT',
          payment_number: splitCash > 0 ? `${payment_number}-BANK` : payment_number,
          created_by: userId,
        }).returning('*');

        if (!primaryPayment) primaryPayment = bankPayment;

        await trx('bank_accounts')
          .where('id', data.bank_account_id)
          .decrement('current_balance', splitBank);

        await allocateSupplierPaymentToInvoices(
          trx,
          bankPayment,
          splitBank,
          data.supplier_id,
          data.purchase_invoice_id
        );
      }

      return primaryPayment;
    }

    // ── Liquidity Wall: Intercept outgoing supplier payments ──
    const paymentAmount = parseFloat((data.amount as any) || 0);
    const requestedAmount = paymentAmount;
    const isCash = (data.payment_method as string) === 'CASH' || (data.payment_method as string) === 'Cash';
    const isCheque = data.payment_method === 'CHEQUE' || data.payment_method === 'PDC';
    const chequeStatus = isCheque ? (data.cheque_status || 'PENDING') : 'CLEARED';

    if (isCash) {
      const cashBalance = await getCashDrawerBalance(trx);
      const availableBalance = parseFloat(String(cashBalance || 0));

      if (availableBalance < requestedAmount) {
        throw new InsufficientLiquidityError(
          `INSUFFICIENT_LIQUIDITY: Cannot withdraw ${requestedAmount}. Cash drawer only holds ${availableBalance}.`
        );
      }
    } else if (data.bank_account_id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.bank_account_id);
      const account = isUuid ? await trx('bank_accounts').where('id', data.bank_account_id).first() : null;

      if (!account) {
        throw new Error(`NOT_FOUND: Bank account with ID ${data.bank_account_id} does not exist.`);
      }

      const availableBalance = parseFloat(account.current_balance || 0);

      // Post-dated cheques (PDCs) are future liabilities and do not immediately debit the bank balance.
      // Enforce the liquidity check only for immediate withdrawals or cheques that are already CLEARED.
      if (!isCheque || chequeStatus === 'CLEARED') {
        if (availableBalance < requestedAmount) {
          throw new InsufficientLiquidityError(
            `INSUFFICIENT_LIQUIDITY: Cannot withdraw ${requestedAmount}. Account only holds ${availableBalance}.`
          );
        }
      }
    } else if (!isCheque) {
      throw new Error('VALIDATION_ERROR: No bank_account_id provided in the request payload.');
    }

    const payment_number = await generatePaymentNumber(trx);

    const [payment] = await trx('supplier_payments').insert({
      supplier_id: data.supplier_id,
      purchase_invoice_id: data.purchase_invoice_id || null,
      payment_date: data.payment_date,
      amount: paymentAmount,
      payment_method: data.payment_method,
      bank_account_id: isCash ? null : (data.bank_account_id || null),
      notes: data.notes || null,
      cheque_number: data.cheque_number || null,
      cheque_bank_name: data.cheque_bank_name || null,
      cheque_due_date: data.cheque_due_date || null,
      cheque_status: chequeStatus,
      payment_type: data.purchase_invoice_id ? 'INVOICE_SETTLEMENT' : 'ADVANCE_DEPOSIT',
      payment_number,
      created_by: userId,
    }).returning('*');

    if (isCash) {
      const hasCdl = await trx.schema.hasTable('cash_drawer_ledger');
      if (hasCdl) {
        await trx('cash_drawer_ledger').insert({
          type: 'OUTFLOW',
          amount: paymentAmount,
          reference_id: payment.id,
          description: `Supplier Cash Payment (${payment_number})`,
          created_by: userId || null,
        });
      }
    }

    // Decrement bank account current_balance if cleared immediately
    if (data.bank_account_id && chequeStatus === 'CLEARED') {
      await trx('bank_accounts')
        .where('id', data.bank_account_id)
        .decrement('current_balance', paymentAmount);
    }

    await allocateSupplierPaymentToInvoices(
      trx,
      payment,
      paymentAmount,
      data.supplier_id,
      data.purchase_invoice_id
    );

    return payment;
  });
}

export async function findAllPayments(query: PaymentQuery) {
  const { page, limit, search, supplier_id, purchase_invoice_id } = query;
  const offset = (page - 1) * limit;

  // 1. Fetch Purchase Invoices
  const invoicesQuery = db('purchase_invoices as pi')
    .join('suppliers as s', 'pi.supplier_id', 's.id')
    .whereNot('pi.status', 'CANCELLED')
    .modify((qb: Knex.QueryBuilder) => {
      if (supplier_id) qb.where('pi.supplier_id', supplier_id);
      if (purchase_invoice_id) qb.where('pi.id', purchase_invoice_id);
      if (search) {
        qb.where((inner: Knex.QueryBuilder) => {
          inner
            .whereILike('pi.invoice_number', `%${search}%`)
            .orWhereILike('s.name', `%${search}%`)
            .orWhereILike('s.code', `%${search}%`);
        });
      }
    })
    .select(
      'pi.id as purchase_invoice_id',
      'pi.parent_invoice_id',
      'pi.invoice_number as purchase_invoice_number',
      'pi.invoice_type',
      'pi.total_amount as invoice_total_amount',
      'pi.paid_amount',
      'pi.status as invoice_status',
      'pi.date as invoice_date',
      'pi.created_at',
      's.id as supplier_id',
      's.name as supplier_name',
      's.code as supplier_code',
      's.city as city',
      's.city as supplier_city'
    )
    .orderBy('pi.created_at', 'desc');

  const invoices = await invoicesQuery;
  const invoiceIds = invoices.map((inv: any) => inv.purchase_invoice_id);

  // 1a. Fetch linked positive supplier payments
  const rawPayments = invoiceIds.length > 0
    ? await db('supplier_payments')
        .whereIn('purchase_invoice_id', invoiceIds)
        .where('amount', '>', 0)
        .whereNotIn('cheque_status', ['BOUNCED', 'FAILED'])
        .orderBy('created_at', 'asc')
    : [];

  const linkedPaymentsMap = new Map<string, any[]>();
  for (const p of rawPayments) {
    if (p.purchase_invoice_id) {
      const list = linkedPaymentsMap.get(p.purchase_invoice_id) || [];
      list.push({
        id: p.id,
        type: 'PAYMENT',
        payment_no: p.payment_number,
        payment_number: p.payment_number,
        date: p.payment_date,
        payment_date: p.payment_date,
        method: p.payment_method || 'CASH',
        payment_method: p.payment_method || 'CASH',
        amount: Number(p.amount || 0),
        notes: p.notes,
        cheque_number: p.cheque_number,
        cheque_bank_name: p.cheque_bank_name,
        cheque_due_date: p.cheque_due_date,
        cheque_status: p.cheque_status,
        polarity: 'POSITIVE',
        created_at: p.created_at,
      });
      linkedPaymentsMap.set(p.purchase_invoice_id, list);
    }
  }

  // 1b. Fetch linked Debit Notes (purchase returns where parent_invoice_id IN invoiceIds)
  const linkedDebitNotes = invoiceIds.length > 0
    ? await db('purchase_invoices')
        .whereIn('parent_invoice_id', invoiceIds)
        .where('invoice_type', 'DEBIT_NOTE')
        .whereNot('status', 'CANCELLED')
        .select(
          'id',
          'parent_invoice_id',
          'invoice_number',
          'invoice_type',
          'date',
          'total_amount',
          'return_reason',
          'notes',
          'created_at'
        )
        .orderBy('created_at', 'asc')
    : [];

  const linkedDebitNotesMap = new Map<string, any[]>();
  for (const dn of linkedDebitNotes) {
    if (dn.parent_invoice_id) {
      const list = linkedDebitNotesMap.get(dn.parent_invoice_id) || [];
      list.push({
        id: dn.id,
        type: 'DEBIT_NOTE',
        debit_note_number: dn.invoice_number,
        payment_no: dn.invoice_number,
        payment_number: dn.invoice_number,
        invoice_number: dn.invoice_number,
        date: dn.date,
        payment_date: dn.date,
        method: 'DEBIT_NOTE',
        payment_method: 'DEBIT_NOTE',
        amount: Math.abs(Number(dn.total_amount || 0)),
        notes: dn.notes || dn.return_reason || 'Goods Returned to Supplier',
        return_reason: dn.return_reason,
        polarity: 'NEGATIVE',
        display_type: 'Goods Returned to Supplier',
        created_at: dn.created_at,
      });
      linkedDebitNotesMap.set(dn.parent_invoice_id, list);
    }
  }

  // 1c. Fetch purchased line items
  const rawPurchaseItems = invoiceIds.length > 0
    ? await db('purchase_invoice_items as pii')
        .join('products as p', 'pii.product_id', 'p.id')
        .whereIn('pii.purchase_invoice_id', invoiceIds)
        .select(
          'pii.id',
          'pii.purchase_invoice_id',
          'pii.product_id',
          'p.name as product_name',
          'p.size as product_size',
          'pii.quantity',
          'pii.selected_unit',
          'pii.unit_price',
          'pii.total_price'
        )
    : [];

  const lineItemsMap = new Map<string, any[]>();
  for (const item of rawPurchaseItems) {
    const list = lineItemsMap.get(item.purchase_invoice_id) || [];
    list.push({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product_name,
      product_size: item.product_size,
      size: item.product_size,
      quantity: Number(item.quantity || 0),
      net_qty: Number(item.quantity || 0),
      selected_unit: item.selected_unit,
      unit_price: Number(item.unit_price || 0),
      total_price: Number(item.total_price || 0),
      total: Number(item.total_price || 0),
    });
    lineItemsMap.set(item.purchase_invoice_id, list);
  }

  // Map invoices into Living Invoice rows
  const invoiceResults = invoices.map((inv: any) => {
    const payments = linkedPaymentsMap.get(inv.purchase_invoice_id) || [];
    const debitNotes = linkedDebitNotesMap.get(inv.purchase_invoice_id) || [];
    const lineItems = lineItemsMap.get(inv.purchase_invoice_id) || [];

    const totalPaid = payments.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const invoiceTotal = Math.abs(Number(inv.invoice_total_amount || 0));

    // Combine mixed transactions into chronological timeline
    const timeline = [...payments, ...debitNotes].sort((a: any, b: any) => {
      const timeA = new Date(a.created_at || a.date || a.payment_date || 0).getTime();
      const timeB = new Date(b.created_at || b.date || b.payment_date || 0).getTime();
      return timeA - timeB;
    });

    let status = inv.invoice_status;
    if (!status) {
      status = totalPaid >= invoiceTotal ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID';
    }

    return {
      id: inv.purchase_invoice_id,
      purchase_id: inv.purchase_invoice_id,
      purchase_invoice_id: inv.purchase_invoice_id,
      parent_invoice_id: inv.parent_invoice_id || null,
      purchase_invoice_number: inv.purchase_invoice_number,
      invoice_number: inv.purchase_invoice_number,
      invoice_type: inv.invoice_type || 'PURCHASE',
      supplier_id: inv.supplier_id,
      supplier_name: inv.supplier_name,
      supplier_code: inv.supplier_code,
      city: inv.city || null,
      supplier_city: inv.supplier_city || null,
      original_total: Math.round(invoiceTotal * 100) / 100,
      invoice_total_amount: Math.round(invoiceTotal * 100) / 100,
      total_paid_against_invoice: Math.round(totalPaid * 100) / 100,
      total_paid: Math.round(totalPaid * 100) / 100,
      invoice_status: status,
      line_items: lineItems,
      linked_debit_notes: debitNotes,
      payment_history: timeline,
      created_at: inv.created_at,
    };
  });

  // 2. Fetch standalone Supplier Account Payments (where purchase_invoice_id IS NULL)
  const standalonePayments = !purchase_invoice_id
    ? await db('supplier_payments as sp')
        .join('suppliers as s', 'sp.supplier_id', 's.id')
        .whereNull('sp.purchase_invoice_id')
        .whereNotIn('sp.cheque_status', ['BOUNCED', 'FAILED'])
        .modify((qb: Knex.QueryBuilder) => {
          if (supplier_id) qb.where('sp.supplier_id', supplier_id);
          if (search) {
            qb.where((inner: Knex.QueryBuilder) => {
              inner
                .whereILike('sp.payment_number', `%${search}%`)
                .orWhereILike('s.name', `%${search}%`)
                .orWhereILike('s.code', `%${search}%`);
            });
          }
        })
        .select(
          'sp.id',
          'sp.supplier_id',
          's.name as supplier_name',
          's.code as supplier_code',
          's.city as city',
          's.city as supplier_city',
          'sp.payment_number',
          'sp.payment_date',
          'sp.payment_method',
          'sp.amount',
          'sp.notes',
          'sp.cheque_number',
          'sp.cheque_bank_name',
          'sp.cheque_due_date',
          'sp.cheque_status',
          'sp.created_at'
        )
        .orderBy('sp.created_at', 'desc')
    : [];

  const standaloneResults = standalonePayments.map((p: any) => ({
    id: p.id,
    purchase_id: p.id,
    purchase_invoice_id: null,
    purchase_invoice_number: 'Account Payment',
    invoice_number: 'Account Payment',
    invoice_type: 'ACCOUNT_PAYMENT',
    supplier_id: p.supplier_id,
    supplier_name: p.supplier_name,
    supplier_code: p.supplier_code,
    city: p.city || null,
    supplier_city: p.supplier_city || null,
    original_total: 0,
    invoice_total_amount: 0,
    total_paid_against_invoice: Number(p.amount || 0),
    total_paid: Number(p.amount || 0),
    invoice_status: 'PAID',
    line_items: [],
    linked_debit_notes: [],
    payment_history: [
      {
        id: p.id,
        type: 'PAYMENT',
        payment_no: p.payment_number,
        payment_number: p.payment_number,
        date: p.payment_date,
        payment_date: p.payment_date,
        method: p.payment_method || 'CASH',
        payment_method: p.payment_method || 'CASH',
        amount: Number(p.amount || 0),
        notes: p.notes,
        cheque_number: p.cheque_number,
        cheque_bank_name: p.cheque_bank_name,
        cheque_due_date: p.cheque_due_date,
        cheque_status: p.cheque_status,
        polarity: 'POSITIVE',
        created_at: p.created_at,
      },
    ],
    created_at: p.created_at,
  }));

  const combined = [...invoiceResults, ...standaloneResults].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const total = combined.length;
  const paginatedRows = combined.slice(offset, offset + limit);

  return { rows: paginatedRows, total };
}

export async function findPaymentById(id: string) {
  return db('supplier_payments as sp')
    .join('suppliers as s', 'sp.supplier_id', 's.id')
    .leftJoin('purchase_invoices as pi', 'sp.purchase_invoice_id', 'pi.id')
    .where('sp.id', id)
    .select(
      'sp.*',
      's.name as supplier_name',
      'pi.invoice_number as purchase_invoice_number'
    )
    .first();
}

export async function clearSupplierCheque(paymentId: string): Promise<boolean> {
  const updated = await db('supplier_payments')
    .where('id', paymentId)
    .update({
      cheque_status: 'CLEARED',
      updated_at: db.fn.now(),
    });

  return updated > 0;
}
