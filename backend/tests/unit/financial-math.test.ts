/**
 * Phase 1 QA Matrix Unit Test Suite: Core Financial Math Utilities
 * 
 * Target: Isolation Unit Tests for Financial Accounting, Valuation, and Ledgers.
 * Scope: Pure mathematical invariants without touching PostgreSQL or Knex transactor.
 * 
 * Verifications:
 * 1. Floating-point precision (preventing IEEE 754 decimal fracturing & drift)
 * 2. Landed Costing & Inbound Freight Volume Allocation (proportional burdening & COGS capitalization)
 * 3. True Net Math (Assets - Liabilities = Net Business Capital balance sheet equation)
 * 4. Rolling Weighted Average Costing (WAC) algorithm across stock arrivals
 * 5. Discount & Surplus Allocator (wallet advance preservation & open invoice allocation)
 * 6. Uncapped True Net Math (invoice overpayment isolation & decoupled customer balances)
 * 7. Dual-Unit Material Conversion (Bags <-> KG bidirectional calculations)
 */

import {
  round2,
  round4,
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,
  calculateFreightPerKg,
  calculateItemLandedCost,
  allocateLandedCost,
  calculateRollingWAC,
  calculateNetBusinessCapital,
  calculateUncappedInvoiceBalance,
  calculateCustomerNetBalance,
  allocateDiscount,
  allocatePaymentAndSurplus,
  convertBagsToKg,
  convertKgToBags,
  calculateLineTotal,
  calculateUnitPriceFromTotal,
  NetCapitalAssetsInput,
  NetCapitalLiabilitiesInput,
  PurchaseItemInput,
} from '../../src/utils/financial-math';

describe('Financial Math Core Utilities - Pure Unit Test Matrix', () => {

  // ==========================================================================
  // SECTION 1: FLOATING-POINT PRECISION & DECIMAL INTEGRITY
  // ==========================================================================
  describe('1. Floating-Point Precision & Rounding (Anti-Fracture Discipline)', () => {

    it('should eliminate classic IEEE 754 floating-point addition error (0.1 + 0.2 === 0.3)', () => {
      // In standard JS: 0.1 + 0.2 === 0.30000000000000004
      const fracturedSum = 0.1 + 0.2;
      expect(fracturedSum).not.toBe(0.3);

      const lockedSum = safeAdd(0.1, 0.2);
      expect(lockedSum).toBe(0.3);
      expect(round2(0.1 + 0.2)).toBe(0.3);
    });

    it('should prevent decimal drift across repetitive fractional additions', () => {
      // Adding 0.07 ten times in raw JS causes 0.7000000000000001
      let rawAccumulator = 0;
      for (let i = 0; i < 10; i++) {
        rawAccumulator += 0.07;
      }
      expect(rawAccumulator).not.toBe(0.7);

      const cleanAccumulator = safeAdd(
        0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07
      );
      expect(cleanAccumulator).toBe(0.7);
    });

    it('should handle round-half-up with EPSILON protection (1.005 -> 1.01)', () => {
      // In naive JS: Math.round(1.005 * 100) / 100 evaluates to 1 because 1.005 is 1.00499999999999989
      expect(round2(1.005)).toBe(1.01);
      expect(round2(10.005)).toBe(10.01);
      expect(round2(1.0049)).toBe(1.00);
    });

    it('should preserve 4 decimal places for unit conversion factors and freight burdens', () => {
      // 1 / 3 = 0.333333333...
      expect(round4(1 / 3)).toBe(0.3333);
      // 7 / 9 = 0.7777777...
      expect(round4(7 / 9)).toBe(0.7778);
    });

    it('should perform safe subtraction without producing negative zero (-0)', () => {
      const result = safeSubtract(100.50, 100.50);
      expect(result).toBe(0);
      expect(Object.is(result, -0)).toBe(false);
    });

    it('should perform safe multiplication and division without precision fracture', () => {
      expect(safeMultiply(19.99, 100)).toBe(1999.00);
      expect(safeMultiply(0.1, 0.2)).toBe(0.02);
      expect(safeMultiply(NaN, 50)).toBe(0);
      expect(safeDivide(1500, 0)).toBe(0);
      expect(safeDivide(1500, 3)).toBe(500.00);
      expect(safeDivide(100, 3, 2)).toBe(33.33);
      expect(safeDivide(100, 3, 4)).toBe(33.3333);
    });

    it('should guard against non-finite values in round2, round4, and arithmetic functions', () => {
      expect(round2(NaN)).toBe(0);
      expect(round2(Infinity)).toBe(0);
      expect(round4(NaN)).toBe(0);
      expect(round4(Infinity)).toBe(0);
      expect(safeAdd(NaN, 100, Infinity, 50)).toBe(150.00);
      expect(safeSubtract(NaN, 50)).toBe(-50.00);
    });

    it('should maintain strict precision over large multi-million enterprise figures', () => {
      const assetA = 125000450.75;
      const assetB = 98765432.45;
      const total = safeAdd(assetA, assetB);
      expect(total).toBe(223765883.20);
    });
  });

  // ==========================================================================
  // SECTION 2: LANDED COSTING & INBOUND FREIGHT ALLOCATION
  // ==========================================================================
  describe('2. Landed Costing Calculations (Freight / Volume Allocation)', () => {

    it('should calculate exact freight per KG across total invoice volume', () => {
      // Inbound Delivery Charges: Rs. 10,000 across 1,000 KG total volume
      // Expected freight per KG: 10,000 / 1,000 = Rs. 10.0000 / KG
      const freightPerKg = calculateFreightPerKg(10000, 1000);
      expect(freightPerKg).toBe(10.0000);
    });

    it('should handle fractional freight burdens per KG without rounding corruption', () => {
      // Freight: Rs. 7,500 over 850 KG total invoice volume
      // 7500 / 850 = 8.8235294... -> 8.8235
      const freightPerKg = calculateFreightPerKg(7500, 850);
      expect(freightPerKg).toBe(8.8235);
    });

    it('should return 0 freight per KG when volume or delivery charges are zero or non-positive', () => {
      expect(calculateFreightPerKg(0, 1000)).toBe(0);
      expect(calculateFreightPerKg(5000, 0)).toBe(0);
      expect(calculateFreightPerKg(-5000, 1000)).toBe(0);
      expect(calculateFreightPerKg(5000, -1000)).toBe(0);
    });

    it('should calculate landed cost by capitalizing freight into unit cost (Base Price + Freight)', () => {
      // Base Purchase Price: Rs. 900.00 / KG
      // Inbound Freight: Rs. 25.50 / KG
      // Expected Landed Cost: Rs. 925.50 / KG
      const landedCost = calculateItemLandedCost(900.00, 25.50);
      expect(landedCost).toBe(925.50);
    });

    it('should allocate freight proportionally across multi-item purchase invoices by KG volume', () => {
      // Scenario:
      // Item 1: 600 KG @ Rs. 200/KG (Base Subtotal: Rs. 120,000)
      // Item 2: 400 KG @ Rs. 350/KG (Base Subtotal: Rs. 140,000)
      // Total Volume = 1,000 KG. Base Total = Rs. 260,000.
      // Inbound Delivery Charges = Rs. 15,000.
      // Expected Freight Rate = 15,000 / 1,000 = Rs. 15.0000 / KG.
      // Item 1 Freight = 600 * 15 = Rs. 9,000 -> Landed Cost = 200 + 15 = Rs. 215/KG (Total: 129,000)
      // Item 2 Freight = 400 * 15 = Rs. 6,000 -> Landed Cost = 350 + 15 = Rs. 365/KG (Total: 146,000)
      // Total Capitalized Inventory = 260,000 + 15,000 = Rs. 275,000.
      const items: PurchaseItemInput[] = [
        { product_id: 'prod-resin-a', quantity_kg: 600, unit_price: 200 },
        { product_id: 'prod-granule-b', quantity_kg: 400, unit_price: 350 },
      ];

      const allocation = allocateLandedCost(15000, items);

      expect(allocation.total_invoice_kg).toBe(1000);
      expect(allocation.total_base_subtotal).toBe(260000);
      expect(allocation.delivery_charges).toBe(15000);
      expect(allocation.freight_per_kg).toBe(15.0000);
      expect(allocation.total_capitalized_inventory).toBe(275000);
      expect(allocation.freight_drift).toBe(0);

      // Verify Item 1 Landed Cost
      const item1 = allocation.items[0];
      expect(item1.freight_per_kg).toBe(15.0000);
      expect(item1.landed_cost_per_kg).toBe(215.00);
      expect(item1.base_total).toBe(120000);
      expect(item1.allocated_freight).toBe(9000);
      expect(item1.total_landed_cost).toBe(129000);

      // Verify Item 2 Landed Cost
      const item2 = allocation.items[1];
      expect(item2.freight_per_kg).toBe(15.0000);
      expect(item2.landed_cost_per_kg).toBe(365.00);
      expect(item2.base_total).toBe(140000);
      expect(item2.allocated_freight).toBe(6000);
      expect(item2.total_landed_cost).toBe(146000);
    });

    it('should correctly allocate irregular weights with odd fractional freight without leaking cents', () => {
      // 3 items with uneven weights
      const items: PurchaseItemInput[] = [
        { quantity_kg: 333.33, unit_price: 150.00 },
        { quantity_kg: 222.22, unit_price: 180.00 },
        { quantity_kg: 444.45, unit_price: 210.00 },
      ];
      // Total volume = 1,000 KG
      // Delivery charges = Rs. 12,345.67
      const allocation = allocateLandedCost(12345.67, items);

      expect(allocation.total_invoice_kg).toBe(1000);
      // Ensure total capitalized value exactly equals base subtotal + delivery charges
      const expectedTotal = round2(allocation.total_base_subtotal + 12345.67);
      expect(allocation.total_capitalized_inventory).toBe(expectedTotal);
      expect(Math.abs(allocation.freight_drift)).toBeLessThanOrEqual(0.05); // Within sub-nickel rounding tolerance
    });
  });

  // ==========================================================================
  // SECTION 3: WEIGHTED AVERAGE COSTING (WAC / ROLLING AVERAGE COST)
  // ==========================================================================
  describe('3. Weighted Average Cost (WAC) Algorithmic Invariants', () => {

    it('should update WAC accurately when new stock arrives at a higher price', () => {
      // Current: 100 KG in stock @ Rs. 100/KG (Valuation: Rs. 10,000)
      // Arrival: 100 KG @ Rs. 150/KG (Valuation: Rs. 15,000)
      // Expected New WAC: (10,000 + 15,000) / 200 = Rs. 125.0000 / KG
      const newWac = calculateRollingWAC(100, 100, 100, 150);
      expect(newWac).toBe(125.0000);
    });

    it('should update WAC accurately when new stock arrives at a lower price', () => {
      // Current: 200 KG in stock @ Rs. 250/KG (Valuation: Rs. 50,000)
      // Arrival: 50 KG @ Rs. 200/KG (Valuation: Rs. 10,000)
      // Total Qty: 250 KG. Total Valuation: Rs. 60,000.
      // Expected New WAC: 60,000 / 250 = Rs. 240.0000 / KG
      const newWac = calculateRollingWAC(200, 250, 50, 200);
      expect(newWac).toBe(240.0000);
    });

    it('should adopt incoming purchase landed cost if current stock is zero (Initial Batch)', () => {
      // Current Stock: 0 KG
      // Arrival: 500 KG @ Rs. 320.75 / KG
      // Expected WAC: Rs. 320.7500 / KG
      const newWac = calculateRollingWAC(0, 0, 500, 320.75);
      expect(newWac).toBe(320.7500);
    });

    it('should adopt incoming purchase landed cost if current stock was negative (Fulfilling Backorder Deficit)', () => {
      // Current Stock: -50 KG (deficit backorder)
      // Arrival: 100 KG @ Rs. 400.00 / KG
      const newWac = calculateRollingWAC(-50, 350, 100, 400);
      expect(newWac).toBe(400.0000);
    });

    it('should retain current WAC when incoming quantity is zero', () => {
      const newWac = calculateRollingWAC(300, 185.50, 0, 200.00);
      expect(newWac).toBe(185.5000);
    });

    it('should preserve 4 decimal places of costing precision over unequal batches', () => {
      // Current: 350 KG @ Rs. 123.45 / KG
      // Arrival: 475 KG @ Rs. 138.90 / KG
      // Current Val: 350 * 123.45 = 43,207.50
      // Incoming Val: 475 * 138.90 = 65,977.50
      // Total Val: 109,185.00 / 825 KG = 132.3454545... -> 132.3455
      const newWac = calculateRollingWAC(350, 123.45, 475, 138.90);
      expect(newWac).toBe(132.3455);
    });
  });

  // ==========================================================================
  // SECTION 4: TRUE NET MATH (ASSETS - LIABILITIES = NET BUSINESS CAPITAL)
  // ==========================================================================
  describe('4. True Net Math & Net Business Capital (Balance Sheet Invariants)', () => {

    it('should strictly satisfy Total Assets - Total Liabilities = Net Business Capital', () => {
      const assets: NetCapitalAssetsInput = {
        cash_drawer: 25000.00,
        bank_balances: 150000.00,
        market_receivables: 80000.00,
        total_inventory_value: 320000.00,
        supplier_advances_asset: 45000.00,
        post_dated_cheques: 60000.00, // Received PDCs in hand
      };

      const liabilities: NetCapitalLiabilitiesInput = {
        total_accounts_payable: 110000.00,
        customer_advances_liability: 35000.00,
        issued_post_dated_cheques: 50000.00, // Issued PDCs pending clearance
        pending_expenses_liability: 20000.00, // Accrued OPEX liabilities
      };

      const report = calculateNetBusinessCapital(assets, liabilities);

      // Verify Liquid Assets: Cash Drawer (25,000) + Banks (150,000) = 175,000
      expect(report.total_liquid).toBe(175000.00);

      // Verify Total Assets:
      // 175,000 (Liquid) + 80,000 (AR) + 320,000 (Inventory) + 45,000 (Supp Adv) + 60,000 (PDC) = 680,000
      expect(report.total_assets).toBe(680000.00);

      // Verify Total Liabilities:
      // 110,000 (AP) + 35,000 (Cust Adv) + 50,000 (Issued PDC) + 20,000 (Pending OPEX) = 215,000
      expect(report.total_liabilities).toBe(215000.00);

      // Verify Net Business Capital:
      // Total Assets (680,000) - Total Liabilities (215,000) = 465,000
      expect(report.net_business_capital).toBe(465000.00);

      // Strict Fundamental Accounting Equation Assertion:
      expect(report.total_assets - report.total_liabilities).toBe(report.net_business_capital);

      // Total Market Capital (Excluding non-liquid Physical Inventory):
      // 175,000 + 60,000 + 80,000 + 45,000 = 360,000
      expect(report.total_market_capital).toBe(360000.00);
    });

    it('should correctly handle negative Net Business Capital when liabilities exceed assets', () => {
      const assets: NetCapitalAssetsInput = {
        cash_drawer: 5000.00,
        bank_balances: 10000.00,
        market_receivables: 20000.00,
        total_inventory_value: 15000.00,
        supplier_advances_asset: 0,
        post_dated_cheques: 0,
      }; // Total Assets: 50,000

      const liabilities: NetCapitalLiabilitiesInput = {
        total_accounts_payable: 70000.00,
        customer_advances_liability: 15000.00,
        issued_post_dated_cheques: 10000.00,
        pending_expenses_liability: 5000.00,
      }; // Total Liabilities: 100,000

      const report = calculateNetBusinessCapital(assets, liabilities);

      expect(report.total_assets).toBe(50000.00);
      expect(report.total_liabilities).toBe(100000.00);
      expect(report.net_business_capital).toBe(-50000.00);
      expect(report.total_assets - report.total_liabilities).toBe(report.net_business_capital);
    });

    it('should maintain exact zero drift with complex decimal components', () => {
      const assets: NetCapitalAssetsInput = {
        cash_drawer: 12345.67,
        bank_balances: 87654.33,
        market_receivables: 23456.78,
        total_inventory_value: 34567.89,
        supplier_advances_asset: 4567.89,
        post_dated_cheques: 9876.54,
      };

      const liabilities: NetCapitalLiabilitiesInput = {
        total_accounts_payable: 33333.33,
        customer_advances_liability: 11111.11,
        issued_post_dated_cheques: 22222.22,
        pending_expenses_liability: 4444.44,
      };

      const report = calculateNetBusinessCapital(assets, liabilities);

      const computedDiff = round2(report.total_assets - report.total_liabilities);
      expect(report.net_business_capital).toBe(computedDiff);
    });
  });

  // ==========================================================================
  // SECTION 5: UNCAPPED TRUE NET MATH & CUSTOMER DECOUPLING
  // ==========================================================================
  describe('5. Uncapped True Net Math (No Artificial Zero-Capping)', () => {

    it('should NOT zero-cap overpaid invoices, correctly calculating negative balance due & surplus', () => {
      // Invoice Amount: Rs. 10,000. Paid: Rs. 12,000.
      // Net Total: 10,000. Balance Due: -2,000.
      // Surplus to Wallet Advance: Rs. 2,000. Status: OVERPAID.
      const invResult = calculateUncappedInvoiceBalance(10000, 0, 12000);

      expect(invResult.net_invoice_total).toBe(10000.00);
      expect(invResult.paid_amount).toBe(12000.00);
      expect(invResult.balance_due).toBe(-2000.00); // Strict uncapped check!
      expect(invResult.is_overpaid).toBe(true);
      expect(invResult.surplus_to_wallet_advance).toBe(2000.00);
      expect(invResult.status).toBe('OVERPAID');
    });

    it('should handle linked credit notes / returns before evaluating balance due', () => {
      // Gross: Rs. 20,000. Returns / CN: Rs. 5,000. Paid: Rs. 10,000.
      // Net Total: 15,000. Balance Due: 15,000 - 10,000 = 5,000. Status: PARTIAL.
      const invResult = calculateUncappedInvoiceBalance(20000, 5000, 10000);

      expect(invResult.net_invoice_total).toBe(15000.00);
      expect(invResult.balance_due).toBe(5000.00);
      expect(invResult.is_overpaid).toBe(false);
      expect(invResult.surplus_to_wallet_advance).toBe(0);
      expect(invResult.status).toBe('PARTIAL');
    });

    it('should mark invoice as PAID when paid amount exactly equals net invoice total', () => {
      const invResult = calculateUncappedInvoiceBalance(15000, 0, 15000);
      expect(invResult.balance_due).toBe(0);
      expect(invResult.status).toBe('PAID');
      expect(invResult.surplus_to_wallet_advance).toBe(0);

      // Verify UNPAID status when paid amount is zero
      const invUnpaid = calculateUncappedInvoiceBalance(5000, 0, 0);
      expect(invUnpaid.status).toBe('UNPAID');
      expect(invUnpaid.balance_due).toBe(5000.00);
      expect(invUnpaid.is_overpaid).toBe(false);
    });

    it('should decouple customer billed vs paid amounts into separate Outstanding & Advance Credit pools', () => {
      // Scenario A: Customer overpays
      // Invoices: Rs. 18,000. Opening: Rs. 0. Returns: Rs. 0. Paid: Rs. 20,000.
      // Adjusted Billed: 18,000.
      // Since Paid (20,000) >= Billed (18,000) -> Outstanding = 0, Advance Credit = 2,000.
      const custA = calculateCustomerNetBalance(0, 18000, 0, 20000);
      expect(custA.adjusted_billed).toBe(18000.00);
      expect(custA.outstanding_balance).toBe(0.00);
      expect(custA.advance_credit).toBe(2000.00);
      expect(custA.net_balance).toBe(-2000.00);

      // Scenario B: Customer underpays
      // Invoices: Rs. 25,000. Returns: Rs. 3,000. Paid: Rs. 15,000.
      // Adjusted Billed: 22,000.
      // Since Paid (15,000) < Billed (22,000) -> Outstanding = 7,000, Advance Credit = 0.
      const custB = calculateCustomerNetBalance(0, 25000, 3000, 15000);
      expect(custB.adjusted_billed).toBe(22000.00);
      expect(custB.outstanding_balance).toBe(7000.00);
      expect(custB.advance_credit).toBe(0.00);
      expect(custB.net_balance).toBe(7000.00);
    });
  });

  // ==========================================================================
  // SECTION 6: DISCOUNT & PAYMENT SURPLUS ALLOCATOR
  // ==========================================================================
  describe('6. Discount & Surplus Allocator Engine', () => {

    it('should calculate fixed PKR discounts accurately and compute grand total with freight', () => {
      // Subtotal: Rs. 50,000. Discount: Rs. 2,500. Delivery: Rs. 1,200.
      // Net Subtotal = 50,000 - 2,500 = 47,500.
      // Grand Total = 47,500 + 1,200 = 48,700.
      const result = allocateDiscount({ subtotal: 50000, discount_amount: 2500 }, 1200);

      expect(result.subtotal).toBe(50000.00);
      expect(result.calculated_discount).toBe(2500.00);
      expect(result.net_subtotal).toBe(47500.00);
      expect(result.effective_delivery_charges).toBe(1200.00);
      expect(result.grand_total).toBe(48700.00);
      expect(result.discount_rate_percentage).toBe(5.0000); // 2,500 / 50,000 = 5%
    });

    it('should calculate percentage discounts accurately and cap discount at subtotal', () => {
      // Subtotal: Rs. 10,000. Percentage: 15%.
      // Discount = 1,500. Net Subtotal = 8,500.
      const resultPct = allocateDiscount({ subtotal: 10000, discount_percentage: 15, is_percentage: true });
      expect(resultPct.calculated_discount).toBe(1500.00);
      expect(resultPct.net_subtotal).toBe(8500.00);
      expect(resultPct.grand_total).toBe(8500.00);

      // Discount cannot exceed subtotal (cap protection)
      const resultCapped = allocateDiscount({ subtotal: 5000, discount_amount: 8000 });
      expect(resultCapped.calculated_discount).toBe(5000.00);
      expect(resultCapped.net_subtotal).toBe(0.00);
    });

    it('should sequentially allocate payments across open invoices and isolate excess as surplus cash', () => {
      // Scenario:
      // Open Invoices:
      // 1. Inv-1: Total 10,000 (Already allocated: 0) -> Unpaid: 10,000
      // 2. Inv-2: Total 15,000 (Already allocated: 5,000) -> Unpaid: 10,000
      // 3. Inv-3: Total 8,000 (Already allocated: 0) -> Unpaid: 8,000
      // Total Unpaid Debt = 10,000 + 10,000 + 8,000 = Rs. 28,000.
      // Customer Pays: Rs. 35,000.
      // Expected Allocation:
      // Inv-1: +10,000 (Fully Paid)
      // Inv-2: +10,000 (Fully Paid)
      // Inv-3: +8,000 (Fully Paid)
      // Total Allocated = 28,000.
      // Surplus to Customer Wallet Advance = 35,000 - 28,000 = Rs. 7,000!
      const invoices = [
        { id: 'inv-1', total_amount: 10000, already_allocated: 0 },
        { id: 'inv-2', total_amount: 15000, already_allocated: 5000 },
        { id: 'inv-3', total_amount: 8000, already_allocated: 0 },
      ];

      const allocation = allocatePaymentAndSurplus(35000, invoices);

      expect(allocation.payment_amount).toBe(35000.00);
      expect(allocation.total_allocated_to_invoices).toBe(28000.00);
      expect(allocation.surplus_unallocated_cash).toBe(7000.00); // Converted to WALLET_ADVANCE

      expect(allocation.allocations[0].allocated_now).toBe(10000.00);
      expect(allocation.allocations[0].is_fully_paid).toBe(true);

      expect(allocation.allocations[1].allocated_now).toBe(10000.00);
      expect(allocation.allocations[1].is_fully_paid).toBe(true);

      expect(allocation.allocations[2].allocated_now).toBe(8000.00);
      expect(allocation.allocations[2].is_fully_paid).toBe(true);
    });

    it('should partially satisfy invoices when payment is less than total open debt with zero surplus', () => {
      const invoices = [
        { id: 'inv-already-paid', total_amount: 5000, already_allocated: 5000 },
        { id: 'inv-1', total_amount: 10000, already_allocated: 0 },
        { id: 'inv-2', total_amount: 12000, already_allocated: 0 },
      ];
      // Payment: Rs. 15,000
      // inv-already-paid is skipped (unpaid_before: 0)
      // Inv-1 gets 10,000 (PAID), Inv-2 gets 5,000 (PARTIAL, 7,000 left)
      const allocation = allocatePaymentAndSurplus(15000, invoices);

      expect(allocation.total_allocated_to_invoices).toBe(15000.00);
      expect(allocation.surplus_unallocated_cash).toBe(0.00);

      expect(allocation.allocations[0].invoice_id).toBe('inv-already-paid');
      expect(allocation.allocations[0].unpaid_before).toBe(0.00);
      expect(allocation.allocations[0].allocated_now).toBe(0.00);
      expect(allocation.allocations[0].is_fully_paid).toBe(true);

      expect(allocation.allocations[1].allocated_now).toBe(10000.00);
      expect(allocation.allocations[1].unpaid_after).toBe(0.00);
      expect(allocation.allocations[1].is_fully_paid).toBe(true);

      expect(allocation.allocations[2].allocated_now).toBe(5000.00);
      expect(allocation.allocations[2].unpaid_after).toBe(7000.00);
      expect(allocation.allocations[2].is_fully_paid).toBe(false);
    });
  });

  // ==========================================================================
  // SECTION 7: DUAL-UNIT MATERIAL CONVERSION & LINE ITEM MATH
  // ==========================================================================
  describe('7. Dual-Unit Conversion & Line Item Math (Bags <-> KG)', () => {

    it('should convert bags to KG accurately using product standard bag weight', () => {
      // 4 Bags @ 25 KG standard bag weight = 100 KG
      expect(convertBagsToKg(4, 25)).toBe(100.0000);
      // 12.5 Bags @ 50 KG = 625 KG
      expect(convertBagsToKg(12.5, 50)).toBe(625.0000);
    });

    it('should convert KG to equivalent bags count', () => {
      // 250 KG / 25 KG per bag = 10 Bags
      expect(convertKgToBags(250, 25)).toBe(10.0000);
      // 333 KG / 25 KG = 13.32 Bags
      expect(convertKgToBags(333, 25)).toBe(13.3200);
      // Divide by zero protection
      expect(convertKgToBags(250, 0)).toBe(0);
    });

    it('should calculate line total and reverse-compute unit price without precision loss', () => {
      // 80 KG @ Rs. 250/KG = Rs. 20,000
      const total = calculateLineTotal(80, 250);
      expect(total).toBe(20000.00);

      const price = calculateUnitPriceFromTotal(20000, 80);
      expect(price).toBe(250.0000);
    });

    it('should handle decimal weights and prices in POS line totals', () => {
      // 37.45 KG @ Rs. 182.75 / KG = 6,843.9875 -> Rs. 6,843.99
      const total = calculateLineTotal(37.45, 182.75);
      expect(total).toBe(6843.99);
    });
  });
});
