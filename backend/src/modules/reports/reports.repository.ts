import db from '../../db/knex';
import { WALKIN_CUSTOMER_PHONE } from '../../db/seeds/06_walkin_customer';
import { computeCustomerNetBalance } from '../customers/customers.repository';
import { computeSupplierNetBalance } from '../suppliers/suppliers.repository';

export async function getDashboardMetrics() {
  const walkin = await db('customers').where({ phone: WALKIN_CUSTOMER_PHONE }).first();
  if (!walkin) return { todaySales: 0, todayTransactions: 0, weeklySales: 0, monthlySales: 0 };

  const walkinId = walkin.id;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = now.getDay() || 7; 
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const getMetricsForPeriod = async (startDate: Date) => {
    const result = await db('sales_invoices')
      .where('customer_id', walkinId)
      .andWhere('created_at', '>=', startDate)
      .sum('total_amount as revenue')
      .count('id as count')
      .first();
      
    return {
      revenue: Number(result?.revenue || 0),
      count: Number(result?.count || 0)
    };
  };

  const [today, week, month] = await Promise.all([
    getMetricsForPeriod(startOfDay),
    getMetricsForPeriod(startOfWeek),
    getMetricsForPeriod(startOfMonth)
  ]);

  return {
    todaySales: today.revenue,
    todayTransactions: today.count,
    weeklySales: week.revenue,
    monthlySales: month.revenue,
  };
}

/**
 * GET /api/reports/inventory
 * Flattened Weighted Average Costing Inventory Ledger with Lifetime Turnover & Profit Aggregation
 */
export async function getInventoryLedgerReport() {
  const products = await db('products as p')
    .join('categories as c', 'p.category_id', 'c.id')
    .where('p.is_active', true)
    .select(
      'p.id as product_id',
      'p.name as product_name',
      'p.code as product_code',
      'c.name as category',
      'p.total_stock_kg',
      'p.rolling_avg_cost_per_kg',
      'p.cost_price',
      'c.bag_weight_kg'
    )
    .orderBy('p.name', 'asc');

  // 1. Purchase Aggregation Subquery: Sum all-time KG purchased per product
  const purchaseAgg = await db('purchase_invoice_items')
    .groupBy('product_id')
    .select(
      'product_id',
      db.raw('SUM(COALESCE(net_kg_processed, net_kg_added, quantity * 25.0)) as total_kg_purchased')
    );

  // 2. Sales Aggregation Subquery: Sum all-time KG sold, total revenue, and historical COGS per product
  const salesAgg = await db('sales_invoice_items as sii')
    .join('products as p', 'sii.product_id', 'p.id')
    .groupBy('sii.product_id')
    .select(
      'sii.product_id',
      db.raw('SUM(COALESCE(sii.net_kg_processed, sii.quantity)) as total_kg_sold'),
      db.raw('SUM(sii.total_price) as total_revenue'),
      db.raw('SUM(COALESCE(sii.net_kg_processed, sii.quantity) * COALESCE(sii.applied_cogs_per_kg, p.rolling_avg_cost_per_kg, p.cost_price, 0)) as total_cogs')
    );

  const purchaseMap = new Map<string, number>();
  for (const row of purchaseAgg) {
    purchaseMap.set(row.product_id, Number(row.total_kg_purchased || 0));
  }

  const salesMap = new Map<string, { kgSold: number; revenue: number; cogs: number }>();
  for (const row of salesAgg) {
    salesMap.set(row.product_id, {
      kgSold: Number(row.total_kg_sold || 0),
      revenue: Number(row.total_revenue || 0),
      cogs: Number(row.total_cogs || 0),
    });
  }

  const allBatches = await db('inventory_batches')
    .orderBy('created_at', 'asc');

  const batchMap = new Map<string, any[]>();
  for (const b of allBatches) {
    const list = batchMap.get(b.product_id) || [];
    const orig = Math.round(Number(b.original_qty || 0) * 100) / 100;
    const rem = Math.round(Number(b.remaining_qty || 0) * 100) / 100;
    const buyPrice = Math.round(Number(b.batch_buy_price_per_kg || 0) * 100) / 100;
    const sold = Math.max(0, Math.round((orig - rem) * 100) / 100);

    list.push({
      batch_id: b.id,
      batch_number: b.batch_number,
      date: new Date(b.created_at).toISOString().split('T')[0],
      buy_price_per_kg: buyPrice,
      original_qty: orig,
      remaining_qty: rem,
      total_kg_sold: sold,
      status: b.status || (rem > 0 ? 'ACTIVE' : 'DEPLETED'),
    });
    batchMap.set(b.product_id, list);
  }

  const report = [];

  for (const p of products) {
    const total_kg = Math.round(Number(p.total_stock_kg || 0) * 100) / 100;
    const avg_cost = Math.round(Number(p.rolling_avg_cost_per_kg || 0) * 100) / 100;
    const total_asset_value = Math.round((total_kg * avg_cost) * 100) / 100;

    const bagWeight = Number(p.bag_weight_kg || 25.0);
    const approxBags = bagWeight > 0 ? Math.round((total_kg / bagWeight) * 10) / 10 : 0;
    const secondarySummary = `(approx ${approxBags} Bags @ ${bagWeight} KG/Bag)`;

    const all_time_kg_purchased = Math.round((purchaseMap.get(p.product_id) || 0) * 100) / 100;
    const salesData = salesMap.get(p.product_id) || { kgSold: 0, revenue: 0, cogs: 0 };
    const all_time_kg_sold = Math.round(salesData.kgSold * 100) / 100;
    const all_time_revenue = salesData.revenue;
    const all_time_cogs = salesData.cogs;
    const all_time_profit = Math.round((all_time_revenue - all_time_cogs) * 100) / 100;

    report.push({
      product_id: p.product_id,
      product_name: p.product_name,
      product_code: p.product_code,
      category: p.category,
      total_kg,
      avg_cost,
      total_asset_value,
      total_exact_boras: approxBags,
      secondary_units_summary: secondarySummary,
      all_time_kg_purchased,
      all_time_kg_sold,
      all_time_profit,
      batches: batchMap.get(p.product_id) || [],
    });
  }

  return report;
}

/**
 * GET /api/reports/liquidity
 */
export async function getLiquidityLedgerReport() {
  const cashPayments = await db('customer_payments')
    .whereIn('payment_method', ['Cash', 'CASH', 'CASH_DRAWER', 'CASH_REFUND'])
    .sum('amount as total')
    .first();

  const supplierCash = await db('supplier_payments')
    .whereIn('payment_method', ['Cash', 'CASH'])
    .sum('amount as total')
    .first();

  const cash_drawer = Math.max(0, Number(cashPayments?.total || 0) - Number(supplierCash?.total || 0));

  const bankInDirect = await db('customer_payments')
    .whereIn('payment_method', ['Bank Transfer', 'Online', 'BANK', 'BANK_TRANSFER'])
    .sum('amount as total')
    .first();

  const bankInClearedCheques = await db('customer_payments')
    .whereIn('payment_method', ['Cheque', 'CHEQUE', 'PDC', 'POST_DATED_CHEQUE'])
    .andWhere('cheque_status', 'CLEARED')
    .sum('amount as total')
    .first();

  const bankOutDirect = await db('supplier_payments')
    .whereIn('payment_method', ['Bank Transfer', 'Online', 'BANK', 'BANK_TRANSFER'])
    .sum('amount as total')
    .first();

  const bankOutClearedCheques = await db('supplier_payments')
    .whereIn('payment_method', ['Cheque', 'CHEQUE', 'PDC', 'POST_DATED_CHEQUE'])
    .andWhere('cheque_status', 'CLEARED')
    .sum('amount as total')
    .first();

  const bankInTotal = Number(bankInDirect?.total || 0) + Number(bankInClearedCheques?.total || 0);
  const bankOutTotal = Number(bankOutDirect?.total || 0) + Number(bankOutClearedCheques?.total || 0);

  // Dynamic Multi-Bank Account Funds Aggregation
  const bankAccounts = await db('bank_accounts').where('is_active', true);
  let bank_balances = 0;

  if (bankAccounts.length > 0) {
    const primaryId = bankAccounts[0].id;

    // Aggregate customer payments per bank account
    const custByBank = await db('customer_payments')
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

    // Aggregate supplier payments per bank account
    const suppByBank = await db('supplier_payments')
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

    const cMap = new Map<string | null, number>();
    for (const c of custByBank) cMap.set(c.bank_account_id || null, Number(c.total || 0));

    const sMap = new Map<string | null, number>();
    for (const s of suppByBank) sMap.set(s.bank_account_id || null, Number(s.total || 0));

    const unassignedIn = cMap.get(null) || 0;
    const unassignedOut = sMap.get(null) || 0;

    for (const acc of bankAccounts) {
      let tIn = cMap.get(acc.id) || 0;
      let tOut = sMap.get(acc.id) || 0;
      if (acc.id === primaryId) {
        tIn += unassignedIn;
        tOut += unassignedOut;
      }
      const accBal = Number(acc.initial_balance || 0) + tIn - tOut;
      bank_balances += accBal;
    }
  } else {
    bank_balances = Math.max(0, bankInTotal - bankOutTotal);
  }

  const pdcs = await db('customer_payments')
    .whereIn('payment_method', ['Cheque', 'CHEQUE', 'PDC', 'POST_DATED_CHEQUE'])
    .andWhere('cheque_status', 'PENDING')
    .sum('amount as total')
    .first();

  const post_dated_cheques = Number(pdcs?.total || 0);

  const issuedPdcs = await db('supplier_payments')
    .whereIn('payment_method', ['Cheque', 'CHEQUE', 'PDC', 'POST_DATED_CHEQUE'])
    .andWhere('cheque_status', 'PENDING')
    .sum('amount as total')
    .first();

  const issued_post_dated_cheques = Number(issuedPdcs?.total || 0);

  // Customer Market Receivables (Udhaar) & Customer Advance Wallet Liabilities
  const customers = await db('customers').select('id');
  let market_receivables = 0;
  let customer_advances_liability = 0;
  for (const c of customers) {
    const netDetails = await computeCustomerNetBalance(c.id);
    market_receivables += netDetails.outstanding_balance;
    customer_advances_liability += netDetails.advance_credit;
  }

  // Inventory Asset Value (Unsold Stock Value in warehouse)
  const inventoryReport = await getInventoryLedgerReport();
  const total_inventory_value = inventoryReport.reduce((sum, item) => sum + Number(item.total_asset_value || 0), 0);

  // Accounts Payable (Supplier debt owed to market) & Supplier Advances Asset using Global Account Netting
  const suppliers = await db('suppliers').select('id');
  let total_accounts_payable = 0;
  let supplier_advances_asset = 0;
  for (const s of suppliers) {
    const netDetails = await computeSupplierNetBalance(s.id);
    total_accounts_payable += netDetails.outstanding_payable;
    supplier_advances_asset += netDetails.advance_payable;
  }

  const total_liquid = cash_drawer + bank_balances;
  const net_business_capital = (total_liquid + market_receivables + total_inventory_value) - total_accounts_payable;

  return {
    cash_drawer: Math.round(cash_drawer * 100) / 100,
    bank_balances: Math.round(bank_balances * 100) / 100,
    post_dated_cheques: Math.round(post_dated_cheques * 100) / 100,
    issued_post_dated_cheques: Math.round(issued_post_dated_cheques * 100) / 100,
    market_receivables: Math.round(market_receivables * 100) / 100,
    total_inventory_value: Math.round(total_inventory_value * 100) / 100,
    total_accounts_payable: Math.round(total_accounts_payable * 100) / 100,
    customer_advances_liability: Math.round(customer_advances_liability * 100) / 100,
    supplier_advances_asset: Math.round(supplier_advances_asset * 100) / 100,
    total_liquid: Math.round(total_liquid * 100) / 100,
    net_business_capital: Math.round(net_business_capital * 100) / 100,
    total_market_capital: Math.round((total_liquid + post_dated_cheques + market_receivables) * 100) / 100,
  };
}

/**
 * GET /api/reports/liquidity/receivables
 */
export async function getLiquidityReceivablesDetail() {
  const customers = await db('customers').select('*');
  const list = [];

  for (const c of customers) {
    const netDetails = await computeCustomerNetBalance(c.id);

    if (netDetails.outstanding_balance > 0 || netDetails.advance_credit > 0) {
      list.push({
        customer_id: c.id,
        name: c.name,
        code: c.code,
        phone: c.phone || 'N/A',
        city: c.city || 'N/A',
        opening_balance: netDetails.opening_balance,
        invoice_balance: Math.round((netDetails.total_billed - netDetails.opening_balance) * 100) / 100,
        total_receivable: netDetails.outstanding_balance,
        advance_credit: netDetails.advance_credit,
        net_balance: netDetails.net_balance,
      });
    }
  }

  return list.sort((a, b) => b.total_receivable - a.total_receivable);
}

/**
 * GET /api/reports/liquidity/customer-advances
 */
export async function getLiquidityCustomerAdvancesDetail() {
  const customers = await db('customers').select('*');
  const list = [];

  for (const c of customers) {
    const netDetails = await computeCustomerNetBalance(c.id);

    if (netDetails.advance_credit > 0) {
      list.push({
        customer_id: c.id,
        name: c.name,
        code: c.code,
        phone: c.phone || 'N/A',
        city: c.city || 'N/A',
        opening_balance: netDetails.opening_balance,
        total_billed: netDetails.total_billed,
        total_paid: netDetails.total_paid,
        advance_credit: netDetails.advance_credit,
        net_balance: netDetails.net_balance,
      });
    }
  }

  return list.sort((a, b) => b.advance_credit - a.advance_credit);
}

/**
 * GET /api/reports/liquidity/payables
 */
export async function getLiquidityPayablesDetail() {
  const suppliers = await db('suppliers').select('*');
  const list = [];

  for (const s of suppliers) {
    const netDetails = await computeSupplierNetBalance(s.id);

    if (netDetails.outstanding_payable > 0 || netDetails.advance_payable > 0) {
      list.push({
        supplier_id: s.id,
        name: s.name,
        code: s.code,
        phone: s.phone || 'N/A',
        city: s.city || 'N/A',
        opening_payable: netDetails.opening_payable,
        invoice_balance: Math.round((netDetails.total_billed - netDetails.opening_payable) * 100) / 100,
        total_payable: netDetails.outstanding_payable,
        advance_payable: netDetails.advance_payable,
        net_balance: netDetails.net_balance,
      });
    }
  }

  return list.sort((a, b) => b.total_payable - a.total_payable);
}

/**
 * GET /api/reports/liquidity/supplier-advances
 */
export async function getLiquiditySupplierAdvancesDetail() {
  const suppliers = await db('suppliers').select('*');
  const list = [];

  for (const s of suppliers) {
    const netDetails = await computeSupplierNetBalance(s.id);

    if (netDetails.advance_payable > 0) {
      list.push({
        supplier_id: s.id,
        name: s.name,
        code: s.code,
        phone: s.phone || 'N/A',
        city: s.city || 'N/A',
        opening_payable: netDetails.opening_payable,
        total_billed: netDetails.total_billed,
        total_paid: netDetails.total_paid,
        advance_payable: netDetails.advance_payable,
        net_balance: netDetails.net_balance,
      });
    }
  }

  return list.sort((a, b) => b.advance_payable - a.advance_payable);
}

/**
 * GET /api/reports/liquidity/unsold-stock
 */
export async function getLiquidityUnsoldStockDetail() {
  const inventory = await getInventoryLedgerReport();
  return inventory
    .filter((item) => item.total_kg > 0)
    .map((item) => ({
      product_id: item.product_id,
      name: item.product_name,
      code: item.product_code,
      category: item.category,
      remaining_kg: item.total_kg,
      avg_cost: item.avg_cost,
      total_asset_value: item.total_asset_value,
      secondary_units_summary: item.secondary_units_summary,
    }))
    .sort((a, b) => b.total_asset_value - a.total_asset_value);
}

/**
 * GET /api/reports/sales-margin?timeFilter=...&productId=...
 * Dynamic Sales & Margin Report (WAC COGS)
 */
export async function getSalesMarginReport(productId?: string, timeFilter?: string) {
  const now = new Date();
  let startDate: Date | null = null;
  let endDate: Date = now;

  if (timeFilter === 'today') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (timeFilter === 'last_7_days') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  } else if (timeFilter === 'last_2_days') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  } else if (timeFilter === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  let query = db('sales_invoice_items as sii')
    .innerJoin('sales_invoices as si', 'sii.invoice_id', 'si.id')
    .leftJoin('products as p', 'sii.product_id', 'p.id')
    .select(
      'si.id as invoice_id',
      'si.total_amount',
      'si.paid_amount',
      'sii.product_id',
      'sii.quantity',
      'sii.unit_price',
      'sii.total_price',
      'sii.net_kg_processed',
      'sii.applied_cogs_per_kg',
      'p.rolling_avg_cost_per_kg',
      'p.cost_price as product_cost_price'
    );

  if (startDate) {
    query = query.where('si.created_at', '>=', startDate).andWhere('si.created_at', '<=', endDate);
  }

  if (productId) {
    query = query.where('sii.product_id', productId);
  }

  const rows = await query;

  let total_sales_value = 0;
  let total_cogs = 0;
  let period_cash_received = 0;

  const processedInvoices = new Set<string>();

  for (const r of rows) {
    const lineVal = Number(r.total_price || 0);
    total_sales_value += lineVal;

    const kg = Number(r.net_kg_processed || r.quantity || 0);
    const appliedCogs = Number(r.applied_cogs_per_kg || r.rolling_avg_cost_per_kg || r.product_cost_price || 0);
    total_cogs += kg * appliedCogs;

    if (!processedInvoices.has(r.invoice_id)) {
      processedInvoices.add(r.invoice_id);
      const invTotal = Number(r.total_amount || 0);
      const invPaid = Number(r.paid_amount || 0);
      if (productId && invTotal > 0) {
        period_cash_received += lineVal * (invPaid / invTotal);
      } else {
        period_cash_received += invPaid;
      }
    }
  }

  total_sales_value = Math.round(total_sales_value * 100) / 100;
  total_cogs = Math.round(total_cogs * 100) / 100;
  const net_margin = Math.round((total_sales_value - total_cogs) * 100) / 100;
  const gross_margin_percent = total_sales_value > 0 ? Math.round((net_margin / total_sales_value) * 10000) / 10000 : 0;
  period_cash_received = Math.round(period_cash_received * 100) / 100;
  const period_udhaar_generated = Math.round(Math.max(0, total_sales_value - period_cash_received) * 100) / 100;

  return {
    time_filter: timeFilter || 'all_time',
    product_id: productId || null,
    total_sales_value,
    total_cogs,
    net_margin,
    gross_margin_percent,
    period_cash_received,
    period_udhaar_generated,
  };
}

export async function getProfitMatrixReport(productId?: string, timeFilter?: string) {
  return getSalesMarginReport(productId, timeFilter);
}

export async function getCashierTallyReport(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const paymentsResult = await db('customer_payments')
    .where('created_by', userId)
    .where('created_at', '>=', startOfDay)
    .whereIn('payment_method', ['CASH', 'CASH_DRAWER', 'Cash', 'CASH_REFUND'])
    .sum('amount as total')
    .count('id as count')
    .first();

  const customerPaymentsCash = Number(paymentsResult?.total || 0);
  const paymentsCount = Number(paymentsResult?.count || 0);

  const posSalesResult = await db('sales_invoices')
    .where('created_by', userId)
    .where('created_at', '>=', startOfDay)
    .sum('paid_amount as total')
    .count('id as count')
    .first();

  const posSalesCash = Number(posSalesResult?.total || 0);
  const posSalesCount = Number(posSalesResult?.count || 0);

  const totalCashTally = customerPaymentsCash + posSalesCash;
  const totalCount = paymentsCount + posSalesCount;

  return {
    cashier_id: userId,
    today_date: startOfDay.toISOString().split('T')[0],
    customer_payments_cash: customerPaymentsCash,
    pos_sales_cash: posSalesCash,
    total_cash_tally: totalCashTally,
    transaction_count: totalCount,
  };
}

export async function getPnLReport(startDate?: string, endDate?: string) {
  try {
    let salesQuery = db('sales_invoices as si')
      .whereNot('si.status', 'CANCELLED')
      .select(db.raw('SUM(CAST(si.total_amount AS NUMERIC)) as total'));

    let cogsQuery = db('sales_invoice_items as sii')
      .innerJoin('sales_invoices as si', 'sii.invoice_id', 'si.id')
      .leftJoin('products as p', 'sii.product_id', 'p.id')
      .whereNot('si.status', 'CANCELLED')
      .select(db.raw('SUM(CAST(COALESCE(sii.net_kg_processed, sii.quantity) AS NUMERIC) * CAST(COALESCE(sii.applied_cogs_per_kg, p.rolling_avg_cost_per_kg, p.cost_price, 0) AS NUMERIC)) as total_cogs'));

    let expensesQuery = db('expenses as e')
      .select(db.raw('SUM(CAST(e.amount AS NUMERIC)) as total'));

    if (startDate) {
      const startDateOnly = startDate.includes('T') ? startDate.split('T')[0] : startDate;
      salesQuery = salesQuery.where(function () {
        this.where('si.created_at', '>=', startDate).orWhereRaw('si.date >= ?', [startDateOnly]);
      });
      cogsQuery = cogsQuery.where(function () {
        this.where('si.created_at', '>=', startDate).orWhereRaw('si.date >= ?', [startDateOnly]);
      });
      expensesQuery = expensesQuery.where(function () {
        this.where('e.created_at', '>=', startDate).orWhereRaw('e.expense_date::text >= ?', [startDateOnly]);
      });
    }

    if (endDate) {
      const endDateOnly = endDate.includes('T') ? endDate.split('T')[0] : endDate;
      salesQuery = salesQuery.where(function () {
        this.where('si.created_at', '<=', endDate).orWhereRaw('si.date <= ?', [endDateOnly]);
      });
      cogsQuery = cogsQuery.where(function () {
        this.where('si.created_at', '<=', endDate).orWhereRaw('si.date <= ?', [endDateOnly]);
      });
      expensesQuery = expensesQuery.where(function () {
        this.where('e.created_at', '<=', endDate).orWhereRaw('e.expense_date::text <= ?', [endDateOnly]);
      });
    }

    console.log('[DEBUG Knex] Sales Query SQL:', salesQuery.toSQL().toNative());
    console.log('[DEBUG Knex] Expenses Query SQL:', expensesQuery.toSQL().toNative());

    const [salesRes, cogsRes, expRes] = await Promise.all([
      salesQuery.first(),
      cogsQuery.first(),
      expensesQuery.first(),
    ]);

    console.log('[DEBUG Knex] Sales Res:', salesRes);
    console.log('[DEBUG Knex] Expenses Res:', expRes);

    const total_sales = Math.round(Number((salesRes as any)?.total || 0) * 100) / 100;
    const total_cogs = Math.round(Number((cogsRes as any)?.total_cogs || 0) * 100) / 100;
    const total_expenses = Math.round(Number((expRes as any)?.total || 0) * 100) / 100;
    const gross_profit = Math.round((total_sales - total_cogs) * 100) / 100;
    const net_profit = Math.round((gross_profit - total_expenses) * 100) / 100;
    const net_profit_margin_percent = total_sales > 0 ? Math.round((net_profit / total_sales) * 10000) / 10000 : 0;

    return {
      total_sales,
      total_cogs,
      gross_profit,
      total_expenses,
      net_profit,
      net_profit_margin_percent,
    };
  } catch (err: any) {
    console.error("P&L API CRASH in getPnLReport:", err?.message || err, err?.stack);
    throw err;
  }
}

export async function getCashLedgerReport(startDate?: string, endDate?: string) {
  let custQuery = db('customer_payments as cp')
    .leftJoin('customers as c', 'cp.customer_id', 'c.id')
    .leftJoin('sales_invoices as si', 'cp.invoice_id', 'si.id')
    .leftJoin('sales_invoice_items as sii', 'si.id', 'sii.invoice_id')
    .leftJoin('products as p', 'sii.product_id', 'p.id')
    .whereIn('cp.payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'CASH_REFUND'])
    .select(
      'cp.id',
      'cp.payment_date as date',
      'cp.created_at',
      'cp.payment_number',
      'si.invoice_number',
      'si.notes as invoice_notes',
      'cp.notes',
      'c.name as customer_name',
      'cp.amount as amount',
      db.raw(`
        COALESCE(
          json_agg(
            json_build_object(
              'product_name', p.name,
              'qty', sii.quantity,
              'net_kg', COALESCE(sii.net_kg_processed, sii.quantity),
              'price', sii.unit_price,
              'total', sii.total_price
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) as order_details
      `)
    )
    .groupBy(
      'cp.id',
      'cp.payment_date',
      'cp.created_at',
      'cp.payment_number',
      'c.name',
      'si.invoice_number',
      'si.notes',
      'cp.notes',
      'cp.amount'
    )
    .orderBy('cp.created_at', 'desc');

  let suppQuery = db('supplier_payments as sp')
    .leftJoin('suppliers as s', 'sp.supplier_id', 's.id')
    .whereIn('sp.payment_method', ['CASH', 'Cash', 'CASH_DRAWER', 'CASH_REFUND'])
    .select(
      'sp.id',
      'sp.payment_date as date',
      'sp.created_at',
      'sp.payment_number',
      'sp.notes',
      's.name as supplier_name',
      'sp.amount'
    )
    .orderBy('sp.created_at', 'desc');

  let expQuery = db('expenses as e')
    .whereIn('e.payment_method', ['CASH', 'Cash', 'Cash in Drawer'])
    .select(
      'e.id',
      'e.expense_date as date',
      'e.created_at',
      'e.category',
      'e.description',
      'e.amount'
    )
    .orderBy('e.created_at', 'desc');

  if (startDate) {
    const startDateOnly = startDate.includes('T') ? startDate.split('T')[0] : startDate;
    custQuery = custQuery.where(function () {
      this.where('cp.created_at', '>=', startDate).orWhereRaw('cp.payment_date::text >= ?', [startDateOnly]);
    });
    suppQuery = suppQuery.where(function () {
      this.where('sp.created_at', '>=', startDate).orWhereRaw('sp.payment_date::text >= ?', [startDateOnly]);
    });
    expQuery = expQuery.where(function () {
      this.where('e.created_at', '>=', startDate).orWhereRaw('e.expense_date::text >= ?', [startDateOnly]);
    });
  }

  if (endDate) {
    const endDateOnly = endDate.includes('T') ? endDate.split('T')[0] : endDate;
    custQuery = custQuery.where(function () {
      this.where('cp.created_at', '<=', endDate).orWhereRaw('cp.payment_date::text <= ?', [endDateOnly]);
    });
    suppQuery = suppQuery.where(function () {
      this.where('sp.created_at', '<=', endDate).orWhereRaw('sp.payment_date::text <= ?', [endDateOnly]);
    });
    expQuery = expQuery.where(function () {
      this.where('e.created_at', '<=', endDate).orWhereRaw('e.expense_date::text <= ?', [endDateOnly]);
    });
  }

  const [custRows, suppRows, expRows] = await Promise.all([custQuery, suppQuery, expQuery]);

  const results: any[] = [];

  for (const item of custRows) {
    const rawOrderDetails = typeof item.order_details === 'string'
      ? JSON.parse(item.order_details)
      : (Array.isArray(item.order_details) ? item.order_details : []);

    const amt = Number(item.amount || 0);
    const isRefund = amt < 0;

    const isPos = Boolean(
      (item.payment_number && item.payment_number.includes('POS')) ||
      (item.invoice_number && item.invoice_number.startsWith('POS')) ||
      (item.notes && item.notes.toLowerCase().includes('pos')) ||
      (item.invoice_notes && item.invoice_notes.toLowerCase().includes('pos'))
    );

    if (isRefund) {
      results.push({
        id: item.id,
        date: item.date,
        created_at: item.created_at,
        entry_type: 'CASH REFUND',
        source: 'OUTFLOW',
        source_type: 'OUTFLOW',
        transaction_type: 'WITHDRAWAL',
        description: `Customer Cash Refund: ${item.customer_name || 'Customer'}${item.invoice_number ? ` (Inv #${item.invoice_number})` : ''}`,
        amount: Math.abs(amt),
        cash_out: Math.abs(amt),
        cash_in: 0,
        order_details: Array.isArray(rawOrderDetails) ? rawOrderDetails : [],
      });
    } else {
      const source: 'POS' | 'CUSTOMER_PAYMENT' = isPos ? 'POS' : 'CUSTOMER_PAYMENT';
      results.push({
        id: item.id,
        date: item.date,
        created_at: item.created_at,
        entry_type: isPos ? 'POS SALE' : 'CASH PAYMENT',
        source,
        source_type: source,
        transaction_type: 'DEPOSIT',
        description: isPos
          ? `Walk-in POS Sale: ${item.customer_name || 'Counter Customer'}`
          : `Cash Payment from ${item.customer_name || 'Customer'}${item.invoice_number ? ` (Inv #${item.invoice_number})` : ''}`,
        amount: amt,
        cash_in: amt,
        cash_out: 0,
        order_details: Array.isArray(rawOrderDetails) ? rawOrderDetails : [],
      });
    }
  }

  for (const sp of suppRows) {
    const amt = Number(sp.amount || 0);
    if (amt >= 0) {
      results.push({
        id: sp.id,
        date: sp.date,
        created_at: sp.created_at,
        entry_type: 'SUPPLIER PAYMENT',
        source: 'OUTFLOW',
        source_type: 'OUTFLOW',
        transaction_type: 'WITHDRAWAL',
        description: `Cash Payment to Supplier: ${sp.supplier_name || 'Vendor'}${sp.payment_number ? ` (${sp.payment_number})` : ''}`,
        amount: amt,
        cash_out: amt,
        cash_in: 0,
        order_details: [],
      });
    } else {
      results.push({
        id: sp.id,
        date: sp.date,
        created_at: sp.created_at,
        entry_type: 'SUPPLIER REFUND',
        source: 'CUSTOMER_PAYMENT',
        source_type: 'CUSTOMER_PAYMENT',
        transaction_type: 'DEPOSIT',
        description: `Supplier Cash Refund: ${sp.supplier_name || 'Vendor'}`,
        amount: Math.abs(amt),
        cash_in: Math.abs(amt),
        cash_out: 0,
        order_details: [],
      });
    }
  }

  for (const exp of expRows) {
    const amt = Number(exp.amount || 0);
    results.push({
      id: exp.id,
      date: exp.date,
      created_at: exp.created_at,
      entry_type: 'EXPENSE',
      source: 'OUTFLOW',
      source_type: 'OUTFLOW',
      transaction_type: 'WITHDRAWAL',
      description: `Cash Expense: ${exp.category || 'General'}${exp.description ? ` (${exp.description})` : ''}`,
      amount: amt,
      cash_out: amt,
      cash_in: 0,
      order_details: [],
    });
  }

  results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return results;
}

export async function getPdcReport() {
  const customerPdcs = await db('customer_payments as cp')
    .join('customers as c', 'cp.customer_id', 'c.id')
    .leftJoin('sales_invoices as si', 'cp.invoice_id', 'si.id')
    .whereIn('cp.payment_method', ['Cheque', 'CHEQUE', 'PDC', 'POST_DATED_CHEQUE'])
    .andWhere('cp.cheque_status', 'PENDING')
    .select(
      'cp.id',
      'cp.payment_number',
      'cp.payment_date',
      'cp.amount',
      'cp.cheque_number',
      'cp.cheque_bank_name',
      'cp.cheque_due_date',
      'cp.cheque_status',
      'c.id as customer_id',
      'c.name as customer_name',
      'c.code as customer_code',
      'si.invoice_number'
    )
    .orderBy('cp.cheque_due_date', 'asc');

  return customerPdcs.map((item) => ({
    id: item.id,
    payment_number: item.payment_number,
    payment_date: item.payment_date,
    amount: Number(item.amount || 0),
    cheque_number: item.cheque_number || 'N/A',
    cheque_bank_name: item.cheque_bank_name || 'N/A',
    cheque_due_date: item.cheque_due_date || item.payment_date,
    cheque_status: item.cheque_status || 'PENDING',
    customer_id: item.customer_id,
    customer_name: item.customer_name,
    customer_code: item.customer_code,
    invoice_number: item.invoice_number || null,
  }));
}

export async function getIssuedPdcReport() {
  const supplierPdcs = await db('supplier_payments as sp')
    .join('suppliers as s', 'sp.supplier_id', 's.id')
    .leftJoin('purchase_invoices as pi', 'sp.purchase_invoice_id', 'pi.id')
    .whereIn('sp.payment_method', ['Cheque', 'CHEQUE', 'PDC', 'POST_DATED_CHEQUE'])
    .andWhere('sp.cheque_status', 'PENDING')
    .select(
      'sp.id',
      'sp.payment_number',
      'sp.payment_date',
      'sp.amount',
      'sp.cheque_number',
      'sp.cheque_bank_name',
      'sp.cheque_due_date',
      'sp.cheque_status',
      's.id as supplier_id',
      's.name as supplier_name',
      's.code as supplier_code',
      'pi.invoice_number'
    )
    .orderBy('sp.cheque_due_date', 'asc');

  return supplierPdcs.map((item) => ({
    id: item.id,
    payment_number: item.payment_number,
    payment_date: item.payment_date,
    amount: Number(item.amount || 0),
    cheque_number: item.cheque_number || 'N/A',
    cheque_bank_name: item.cheque_bank_name || 'N/A',
    cheque_due_date: item.cheque_due_date || item.payment_date,
    cheque_status: item.cheque_status || 'PENDING',
    supplier_id: item.supplier_id,
    supplier_name: item.supplier_name,
    supplier_code: item.supplier_code,
    invoice_number: item.invoice_number || null,
  }));
}

export async function getIncomeStatementReport(startDate?: string, endDate?: string) {
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const sDate = startDate || firstDay;
    const eDate = endDate || today;

    // 1. Gross Sales & Delivery Revenue Query
    let salesQuery = db('sales_invoices as si')
      .whereNot('si.status', 'CANCELLED')
      .where(function () {
        this.whereNull('si.invoice_type').orWhere('si.invoice_type', 'SALE');
      })
      .select(
        db.raw('SUM(CAST(COALESCE(si.total_amount, 0) AS NUMERIC) - CAST(COALESCE(si.delivery_charge, 0) AS NUMERIC)) as gross_sales'),
        db.raw('SUM(CAST(COALESCE(si.delivery_charge, 0) AS NUMERIC)) as delivery_revenue')
      );

    // 2. Sales Returns Query
    let returnsQuery = db('sales_invoices as si')
      .whereNot('si.status', 'CANCELLED')
      .where(function () {
        this.where('si.invoice_type', 'CREDIT_NOTE')
          .orWhere('si.invoice_type', 'RETURN')
          .orWhere('si.total_amount', '<', 0);
      })
      .select(db.raw('SUM(ABS(CAST(COALESCE(si.total_amount, 0) AS NUMERIC))) as total_returns'));

    // 3. COGS Query (aggregates sales COGS and reduces by exact restored COGS from credit notes / returns)
    let cogsQuery = db('sales_invoice_items as sii')
      .innerJoin('sales_invoices as si', 'sii.invoice_id', 'si.id')
      .leftJoin('products as p', 'sii.product_id', 'p.id')
      .whereNot('si.status', 'CANCELLED')
      .where(function () {
        this.whereNull('si.invoice_type')
          .orWhere('si.invoice_type', 'SALE')
          .orWhere('si.invoice_type', 'CREDIT_NOTE')
          .orWhere('si.invoice_type', 'RETURN');
      })
      .select(
        db.raw(
          'SUM(CAST(COALESCE(sii.net_kg_processed, sii.quantity) AS NUMERIC) * CAST(COALESCE(sii.applied_cogs_per_kg, p.rolling_avg_cost_per_kg, p.cost_price, 0) AS NUMERIC)) as total_cogs'
        )
      );

    // 4. Operating Expenses Query
    let expensesQuery = db('expenses as e').select(db.raw('SUM(CAST(COALESCE(e.amount, 0) AS NUMERIC)) as total_expenses'));

    // 5. Expenses Breakdown Query
    let expensesBreakdownQuery = db('expenses as e')
      .select('category', db.raw('SUM(CAST(COALESCE(amount, 0) AS NUMERIC)) as total'))
      .groupBy('category')
      .orderBy('total', 'desc');

    const sDateOnly = sDate.includes('T') ? sDate.split('T')[0] : sDate;
    const eDateOnly = eDate.includes('T') ? eDate.split('T')[0] : eDate;
    const endTimestamp = eDate.includes('T') ? eDate : `${eDate}T23:59:59.999Z`;

    salesQuery = salesQuery.where(function () {
      this.where('si.created_at', '>=', sDate).orWhereRaw('si.date >= ?', [sDateOnly]);
    }).where(function () {
      this.where('si.created_at', '<=', endTimestamp).orWhereRaw('si.date <= ?', [eDateOnly]);
    });

    returnsQuery = returnsQuery.where(function () {
      this.where('si.created_at', '>=', sDate).orWhereRaw('si.date >= ?', [sDateOnly]);
    }).where(function () {
      this.where('si.created_at', '<=', endTimestamp).orWhereRaw('si.date <= ?', [eDateOnly]);
    });

    cogsQuery = cogsQuery.where(function () {
      this.where('si.created_at', '>=', sDate).orWhereRaw('si.date >= ?', [sDateOnly]);
    }).where(function () {
      this.where('si.created_at', '<=', endTimestamp).orWhereRaw('si.date <= ?', [eDateOnly]);
    });

    expensesQuery = expensesQuery.where(function () {
      this.where('e.created_at', '>=', sDate).orWhereRaw('e.expense_date::text >= ?', [sDateOnly]);
    }).where(function () {
      this.where('e.created_at', '<=', endTimestamp).orWhereRaw('e.expense_date::text <= ?', [eDateOnly]);
    });

    expensesBreakdownQuery = expensesBreakdownQuery.where(function () {
      this.where('e.created_at', '>=', sDate).orWhereRaw('e.expense_date::text >= ?', [sDateOnly]);
    }).where(function () {
      this.where('e.created_at', '<=', endTimestamp).orWhereRaw('e.expense_date::text <= ?', [eDateOnly]);
    });

    const [salesRes, returnsRes, cogsRes, expRes, breakdownRes] = await Promise.all([
      salesQuery.first(),
      returnsQuery.first(),
      cogsQuery.first(),
      expensesQuery.first(),
      expensesBreakdownQuery,
    ]);

    const gross_sales = Math.round(Number((salesRes as any)?.gross_sales || 0) * 100) / 100;
    const delivery_revenue = Math.round(Number((salesRes as any)?.delivery_revenue || 0) * 100) / 100;
    const sales_returns = Math.round(Number((returnsRes as any)?.total_returns || 0) * 100) / 100;
    const net_revenue = Math.round((gross_sales + delivery_revenue - sales_returns) * 100) / 100;

    const cogs = Math.round(Number((cogsRes as any)?.total_cogs || 0) * 100) / 100;
    const gross_profit = Math.round((net_revenue - cogs) * 100) / 100;
    const gross_margin_pct = net_revenue > 0 ? Math.round(((gross_profit / net_revenue) * 100) * 100) / 100 : 0;

    const operating_expenses = Math.round(Number((expRes as any)?.total_expenses || 0) * 100) / 100;
    const net_profit = Math.round((gross_profit - operating_expenses) * 100) / 100;
    const net_margin_pct = net_revenue > 0 ? Math.round(((net_profit / net_revenue) * 100) * 100) / 100 : 0;

    const expenses_breakdown = (breakdownRes || []).map((row: any) => ({
      category: row.category || 'Other',
      amount: Math.round(Number(row.total || 0) * 100) / 100,
    }));

    return {
      startDate: sDateOnly,
      endDate: eDateOnly,
      gross_sales,
      delivery_revenue,
      sales_returns,
      net_revenue,
      cogs,
      gross_profit,
      gross_margin_pct,
      operating_expenses,
      expenses_breakdown,
      net_profit,
      net_margin_pct,
    };
  } catch (err: any) {
    console.error('Income Statement API Crash:', err?.message || err, err?.stack);
    throw err;
  }
}

export async function getIncomeStatementReturnsDetail(startDate?: string, endDate?: string) {
  try {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];

    const sDate = startDate || firstDay;
    const eDate = endDate || today;

    const sDateOnly = sDate.includes('T') ? sDate.split('T')[0] : sDate;
    const eDateOnly = eDate.includes('T') ? eDate.split('T')[0] : eDate;
    const endTimestamp = eDate.includes('T') ? eDate : `${eDate}T23:59:59.999Z`;

    let query = db('sales_invoices as si')
      .innerJoin('sales_invoice_items as sii', 'sii.invoice_id', 'si.id')
      .leftJoin('customers as c', 'si.customer_id', 'c.id')
      .leftJoin('products as p', 'sii.product_id', 'p.id')
      .leftJoin('sales_invoices as psi', 'si.parent_invoice_id', 'psi.id')
      .whereNot('si.status', 'CANCELLED')
      .where(function () {
        this.where('si.invoice_type', 'CREDIT_NOTE')
          .orWhere('si.invoice_type', 'RETURN')
          .orWhere('si.total_amount', '<', 0);
      })
      .select(
        'si.id as credit_note_id',
        'si.invoice_number as credit_note_number',
        'si.parent_invoice_id',
        'psi.invoice_number as original_invoice_number',
        'si.created_at',
        'si.date',
        'c.name as customer_name',
        'p.name as product_name',
        db.raw('ABS(CAST(COALESCE(sii.net_kg_processed, sii.quantity, 0) AS NUMERIC)) as returned_kg'),
        db.raw('ABS(CAST(COALESCE(sii.total_price, si.total_amount, 0) AS NUMERIC)) as refund_amount')
      )
      .orderBy('si.created_at', 'desc');

    query = query.where(function () {
      this.where('si.created_at', '>=', sDate).orWhereRaw('si.date >= ?', [sDateOnly]);
    }).where(function () {
      this.where('si.created_at', '<=', endTimestamp).orWhereRaw('si.date <= ?', [eDateOnly]);
    });

    const rows = await query;

    return rows.map((r: any) => {
      let dateStr = '';
      if (r.date) {
        dateStr = String(r.date).split('T')[0];
      } else if (r.created_at) {
        dateStr = new Date(r.created_at).toISOString().split('T')[0];
      }

      return {
        date: dateStr,
        credit_note_id: r.credit_note_number || (r.credit_note_id ? `CN-${r.credit_note_id.slice(0, 8)}` : 'CN-N/A'),
        original_invoice_id: r.original_invoice_number || (r.parent_invoice_id ? `INV-${r.parent_invoice_id.slice(0, 8)}` : 'Direct Return'),
        customer_name: r.customer_name || 'Walk-in / Cash Customer',
        product_name: r.product_name || 'Returned Goods',
        returned_kg: Math.round(Number(r.returned_kg || 0) * 100) / 100,
        refund_amount: Math.round(Number(r.refund_amount || 0) * 100) / 100,
      };
    });
  } catch (err: any) {
    console.error('Income Statement Returns Detail Crash:', err?.message || err, err?.stack);
    throw err;
  }
}

export async function getMarginAnalyticsReport(startDate?: string, endDate?: string) {
  try {
    const sDateOnly = startDate ? (startDate.includes('T') ? startDate.split('T')[0] : startDate) : undefined;
    const eDateOnly = endDate ? (endDate.includes('T') ? endDate.split('T')[0] : endDate) : undefined;

    // 1. Margin by Product
    let pQuery = db('sales_invoice_items as sii')
      .join('sales_invoices as si', 'sii.invoice_id', 'si.id')
      .join('products as p', 'sii.product_id', 'p.id')
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .whereNot('si.status', 'CANCELLED')
      .where(function () {
        this.whereNull('si.invoice_type')
          .orWhere('si.invoice_type', 'SALE')
          .orWhere('si.invoice_type', 'CREDIT_NOTE')
          .orWhere('si.invoice_type', 'RETURN');
      })
      .groupBy('p.id', 'p.name', 'c.name', 'p.rolling_avg_cost_per_kg', 'p.cost_price')
      .select(
        'p.id as product_id',
        'p.name as product_name',
        db.raw("COALESCE(c.name, 'General') as category_name"),
        db.raw('SUM(CAST(COALESCE(sii.net_kg_processed, sii.quantity) AS NUMERIC)) as total_kg_sold'),
        db.raw('SUM(CAST(COALESCE(sii.total_price, 0) AS NUMERIC)) as total_revenue'),
        db.raw(
          'SUM(CAST(COALESCE(sii.net_kg_processed, sii.quantity) AS NUMERIC) * CAST(COALESCE(sii.applied_cogs_per_kg, p.rolling_avg_cost_per_kg, p.cost_price, 0) AS NUMERIC)) as total_cogs'
        )
      );

    // 2. Margin by Customer
    let cQuery = db('sales_invoices as si')
      .join('customers as cust', 'si.customer_id', 'cust.id')
      .join('sales_invoice_items as sii', 'sii.invoice_id', 'si.id')
      .leftJoin('products as p', 'sii.product_id', 'p.id')
      .whereNot('si.status', 'CANCELLED')
      .where(function () {
        this.whereNull('si.invoice_type')
          .orWhere('si.invoice_type', 'SALE')
          .orWhere('si.invoice_type', 'CREDIT_NOTE')
          .orWhere('si.invoice_type', 'RETURN');
      })
      .groupBy('cust.id', 'cust.name')
      .select(
        'cust.id as customer_id',
        'cust.name as customer_name',
        db.raw('SUM(CAST(COALESCE(sii.net_kg_processed, sii.quantity) AS NUMERIC)) as total_volume_kg'),
        db.raw('SUM(CAST(COALESCE(sii.total_price, 0) AS NUMERIC)) as total_revenue'),
        db.raw(
          'SUM(CAST(COALESCE(sii.net_kg_processed, sii.quantity) AS NUMERIC) * CAST(COALESCE(sii.applied_cogs_per_kg, p.rolling_avg_cost_per_kg, p.cost_price, 0) AS NUMERIC)) as total_cogs'
        )
      );

    // 3. Daily Operational Velocity (Sales vs COGS) Trend Data Query
    let tQuery = db('sales_invoices as si')
      .join('sales_invoice_items as sii', 'sii.invoice_id', 'si.id')
      .leftJoin('products as p', 'sii.product_id', 'p.id')
      .whereNot('si.status', 'CANCELLED')
      .where(function () {
        this.whereNull('si.invoice_type')
          .orWhere('si.invoice_type', 'SALE')
          .orWhere('si.invoice_type', 'CREDIT_NOTE')
          .orWhere('si.invoice_type', 'RETURN');
      })
      .groupByRaw('DATE(si.created_at)')
      .select(
        db.raw('DATE(si.created_at) as date'),
        db.raw('SUM(CAST(COALESCE(sii.total_price, 0) AS NUMERIC)) as daily_revenue'),
        db.raw(
          'SUM(CAST(COALESCE(sii.net_kg_processed, sii.quantity) AS NUMERIC) * CAST(COALESCE(sii.applied_cogs_per_kg, p.rolling_avg_cost_per_kg, p.cost_price, 0) AS NUMERIC)) as daily_cogs'
        )
      )
      .orderByRaw('DATE(si.created_at) ASC');

    if (startDate && sDateOnly) {
      const sd: string = sDateOnly;
      pQuery = pQuery.where(function () {
        this.where('si.created_at', '>=', startDate).orWhereRaw('si.date >= ?', [sd]);
      });
      cQuery = cQuery.where(function () {
        this.where('si.created_at', '>=', startDate).orWhereRaw('si.date >= ?', [sd]);
      });
      tQuery = tQuery.where(function () {
        this.where('si.created_at', '>=', startDate).orWhereRaw('si.date >= ?', [sd]);
      });
    }

    if (endDate && eDateOnly) {
      const ed: string = eDateOnly;
      const endTimestamp = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;
      pQuery = pQuery.where(function () {
        this.where('si.created_at', '<=', endTimestamp).orWhereRaw('si.date <= ?', [ed]);
      });
      cQuery = cQuery.where(function () {
        this.where('si.created_at', '<=', endTimestamp).orWhereRaw('si.date <= ?', [ed]);
      });
      tQuery = tQuery.where(function () {
        this.where('si.created_at', '<=', endTimestamp).orWhereRaw('si.date <= ?', [ed]);
      });
    }

    const [productRows, customerRows, trendRows] = await Promise.all([pQuery, cQuery, tQuery]);

    const products = productRows.map((r: any) => {
      const kg = Math.round(Number(r.total_kg_sold || 0) * 100) / 100;
      const rev = Math.round(Number(r.total_revenue || 0) * 100) / 100;
      const cogs = Math.round(Number(r.total_cogs || 0) * 100) / 100;
      const profit = Math.round((rev - cogs) * 100) / 100;

      const avg_sell_price = kg > 0 ? Math.round((rev / kg) * 100) / 100 : 0;
      const avg_wac_cogs = kg > 0 ? Math.round((cogs / kg) * 100) / 100 : 0;
      const gross_margin_pct = avg_sell_price > 0 ? Math.round((((avg_sell_price - avg_wac_cogs) / avg_sell_price) * 100) * 10) / 10 : 0;

      return {
        product_id: r.product_id,
        product_name: r.product_name,
        category_name: r.category_name,
        total_kg_sold: kg,
        total_revenue: rev,
        total_cogs: cogs,
        total_profit: profit,
        avg_sell_price,
        avg_wac_cogs,
        gross_margin_pct,
      };
    }).sort((a: any, b: any) => b.gross_margin_pct - a.gross_margin_pct);

    const customers = customerRows.map((r: any) => {
      const kg = Math.round(Number(r.total_volume_kg || 0) * 100) / 100;
      const rev = Math.round(Number(r.total_revenue || 0) * 100) / 100;
      const cogs = Math.round(Number(r.total_cogs || 0) * 100) / 100;
      const profit = Math.round((rev - cogs) * 100) / 100;
      const gross_margin_pct = rev > 0 ? Math.round(((profit / rev) * 100) * 10) / 10 : 0;

      return {
        customer_id: r.customer_id,
        customer_name: r.customer_name,
        total_volume_kg: kg,
        total_revenue: rev,
        total_cogs: cogs,
        total_profit: profit,
        gross_margin_pct,
      };
    }).sort((a: any, b: any) => b.total_revenue - a.total_revenue);

    const trend_data = trendRows.map((r: any) => {
      const rev = Math.round(Number(r.daily_revenue || 0) * 100) / 100;
      const cogs = Math.round(Number(r.daily_cogs || 0) * 100) / 100;
      const profit = Math.round((rev - cogs) * 100) / 100;
      const margin_pct = rev > 0 ? Math.round((profit / rev) * 10000) / 100 : 0;
      let dateStr = '';
      if (r.date) {
        try {
          dateStr = new Date(r.date).toISOString().split('T')[0];
        } catch {
          dateStr = String(r.date);
        }
      }
      return {
        date: dateStr || String(r.date || ''),
        daily_revenue: rev,
        daily_cogs: cogs,
        daily_profit: profit,
        margin_pct,
      };
    }).sort((a: any, b: any) => (a.date > b.date ? 1 : -1));

    return {
      startDate: sDateOnly,
      endDate: eDateOnly,
      products,
      customers,
      trend_data,
    };
  } catch (err: any) {
    console.error('Margin Analytics API Crash:', err?.message || err, err?.stack);
    throw err;
  }
}

export async function getInventoryValuationReport() {
  try {
    const rows = await db('products as p')
      .leftJoin('categories as c', 'p.category_id', 'c.id')
      .where('p.is_active', true)
      .select(
        'p.id',
        'p.name as product_name',
        'p.code',
        'p.size',
        'c.name as category',
        'p.total_stock_kg',
        'p.rolling_avg_cost_per_kg',
        'p.cost_price'
      )
      .orderBy('p.name', 'asc');

    // Fetch inventory batches / FIFO price buckets
    let batchesRaw: any[] = [];
    const hasBatchesTable = await db.schema.hasTable('inventory_batches');
    if (hasBatchesTable) {
      batchesRaw = await db('inventory_batches as ib')
        .leftJoin('purchase_invoices as pi', 'ib.purchase_invoice_id', 'pi.id')
        .select(
          'ib.id as bucket_id',
          'ib.product_id',
          'ib.batch_number',
          'ib.batch_buy_price_per_kg as buy_price_per_kg',
          'ib.original_qty as original_stock',
          'ib.remaining_qty as remaining_stock',
          'ib.status',
          'ib.created_at',
          'pi.date as invoice_date'
        )
        .orderBy('ib.created_at', 'asc');
    }

    const batchMap = new Map<string, any[]>();
    for (const b of batchesRaw) {
      const list = batchMap.get(b.product_id) || [];
      const orig = Math.round(Number(b.original_stock || 0) * 100) / 100;
      const rem = Math.round(Number(b.remaining_stock || 0) * 100) / 100;
      const buyPrice = Math.round(Number(b.buy_price_per_kg || 0) * 100) / 100;
      const dateStr = b.invoice_date
        ? String(b.invoice_date).split('T')[0]
        : b.created_at
        ? new Date(b.created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      list.push({
        bucket_id: b.bucket_id,
        batch_number: b.batch_number || `LOT-${b.bucket_id.slice(0, 6)}`,
        created_date: dateStr,
        buy_price_per_kg: buyPrice,
        original_stock: orig,
        remaining_stock: rem,
        status: b.status || (rem > 0 ? 'ACTIVE' : 'DEPLETED'),
      });
      batchMap.set(b.product_id, list);
    }

    // Fetch Lifetime Sales per product
    const salesAgg = await db('sales_invoice_items as sii')
      .join('sales_invoices as si', 'sii.invoice_id', 'si.id')
      .whereRaw('si.status != ?', ['CANCELLED'])
      .groupBy('sii.product_id')
      .select(
        'sii.product_id',
        db.raw('SUM(CAST(COALESCE(sii.net_kg_processed, sii.quantity) AS NUMERIC)) as lifetime_kg_sold'),
        db.raw('SUM(CAST(COALESCE(sii.total_price, 0) AS NUMERIC)) as lifetime_revenue'),
        db.raw(
          'SUM(CAST(COALESCE(sii.net_kg_processed, sii.quantity) AS NUMERIC) * CAST(COALESCE(sii.applied_cogs_per_kg, 0) AS NUMERIC)) as lifetime_cogs'
        )
      );

    const salesMap = new Map<string, { kgSold: number; revenue: number; cogs: number }>();
    for (const s of salesAgg) {
      salesMap.set(s.product_id, {
        kgSold: Math.round(Number(s.lifetime_kg_sold || 0) * 100) / 100,
        revenue: Math.round(Number(s.lifetime_revenue || 0) * 100) / 100,
        cogs: Math.round(Number(s.lifetime_cogs || 0) * 100) / 100,
      });
    }

    // Fetch Lifetime Purchases per product
    const purchasesAgg = await db('purchase_invoice_items as pii')
      .join('purchase_invoices as pi', 'pii.purchase_invoice_id', 'pi.id')
      .whereRaw('pi.status != ?', ['CANCELLED'])
      .groupBy('pii.product_id')
      .select(
        'pii.product_id',
        db.raw('SUM(CAST(COALESCE(pii.net_kg_added, pii.actual_weight_kg, pii.quantity) AS NUMERIC)) as lifetime_kg_acquired')
      );

    const purchasesMap = new Map<string, number>();
    for (const p of purchasesAgg) {
      purchasesMap.set(p.product_id, Math.round(Number(p.lifetime_kg_acquired || 0) * 100) / 100);
    }

    let total_warehouse_capital = 0;

    const products = rows.map((r: any) => {
      const stock_on_hand = Math.round(Number(r.total_stock_kg || 0) * 100) / 100;
      const current_wac = Math.round(Number(r.rolling_avg_cost_per_kg || r.cost_price || 0) * 100) / 100;
      const asset_value = Math.round(stock_on_hand * current_wac * 100) / 100;

      total_warehouse_capital += asset_value;

      let buckets = batchMap.get(r.id) || [];
      if (buckets.length === 0 && stock_on_hand > 0) {
        buckets = [
          {
            bucket_id: `INITIAL-${r.id.slice(0, 8)}`,
            batch_number: 'LOT-INITIAL',
            created_date: new Date().toISOString().split('T')[0],
            buy_price_per_kg: current_wac,
            original_stock: stock_on_hand,
            remaining_stock: stock_on_hand,
            status: 'ACTIVE',
          },
        ];
      }

      const salesData = salesMap.get(r.id) || { kgSold: 0, revenue: 0, cogs: 0 };
      const acquiredFromPurchases = purchasesMap.get(r.id) || 0;
      const lifetime_kg_acquired = acquiredFromPurchases > 0 ? acquiredFromPurchases : Math.round((stock_on_hand + salesData.kgSold) * 100) / 100;
      const lifetime_kg_sold = salesData.kgSold;

      const profit = salesData.revenue - salesData.cogs;
      const all_time_gross_margin = salesData.revenue > 0 ? Math.round((profit / salesData.revenue) * 10000) / 100 : 0;

      return {
        id: r.id,
        product_name: r.product_name || 'Unnamed Product',
        code: r.code || '',
        size: r.size || '',
        category: r.category || 'General',
        current_stock_kg: stock_on_hand,
        stock_on_hand,
        current_wac,
        asset_value,
        total_asset_value: asset_value,
        buckets,
        lifetime_kg_sold,
        lifetime_kg_acquired,
        all_time_gross_margin,
      };
    });

    return {
      total_warehouse_capital: Math.round(total_warehouse_capital * 100) / 100,
      products,
    };
  } catch (err: any) {
    console.error('Inventory Valuation Report Crash:', err?.message || err, err?.stack);
    throw err;
  }
}

