/**
 * Sabir Plastic ERP - Core Financial Math Utilities
 * 
 * Pure mathematical functions for financial accounting, inventory valuation,
 * and ledger reconciliation. These functions run in complete isolation from
 * the PostgreSQL database with zero side effects.
 * 
 * Strict Decimal Integrity: All monetary calculations are locked to 2 decimal places (Round_2),
 * and physical weight multipliers / freight allocations are locked to 4 decimal places (Round_4)
 * to prevent IEEE 754 floating-point drift.
 */

// ============================================================================
// 1. FLOATING-POINT PRECISION & ROUNDING DISCIPLINE
// ============================================================================

/**
 * Rounds a number strictly to 2 decimal places with EPSILON protection
 * against floating point representation errors (e.g., 1.005 -> 1.01).
 */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Rounds a number to 4 decimal places for unit conversion, WAC ratios,
 * and fractional freight burdens per kilogram.
 */
export function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

/**
 * Safe addition of an arbitrary array of numbers with 2-decimal locking.
 */
export function safeAdd(...numbers: number[]): number {
  const sum = numbers.reduce((acc, curr) => acc + (Number.isFinite(curr) ? curr : 0), 0);
  return round2(sum);
}

/**
 * Safe subtraction: a - b with 2-decimal locking.
 */
export function safeSubtract(a: number, b: number): number {
  const numA = Number.isFinite(a) ? a : 0;
  const numB = Number.isFinite(b) ? b : 0;
  return round2(numA - numB);
}

/**
 * Safe multiplication: a * b with 2-decimal locking.
 */
export function safeMultiply(a: number, b: number): number {
  const numA = Number.isFinite(a) ? a : 0;
  const numB = Number.isFinite(b) ? b : 0;
  return round2(numA * numB);
}

/**
 * Safe division: a / b with specified decimal precision.
 * Returns 0 if divisor is 0.
 */
export function safeDivide(a: number, b: number, decimals: 2 | 4 = 2): number {
  const numA = Number.isFinite(a) ? a : 0;
  const numB = Number.isFinite(b) ? b : 0;
  if (numB === 0) return 0;
  return decimals === 4 ? round4(numA / numB) : round2(numA / numB);
}

// ============================================================================
// 2. LANDED COSTING & INBOUND FREIGHT CAPITALIZATION
// ============================================================================

export interface PurchaseItemInput {
  product_id?: string;
  quantity_kg: number;
  unit_price: number;
  size?: string;
}

export interface LandedCostItemResult {
  product_id?: string;
  quantity_kg: number;
  unit_price: number;
  freight_per_kg: number;
  landed_cost_per_kg: number;
  base_total: number;
  allocated_freight: number;
  total_landed_cost: number;
}

export interface LandedCostAllocationResult {
  total_invoice_kg: number;
  total_base_subtotal: number;
  delivery_charges: number;
  freight_per_kg: number;
  items: LandedCostItemResult[];
  total_capitalized_inventory: number;
  freight_drift: number;
}

/**
 * Calculates proportional inbound freight burden per KG across all items.
 * Formula: Freight Per KG = Delivery Charges / Total Invoice KG
 */
export function calculateFreightPerKg(deliveryCharges: number, totalInvoiceKg: number): number {
  if (!Number.isFinite(deliveryCharges) || deliveryCharges <= 0) return 0;
  if (!Number.isFinite(totalInvoiceKg) || totalInvoiceKg <= 0) return 0;
  return round4(deliveryCharges / totalInvoiceKg);
}

/**
 * Calculates landed cost per KG for an individual item.
 * Landed Cost = Base Price + Freight Per KG
 */
export function calculateItemLandedCost(basePricePerKg: number, freightPerKg: number): number {
  const base = Number.isFinite(basePricePerKg) ? basePricePerKg : 0;
  const freight = Number.isFinite(freightPerKg) ? freightPerKg : 0;
  return round2(base + freight);
}

/**
 * Allocates total delivery charges across an invoice's line items proportionally
 * by volume/weight (KG). Capitalizes inbound freight into inventory asset valuation.
 */
export function allocateLandedCost(
  deliveryCharges: number,
  items: PurchaseItemInput[]
): LandedCostAllocationResult {
  const safeDelivery = Math.max(0, Number.isFinite(deliveryCharges) ? round2(deliveryCharges) : 0);
  const totalInvoiceKg = round4(
    items.reduce((sum, item) => sum + Math.max(0, Number.isFinite(item.quantity_kg) ? item.quantity_kg : 0), 0)
  );

  const freightPerKg = calculateFreightPerKg(safeDelivery, totalInvoiceKg);

  let accumulatedAllocatedFreight = 0;
  let totalBaseSubtotal = 0;

  const allocatedItems: LandedCostItemResult[] = items.map((item) => {
    const qty = Math.max(0, Number.isFinite(item.quantity_kg) ? item.quantity_kg : 0);
    const unitPrice = Math.max(0, Number.isFinite(item.unit_price) ? round2(item.unit_price) : 0);
    const baseTotal = round2(qty * unitPrice);
    
    // Delivery charge per KG rounded to 4 decimals
    const itemDcPerKg = round4(freightPerKg);
    // Landed cost rounded to 2 decimals
    const landedCostPerKg = round2(unitPrice + itemDcPerKg);
    
    const allocatedFreight = round2(qty * itemDcPerKg);
    const totalLandedCost = round2(qty * landedCostPerKg);

    accumulatedAllocatedFreight = round2(accumulatedAllocatedFreight + allocatedFreight);
    totalBaseSubtotal = round2(totalBaseSubtotal + baseTotal);

    return {
      product_id: item.product_id,
      quantity_kg: qty,
      unit_price: unitPrice,
      freight_per_kg: itemDcPerKg,
      landed_cost_per_kg: landedCostPerKg,
      base_total: baseTotal,
      allocated_freight: allocatedFreight,
      total_landed_cost: totalLandedCost,
    };
  });

  const totalCapitalized = round2(totalBaseSubtotal + safeDelivery);
  const freightDrift = round2(safeDelivery - accumulatedAllocatedFreight);

  return {
    total_invoice_kg: totalInvoiceKg,
    total_base_subtotal: totalBaseSubtotal,
    delivery_charges: safeDelivery,
    freight_per_kg: freightPerKg,
    items: allocatedItems,
    total_capitalized_inventory: totalCapitalized,
    freight_drift: freightDrift,
  };
}

// ============================================================================
// 3. WEIGHTED AVERAGE COSTING (WAC / ROLLING AVERAGE COST)
// ============================================================================

/**
 * Calculates new Rolling Weighted Average Cost (WAC) per KG upon receiving new stock.
 * Formula:
 * New Rolling WAC = ((Current Stock * Current WAC) + (Incoming Qty * Incoming Landed Cost))
 *                   / (Current Stock + Incoming Qty)
 * 
 * Rules:
 * - If current stock is 0 or negative (deficit fulfilled), new WAC equals incoming landed cost.
 * - If incoming quantity is 0, current WAC remains preserved.
 * - Result is locked to 4 decimal places for accounting precision.
 */
export function calculateRollingWAC(
  currentStockKg: number,
  currentAvgCost: number,
  incomingQtyKg: number,
  incomingCostPerKg: number
): number {
  const stock = Number.isFinite(currentStockKg) ? currentStockKg : 0;
  const currentCost = Number.isFinite(currentAvgCost) ? currentAvgCost : 0;
  const incomingQty = Number.isFinite(incomingQtyKg) ? incomingQtyKg : 0;
  const incomingCost = Number.isFinite(incomingCostPerKg) ? incomingCostPerKg : 0;

  if (incomingQty <= 0) {
    return currentCost > 0 ? round4(currentCost) : 0;
  }

  // If current warehouse stock is non-positive, incoming batch resets WAC
  if (stock <= 0) {
    return round4(incomingCost);
  }

  const currentValuation = stock * currentCost;
  const incomingValuation = incomingQty * incomingCost;
  const totalStock = stock + incomingQty;

  return round4((currentValuation + incomingValuation) / totalStock);
}

// ============================================================================
// 4. TRUE NET MATH & LIQUIDITY LEDGER (ASSETS - LIABILITIES = NET CAPITAL)
// ============================================================================

export interface NetCapitalAssetsInput {
  cash_drawer: number;
  bank_balances: number;
  market_receivables: number;
  total_inventory_value: number;
  supplier_advances_asset: number;
  post_dated_cheques: number; // Received PDCs in hand
}

export interface NetCapitalLiabilitiesInput {
  total_accounts_payable: number;
  customer_advances_liability: number;
  issued_post_dated_cheques: number; // Issued PDCs payable
  pending_expenses_liability: number; // Accrued OPEX liabilities
}

export interface NetBusinessCapitalReport {
  cash_drawer: number;
  bank_balances: number;
  total_liquid: number;
  post_dated_cheques: number;
  issued_post_dated_cheques: number;
  market_receivables: number;
  total_inventory_value: number;
  total_accounts_payable: number;
  customer_advances_liability: number;
  supplier_advances_asset: number;
  pending_expenses_liability: number;
  pending_opex_liability: number;
  total_assets: number;
  total_liabilities: number;
  net_business_capital: number;
  total_market_capital: number;
}

/**
 * Calculates Net Business Capital strictly according to True Net Math:
 * 
 * Total Liquid = Cash Drawer + Bank Balances
 * Total Assets = Total Liquid + Market Receivables + Total Inventory Value + Supplier Advances + Received PDCs
 * Total Liabilities = Accounts Payable + Customer Advances + Issued PDCs + Pending Expenses
 * Net Business Capital = Total Assets - Total Liabilities
 */
export function calculateNetBusinessCapital(
  assets: NetCapitalAssetsInput,
  liabilities: NetCapitalLiabilitiesInput
): NetBusinessCapitalReport {
  const cash_drawer = round2(assets.cash_drawer || 0);
  const bank_balances = round2(assets.bank_balances || 0);
  const market_receivables = round2(assets.market_receivables || 0);
  const total_inventory_value = round2(assets.total_inventory_value || 0);
  const supplier_advances_asset = round2(assets.supplier_advances_asset || 0);
  const post_dated_cheques = round2(assets.post_dated_cheques || 0);

  const total_accounts_payable = round2(liabilities.total_accounts_payable || 0);
  const customer_advances_liability = round2(liabilities.customer_advances_liability || 0);
  const issued_post_dated_cheques = round2(liabilities.issued_post_dated_cheques || 0);
  const pending_expenses_liability = round2(liabilities.pending_expenses_liability || 0);

  const total_liquid = round2(cash_drawer + bank_balances);

  const total_assets = round2(
    total_liquid +
    market_receivables +
    total_inventory_value +
    supplier_advances_asset +
    post_dated_cheques
  );

  const total_liabilities = round2(
    total_accounts_payable +
    customer_advances_liability +
    issued_post_dated_cheques +
    pending_expenses_liability
  );

  const net_business_capital = round2(total_assets - total_liabilities);

  const total_market_capital = round2(
    total_liquid + post_dated_cheques + market_receivables + supplier_advances_asset
  );

  return {
    cash_drawer,
    bank_balances,
    total_liquid,
    post_dated_cheques,
    issued_post_dated_cheques,
    market_receivables,
    total_inventory_value,
    total_accounts_payable,
    customer_advances_liability,
    supplier_advances_asset,
    pending_expenses_liability,
    pending_opex_liability: pending_expenses_liability,
    total_assets,
    total_liabilities,
    net_business_capital,
    total_market_capital,
  };
}

// ============================================================================
// 5. UNCAPPED TRUE NET MATH (INVOICE BALANCES & CUSTOMER DECOUPLING)
// ============================================================================

export interface UncappedInvoiceBalanceResult {
  gross_amount: number;
  credit_notes_total: number;
  net_invoice_total: number;
  paid_amount: number;
  balance_due: number;
  is_overpaid: boolean;
  surplus_to_wallet_advance: number;
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERPAID';
}

/**
 * Calculates uncapped invoice balance due.
 * No artificial zero-capping: If customer paid more than net total,
 * balance due is negative and surplus routes cleanly to customer advance wallet.
 */
export function calculateUncappedInvoiceBalance(
  totalAmount: number,
  linkedCreditNotes: number,
  amountPaid: number
): UncappedInvoiceBalanceResult {
  const gross = round2(totalAmount || 0);
  const credits = round2(Math.abs(linkedCreditNotes || 0));
  const netTotal = round2(gross - credits);
  const paid = round2(amountPaid || 0);
  const balanceDue = round2(netTotal - paid);

  let status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERPAID' = 'UNPAID';
  let isOverpaid = false;
  let surplus = 0;

  if (balanceDue < 0) {
    status = 'OVERPAID';
    isOverpaid = true;
    surplus = round2(Math.abs(balanceDue));
  } else if (balanceDue === 0) {
    status = 'PAID';
  } else if (paid > 0) {
    status = 'PARTIAL';
  } else {
    status = 'UNPAID';
  }

  return {
    gross_amount: gross,
    credit_notes_total: credits,
    net_invoice_total: netTotal,
    paid_amount: paid,
    balance_due: balanceDue,
    is_overpaid: isOverpaid,
    surplus_to_wallet_advance: surplus,
    status,
  };
}

export interface CustomerNetBalanceResult {
  opening_balance: number;
  total_invoices: number;
  total_returns: number;
  adjusted_billed: number;
  total_paid: number;
  outstanding_balance: number;
  advance_credit: number;
  net_balance: number;
}

/**
 * Computes decoupled customer balance.
 * Billed and Paid amounts are never artificially compressed into a single lossy scalar.
 * If Total Paid >= Adjusted Billed: Outstanding = 0, Advance Credit = Total Paid - Adjusted Billed
 * If Total Paid < Adjusted Billed: Outstanding = Adjusted Billed - Total Paid, Advance Credit = 0
 */
export function calculateCustomerNetBalance(
  openingBalance: number,
  totalInvoices: number,
  totalReturns: number,
  totalPaid: number
): CustomerNetBalanceResult {
  const openBal = round2(openingBalance || 0);
  const invoices = round2(totalInvoices || 0);
  const returns = round2(Math.abs(totalReturns || 0));
  const paid = round2(totalPaid || 0);

  const adjustedBilled = round2((openBal + invoices) - returns);

  let outstanding = 0;
  let advanceCredit = 0;

  if (paid >= adjustedBilled) {
    outstanding = 0;
    advanceCredit = round2(paid - adjustedBilled);
  } else {
    outstanding = round2(adjustedBilled - paid);
    advanceCredit = 0;
  }

  const netBalance = round2(outstanding - advanceCredit);

  return {
    opening_balance: openBal,
    total_invoices: invoices,
    total_returns: returns,
    adjusted_billed: adjustedBilled,
    total_paid: paid,
    outstanding_balance: outstanding,
    advance_credit: advanceCredit,
    net_balance: netBalance,
  };
}

// ============================================================================
// 6. DISCOUNT & SURPLUS ALLOCATOR
// ============================================================================

export interface DiscountAllocationInput {
  subtotal: number;
  discount_amount?: number;
  discount_percentage?: number;
  is_percentage?: boolean;
}

export interface DiscountAllocationResult {
  subtotal: number;
  discount_rate_percentage: number;
  calculated_discount: number;
  net_subtotal: number;
  effective_delivery_charges: number;
  grand_total: number;
}

/**
 * Calculates discount allocation for orders/invoices.
 * Validates that discount does not exceed subtotal (capped at subtotal, minimum 0).
 */
export function allocateDiscount(
  input: DiscountAllocationInput,
  deliveryCharges: number = 0
): DiscountAllocationResult {
  const subtotal = round2(Math.max(0, input.subtotal || 0));
  const delivery = round2(Math.max(0, deliveryCharges || 0));

  let discount = 0;
  let ratePct = 0;

  if (input.is_percentage || (input.discount_percentage !== undefined && input.discount_percentage > 0)) {
    ratePct = Math.min(100, Math.max(0, input.discount_percentage || 0));
    discount = round2((subtotal * ratePct) / 100);
  } else {
    const rawAmt = round2(Math.max(0, input.discount_amount || 0));
    discount = Math.min(subtotal, rawAmt);
    ratePct = subtotal > 0 ? round4((discount / subtotal) * 100) : 0;
  }

  // Ensure discount does not exceed subtotal
  discount = Math.min(subtotal, discount);
  const netSubtotal = round2(subtotal - discount);
  const grandTotal = round2(netSubtotal + delivery);

  return {
    subtotal,
    discount_rate_percentage: ratePct,
    calculated_discount: discount,
    net_subtotal: netSubtotal,
    effective_delivery_charges: delivery,
    grand_total: grandTotal,
  };
}

export interface OpenInvoicePaymentTarget {
  id: string;
  total_amount: number;
  already_allocated: number;
  returned_amount?: number;
}

export interface InvoiceAllocationLine {
  invoice_id: string;
  net_invoice_total: number;
  unpaid_before: number;
  allocated_now: number;
  unpaid_after: number;
  is_fully_paid: boolean;
}

export interface PaymentSurplusAllocationResult {
  payment_amount: number;
  total_allocated_to_invoices: number;
  surplus_unallocated_cash: number;
  allocations: InvoiceAllocationLine[];
}

/**
 * Pure Payment Allocation Engine.
 * Allocates incoming payment across open invoices sequentially (FIFO or designated order).
 * If payment exceeds total unpaid balances across all open invoices,
 * the remaining surplus cash is isolated and returned to be credited into WALLET_ADVANCE.
 */
export function allocatePaymentAndSurplus(
  paymentAmount: number,
  invoices: OpenInvoicePaymentTarget[]
): PaymentSurplusAllocationResult {
  const payment = round2(Math.max(0, paymentAmount || 0));
  let remainingPayment = payment;
  let totalAllocated = 0;

  const allocations: InvoiceAllocationLine[] = [];

  for (const inv of invoices) {
    const returned = round2(Math.abs(inv.returned_amount || 0));
    const netTotal = round2(Math.max(0, inv.total_amount - returned));
    const priorAllocated = round2(inv.already_allocated || 0);
    const unpaidBefore = round2(Math.max(0, netTotal - priorAllocated));

    let allocatedNow = 0;
    if (remainingPayment > 0 && unpaidBefore > 0) {
      allocatedNow = round2(Math.min(remainingPayment, unpaidBefore));
      remainingPayment = round2(remainingPayment - allocatedNow);
      totalAllocated = round2(totalAllocated + allocatedNow);
    }

    const unpaidAfter = round2(Math.max(0, unpaidBefore - allocatedNow));

    allocations.push({
      invoice_id: inv.id,
      net_invoice_total: netTotal,
      unpaid_before: unpaidBefore,
      allocated_now: allocatedNow,
      unpaid_after: unpaidAfter,
      is_fully_paid: unpaidAfter === 0,
    });
  }

  const surplusCash = round2(remainingPayment);

  return {
    payment_amount: payment,
    total_allocated_to_invoices: totalAllocated,
    surplus_unallocated_cash: surplusCash,
    allocations,
  };
}

// ============================================================================
// 7. DUAL-UNIT CONVERSION MATH (Bags <-> KG)
// ============================================================================

/**
 * Converts standard bag/bora counts to weight in KG.
 * Formula: KG = Bags * Bag Weight
 */
export function convertBagsToKg(bags: number, bagWeightKg: number): number {
  const safeBags = Math.max(0, Number.isFinite(bags) ? bags : 0);
  const safeWeight = Math.max(0, Number.isFinite(bagWeightKg) ? bagWeightKg : 0);
  return round4(safeBags * safeWeight);
}

/**
 * Converts weight in KG to equivalent standard bags/bora.
 * Formula: Bags = KG / Bag Weight
 */
export function convertKgToBags(quantityKg: number, bagWeightKg: number): number {
  const safeKg = Math.max(0, Number.isFinite(quantityKg) ? quantityKg : 0);
  const safeWeight = Math.max(0, Number.isFinite(bagWeightKg) ? bagWeightKg : 0);
  if (safeWeight === 0) return 0;
  return round4(safeKg / safeWeight);
}

/**
 * Calculates line total for an item: Quantity (KG) * Unit Rate.
 */
export function calculateLineTotal(quantityKg: number, unitPrice: number): number {
  const safeQty = Math.max(0, Number.isFinite(quantityKg) ? quantityKg : 0);
  const safePrice = Math.max(0, Number.isFinite(unitPrice) ? unitPrice : 0);
  return round2(safeQty * safePrice);
}

/**
 * Reverse computes unit price from line total and quantity.
 */
export function calculateUnitPriceFromTotal(lineTotal: number, quantityKg: number): number {
  const safeTotal = Math.max(0, Number.isFinite(lineTotal) ? lineTotal : 0);
  const safeQty = Math.max(0, Number.isFinite(quantityKg) ? quantityKg : 0);
  if (safeQty === 0) return 0;
  return round4(safeTotal / safeQty);
}
