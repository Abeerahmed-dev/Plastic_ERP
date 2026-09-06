import db from '../../db/knex';
import { WALKIN_CUSTOMER_PHONE } from '../../db/seeds/06_walkin_customer';

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
 * Inventory Ledger with Batch Drill-Down
 */
export async function getInventoryLedgerReport() {
  const products = await db('products')
    .where('is_active', true)
    .select('id', 'name', 'code', 'category', 'opening_stock', 'cost_price', 'unit_conversions', 'purchase_unit', 'default_kg_per_purchase_unit');

  const report = [];

  for (const p of products) {
    // 1. Fetch all batches for this product from inventory_batches with sales aggregations & supplier info via LEFT JOINs
    const batchesWithSales = await db('inventory_batches as ib')
      .leftJoin('sales_invoice_items as sii', 'sii.batch_id', 'ib.id')
      .leftJoin('purchase_invoice_items as pii', 'ib.purchase_invoice_item_id', 'pii.id')
      .leftJoin('purchase_invoices as pi', 'pii.purchase_invoice_id', 'pi.id')
      .leftJoin('suppliers as s', 'pi.supplier_id', 's.id')
      .where('ib.product_id', p.id)
      .groupBy(
        'ib.id',
        'ib.batch_number',
        'ib.created_at',
        'ib.initial_qty',
        'ib.remaining_qty',
        'ib.buy_price_per_kg',
        'ib.selected_unit',
        'ib.actual_weight_per_unit',
        'ib.batch_unit_conversions',
        's.name'
      )
      .select(
        'ib.id as batch_id',
        'ib.batch_number',
        'ib.created_at',
        'ib.initial_qty',
        'ib.remaining_qty',
        'ib.buy_price_per_kg',
        'ib.selected_unit',
        'ib.actual_weight_per_unit',
        'ib.batch_unit_conversions',
        's.name as supplier_name',
        db.raw('COALESCE(SUM(sii.net_kg_processed), 0) as total_kg_sold'),
        db.raw('COALESCE(SUM(sii.total_price), 0) as batch_revenue')
      )
      .orderBy('ib.created_at', 'asc');

    // Default product conversions fallback
    const defaultConversions = p.unit_conversions
      ? (typeof p.unit_conversions === 'string' ? JSON.parse(p.unit_conversions) : p.unit_conversions)
      : { Bora: 25.0, Peti: 15.0, Dasti: 0.5, Pura: 5.0, KG: 1.0 };

    const defaultBoraWt = Number(defaultConversions.Bora || 25.0);
    const defaultPetiWt = Number(defaultConversions.Peti || 15.0);

    let total_kg = 0;
    let total_cost_sum = 0;
    let total_exact_boras = 0;
    let total_exact_petis = 0;

    const batchList = [];

    if (batchesWithSales.length > 0) {
      for (const batch of batchesWithSales) {
        const remQty = Number(batch.remaining_qty || 0);
        const origQty = Number(batch.initial_qty || remQty);
        const totalKgSold = Number(batch.total_kg_sold || 0);
        const batchRevenue = Number(batch.batch_revenue || 0);
        const buyPrice = Number(batch.buy_price_per_kg || p.cost_price || 0);

        const batchCogs = Math.round(totalKgSold * buyPrice * 100) / 100;
        const batchGrossProfit = Math.round((batchRevenue - batchCogs) * 100) / 100;

        const bConversions = batch.batch_unit_conversions
          ? (typeof batch.batch_unit_conversions === 'string' ? JSON.parse(batch.batch_unit_conversions) : batch.batch_unit_conversions)
          : defaultConversions;

        const boraWt = Number(bConversions.Bora || defaultBoraWt);
        const petiWt = Number(bConversions.Peti || defaultPetiWt);

        if (remQty > 0) {
          total_kg += remQty;
          total_cost_sum += remQty * buyPrice;
          total_exact_boras += boraWt > 0 ? remQty / boraWt : 0;
          total_exact_petis += petiWt > 0 ? remQty / petiWt : 0;
        }

        batchList.push({
          batch_id: batch.batch_id,
          batch_number: batch.batch_number,
          supplier_name: batch.supplier_name || 'Opening Stock / Primary Supplier',
          date: batch.created_at,
          buy_price_per_kg: Math.round(buyPrice * 100) / 100,
          original_qty: Math.round(origQty * 100) / 100,
          remaining_qty: Math.round(remQty * 100) / 100,
          total_kg_sold: Math.round(totalKgSold * 100) / 100,
          batch_revenue: Math.round(batchRevenue * 100) / 100,
          batch_cogs: batchCogs,
          batch_gross_profit: batchGrossProfit,
          selected_unit: batch.selected_unit || 'Bora',
          actual_weight_per_unit: Number(batch.actual_weight_per_unit || boraWt),
          batch_unit_conversions: bConversions,
        });
      }
    } else {
      // Fallback if no batch records exist yet for active product with opening stock
      const openingStock = Number(p.opening_stock || 0);
      if (openingStock > 0) {
        total_kg = openingStock;
        total_cost_sum = openingStock * Number(p.cost_price || 0);
        total_exact_boras = openingStock / defaultBoraWt;
        total_exact_petis = openingStock / defaultPetiWt;
      }
    }

    const avg_cost = total_kg > 0 ? total_cost_sum / total_kg : Number(p.cost_price || 0);
    const total_asset_value = total_kg * avg_cost;

    const roundedBoras = Math.round(total_exact_boras * 10) / 10;
    const roundedPetis = Math.round(total_exact_petis * 10) / 10;
    const secondarySummary = `(exact: ${roundedBoras} Boras / ${roundedPetis} Petis)`;

    report.push({
      product_id: p.id,
      product_name: p.name,
      product_code: p.code,
      category: p.category,
      total_kg: Math.round(total_kg * 100) / 100,
      avg_cost: Math.round(avg_cost * 100) / 100,
      total_asset_value: Math.round(total_asset_value * 100) / 100,
      total_exact_boras: roundedBoras,
      total_exact_petis: roundedPetis,
      secondary_units_summary: secondarySummary,
      default_unit_conversions: defaultConversions,
      batches: batchList,
    });
  }

  return report;
}

/**
 * GET /api/reports/liquidity
 * Expanded Liquidity (Market Khata) Ledger
 */
export async function getLiquidityLedgerReport() {
  const cashPayments = await db('customer_payments')
    .whereIn('payment_method', ['Cash', 'CASH'])
    .sum('amount as total')
    .first();

  const supplierCash = await db('supplier_payments')
    .whereIn('payment_method', ['Cash', 'CASH'])
    .sum('amount as total')
    .first();

  const cash_drawer = Math.max(0, 150000 + Number(cashPayments?.total || 0) - Number(supplierCash?.total || 0));

  const bankIn = await db('customer_payments')
    .whereIn('payment_method', ['Bank Transfer', 'Online', 'BANK', 'BANK_TRANSFER'])
    .sum('amount as total')
    .first();

  const bankOut = await db('supplier_payments')
    .whereIn('payment_method', ['Bank Transfer', 'Online', 'BANK', 'BANK_TRANSFER'])
    .sum('amount as total')
    .first();

  const bank_balances = Math.max(0, 500000 + Number(bankIn?.total || 0) - Number(bankOut?.total || 0));

  const pdcs = await db('customer_payments')
    .whereIn('payment_method', ['Cheque', 'CHEQUE', 'PDC'])
    .sum('amount as total')
    .first();

  const post_dated_cheques = Number(pdcs?.total || 125000);

  // Customer Market Receivables (Udhaar)
  const customers = await db('customers').select('id');
  let market_receivables = 0;
  for (const c of customers) {
    const invResult = await db('sales_invoices')
      .where('customer_id', c.id)
      .sum('total_amount as total_inv')
      .sum('paid_amount as total_paid')
      .first();

    const inv = Number(invResult?.total_inv || 0);
    const paid = Number(invResult?.total_paid || 0);
    const balance = inv - paid;
    if (balance > 0) market_receivables += balance;
  }

  // Inventory Asset Value (Unsold Stock Value in warehouse)
  const inventoryReport = await getInventoryLedgerReport();
  const total_inventory_value = inventoryReport.reduce((sum, item) => sum + Number(item.total_asset_value || 0), 0);

  // Accounts Payable (Supplier debt owed to market)
  const supplierInvoices = await db('purchase_invoices')
    .sum('total_amount as total_inv')
    .sum('paid_amount as total_paid')
    .first();

  const suppInvTotal = Number(supplierInvoices?.total_inv || 0);
  const suppPaidTotal = Number(supplierInvoices?.total_paid || 0);
  const total_accounts_payable = Math.max(0, suppInvTotal - suppPaidTotal);

  const total_liquid = cash_drawer + bank_balances;
  const net_business_capital = (total_liquid + market_receivables + total_inventory_value) - total_accounts_payable;

  return {
    cash_drawer: Math.round(cash_drawer * 100) / 100,
    bank_balances: Math.round(bank_balances * 100) / 100,
    post_dated_cheques: Math.round(post_dated_cheques * 100) / 100,
    market_receivables: Math.round(market_receivables * 100) / 100,
    total_inventory_value: Math.round(total_inventory_value * 100) / 100,
    total_accounts_payable: Math.round(total_accounts_payable * 100) / 100,
    total_liquid: Math.round(total_liquid * 100) / 100,
    net_business_capital: Math.round(net_business_capital * 100) / 100,
    total_market_capital: Math.round((total_liquid + post_dated_cheques + market_receivables) * 100) / 100,
  };
}

/**
 * GET /api/reports/liquidity/receivables
 * Fast-fetch detailed list of customers owing debt (balance > 0)
 */
export async function getLiquidityReceivablesDetail() {
  const customers = await db('customers').select('*');
  const list = [];

  for (const c of customers) {
    const invResult = await db('sales_invoices')
      .where('customer_id', c.id)
      .sum('total_amount as total_inv')
      .sum('paid_amount as total_paid')
      .first();

    const inv = Number(invResult?.total_inv || 0);
    const paid = Number(invResult?.total_paid || 0);
    const opening = Number(c.opening_balance || 0);
    const totalReceivable = Math.round((opening + inv - paid) * 100) / 100;

    if (totalReceivable > 0) {
      list.push({
        customer_id: c.id,
        name: c.name,
        code: c.code,
        phone: c.phone || 'N/A',
        city: c.city || 'N/A',
        opening_balance: opening,
        invoice_balance: Math.round((inv - paid) * 100) / 100,
        total_receivable: totalReceivable,
      });
    }
  }

  return list.sort((a, b) => b.total_receivable - a.total_receivable);
}

/**
 * GET /api/reports/liquidity/payables
 * Fast-fetch detailed list of suppliers owed money (balance > 0)
 */
export async function getLiquidityPayablesDetail() {
  const suppliers = await db('suppliers').select('*');
  const list = [];

  for (const s of suppliers) {
    const invResult = await db('purchase_invoices')
      .where('supplier_id', s.id)
      .sum('total_amount as total_inv')
      .sum('paid_amount as total_paid')
      .first();

    const inv = Number(invResult?.total_inv || 0);
    const paid = Number(invResult?.total_paid || 0);
    const opening = Number(s.opening_payable || s.opening_balance || 0);
    const totalPayable = Math.round((opening + inv - paid) * 100) / 100;

    if (totalPayable > 0) {
      list.push({
        supplier_id: s.id,
        name: s.name,
        code: s.code,
        phone: s.phone || 'N/A',
        city: s.city || 'N/A',
        opening_payable: opening,
        invoice_balance: Math.round((inv - paid) * 100) / 100,
        total_payable: totalPayable,
      });
    }
  }

  return list.sort((a, b) => b.total_payable - a.total_payable);
}

/**
 * GET /api/reports/liquidity/unsold-stock
 * Fast-fetch detailed list of warehouse product stock sitting unsold
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
      active_batches_count: item.batches.length,
      secondary_units_summary: item.secondary_units_summary,
    }))
    .sort((a, b) => b.total_asset_value - a.total_asset_value);
}

/**
 * GET /api/reports/sales-margin?timeFilter=...&productId=...
 * Dynamic Sales & Margin Report (Batch COGS + Period Cash vs Udhaar Split)
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
    .leftJoin('inventory_batches as ib', 'sii.batch_id', 'ib.id')
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
      'ib.buy_price_per_kg as batch_buy_price',
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
    const buyPrice = Number(r.batch_buy_price || r.product_cost_price || 0);
    total_cogs += kg * buyPrice;

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

/**
 * GET /api/reports/profit?productId=...&timeFilter=...
 * Loss-Accurate Profit Matrix with Time-Series Filtering
 */
export async function getProfitMatrixReport(productId?: string, timeFilter?: string) {
  return getSalesMarginReport(productId, timeFilter);
}

export async function getCashierTallyReport(userId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const paymentsResult = await db('customer_payments')
    .where('created_by', userId)
    .where('created_at', '>=', startOfDay)
    .whereIn('payment_method', ['CASH', 'CASH_DRAWER', 'Cash'])
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
