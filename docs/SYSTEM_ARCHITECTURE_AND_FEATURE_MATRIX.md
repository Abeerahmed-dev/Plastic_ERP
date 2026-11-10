# Sabir Plastic ERP — System Architecture & Feature Matrix
**Document Classification:** Lead Technical Product Manager & QA Architect Comprehensive System Audit  
**Target Release:** Release Candidate (Production Ready)  
**Codebase Base:** `Sabir_Plastic_ERP12` (Monorepo: Frontend + Backend)

---

## Executive Summary & System Overview

**Sabir Plastic ERP** is a mission-critical, high-throughput enterprise resource planning platform engineered specifically for industrial plastic manufacturing, bulk wholesale distribution, and retail walk-in point-of-sale operations. 

Unlike conventional generic business tools, this system implements:
1. **Physical Material Realism:** Native dual-unit accounting (Kilograms $\leftrightarrow$ Standard Bora/Bags) with dynamic weight multipliers and rolling weighted average costing (WAC).
2. **Defensive Liquidity Walls:** Strict runtime interceptors preventing negative cash drawer or bank account states across OPEX, payroll advances, supplier payments, and customer cash refunds.
3. **True Inventory Traceability:** Backward-compatible hybrid costing featuring FIFO batch depletion for inventory valuation alongside strict **LIFO Customer Return Restorations** and **Targeted Batch Supplier Returns**.
4. **Asynchronous Rolling Fulfillment:** Backorder queues (`pending_deliveries`) that intercept incoming purchase shipments to satisfy deferred customer orders with automatic **True Cost Correction** reconciling retroactively into financial statements.
5. **Hardware-Agnostic Dual Print Pipelines:** Dedicated print portal CSS isolation cleanly separating 80mm high-speed thermal POS receipts from formal corporate A4 multi-part credit invoices.

---

# SECTION 1: COMPLETE TECH STACK MAPPING

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION LAYER                            │
│  React 19 + TypeScript + Vite + TailwindCSS 3.4 + TanStack Query/Table │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ JSON REST API (Axios Interceptors)
┌────────────────────────────────────▼───────────────────────────────────┐
│                          APPLICATION SERVER                            │
│  Node.js + Express 4.19 + TypeScript + Zod + Helmet + Pino HTTP Logger │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Knex.js Query Builder & Transactor
┌────────────────────────────────────▼───────────────────────────────────┐
│                           DATABASE LAYER                               │
│  PostgreSQL + UUID-OSSP + ACID Isolation + Strict Foreign Constraints  │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Frontend Architecture

| Category | Technology / Library | Version / Target | Architectural Purpose & Implementation Scope |
| :--- | :--- | :--- | :--- |
| **Core Framework** | React | `^19.2.8` | Next-generation React core utilizing functional components, hooks, concurrent rendering, and strict mode. |
| **Language** | TypeScript | `~5.6.2` | End-to-end static typing across all UI state, API request/response payloads, and form bindings. |
| **Build & Tooling** | Vite | `^5.4.21` | Lightning-fast ESM dev server, HMR, and optimized Rollup-based production chunking. |
| **Routing** | React Router DOM | `^6.26.2` | Client-side routing with nested routes, dynamic parameters, and declarative RBAC `ProtectedRoute` guards. |
| **Server State** | TanStack React Query | `^5.56.2` | Declarative asynchronous cache management, automatic stale-while-revalidate, optimistic updates, and query invalidation. |
| **Client State** | Zustand | `^5.0.0` | Minimalist client stores for authentication tokens, active user session, UI sidebar states, and global liquidity state. |
| **Form Engine** | React Hook Form | `^7.53.0` | High-performance uncontrolled form state management with minimal re-renders. |
| **Schema Validation** | Zod + Hookform Resolver | `^3.23.8` / `^3.9.0` | Runtime client-side form validation before payload dispatch. |
| **Table Engine** | TanStack React Table | `^8.20.5` | Headless data grids with column sorting, global search filtering, and client/server pagination. |
| **Data Visualization** | Recharts | `^2.12.7` | Responsive SVG charts for executive dashboards, weekly/monthly sales trajectories, and margin analytics. |
| **Design System** | TailwindCSS + PostCSS | `^3.4.13` | Utility-first CSS framework coupled with custom CSS custom properties for enterprise Dark/Light modes. |
| **Style Utilities** | CVA, CLSX, Tailwind-Merge | `^0.7.0` / `^2.1.1` | Conflict-free dynamic className generation and variant composition. |
| **Notifications** | Sonner | `^2.0.8` | Toast notification system with custom ERP color themes, high-contrast borders, and transaction feedback. |
| **Icons** | Lucide React | `^0.441.0` | Consistent, lightweight vector icon set for ERP dashboards, status badges, and action triggers. |
| **HTTP Client** | Axios | `^1.7.7` | Promised-based HTTP client equipped with automated JWT injection and 401 refresh token retry interceptors. |
| **Date Arithmetic** | Date-fns | `^4.1.0` | Standardized date parsing, formatting, and period boundary calculations (Today, This Week, This Month). |

### 1.2 Backend Architecture

| Category | Technology / Library | Version / Target | Architectural Purpose & Implementation Scope |
| :--- | :--- | :--- | :--- |
| **Runtime Engine** | Node.js (LTS) | `v20.x+` | Asynchronous event-driven JavaScript server environment. |
| **Language** | TypeScript | `^5.5.3` | Strong typing across controllers, repositories, middleware, services, and database DTOs. |
| **Web Framework** | Express.js | `^4.19.2` | Modular routing framework organized into domain-driven feature modules (`/api/v1/*`). |
| **Database Access** | Knex.js | `^3.1.0` | SQL query builder, migration runner, seed manager, and transactor providing fine-grained lock control (`forUpdate()`). |
| **ORM Adapter Layer** | Custom `ensureTxAdapter` | Internal | Adapter layer bridging Knex database transactions to Prisma-like query and update abstractions for inventory batch manipulation. |
| **Database Driver** | `pg` (node-postgres) | `^8.12.0` | High-performance PostgreSQL connection pool driver. |
| **Data Validation** | Zod | `^3.23.8` | Strict HTTP request payload and query parameter runtime verification. |
| **Security Hardening**| Helmet & CORS | `^7.1.0` / `^2.8.5` | Strict HTTP response header security, Content Security Policy, and origin restriction. |
| **Anti-Cache Guards** | Custom Middleware | Internal | Disables ETag and enforces `Cache-Control: no-store, no-cache, must-revalidate` across all transactional ERP endpoints. |
| **Authentication** | JWT (`jsonwebtoken`) | `^9.0.2` | Dual-token authentication (short-lived access tokens + cryptographically random refresh tokens). |
| **Password Security**| Bcrypt | `^5.1.1` | Salted cryptographic password hashing with 10 salt rounds. |
| **Structured Logging**| Pino + Pino-HTTP | `^9.3.2` | High-speed JSON structured logging with request correlation IDs and pretty printing in development. |

### 1.3 Database Architecture (PostgreSQL)

* **Schema Precision:** Monetary quantities and currency values are locked at `NUMERIC(14, 2)` or `NUMERIC(14, 4)` to eliminate IEEE 754 floating-point inaccuracies.
* **UUID Primary Keys:** All tables utilize `uuid_generate_v4()` for primary keys to prevent enumeration attacks and support distributed data generation.
* **Referential Integrity:** Enforced foreign key constraints (`ON DELETE RESTRICT` for master entities like Products/Customers; `ON DELETE CASCADE` for line items).
* **Row-Level Concurrency:** Explicit `FOR UPDATE` pessimistic row locking in critical financial and inventory paths.

### 1.4 Rendering & Print Pipeline

* **CSS Print Isolation:** Dedicated `@media print` rules controlling visibility between `#root` application container and `#print-portal` roots (`body.printing-a4` and `body.printing-pos`).
* **Thermal Rendering Engine:** Exact-width `80mm` canvas with monospaced font hierarchy, explicit tabular alignment, dotted CSS boundaries, and high-contrast thermal printer black output.
* **A4 Multi-Part Invoice Engine:** DIN A4 standard dimensions (`210mm × 297mm`) featuring company header branding, customer billing/shipping details, credit/debit return reference trees, and fiscal authorization sign-off blocks.

---

# SECTION 2: FINANCIAL ENGINE & LEDGERS

```
                            ┌─────────────────────────────────────────┐
                            │         CENTRAL LIQUIDITY WALL          │
                            │  Pre-Flight Balance Assertion Guard     │
                            └───────────────────┬─────────────────────┘
                                                │
                 ┌──────────────────────────────┼──────────────────────────────┐
                 ▼                              ▼                              ▼
      ┌────────────────────┐         ┌────────────────────┐         ┌────────────────────┐
      │    Cash Drawer     │         │   Bank Accounts    │         │  Advance Wallets   │
      │   Available Cash   │         │  Current Balances  │         │   Credit Balances  │
      └──────────┬─────────┘         └──────────┬─────────┘         └──────────┬─────────┘
                 │                              │                              │
                 ├──────────────────────────────┴──────────────────────────────┤
                 │ OUTFLOW VALIDATION: Requested Amount <= Available Liquidity │
                 ▼                                                             ▼
     [PASS: Atomic Transaction Execution]                    [FAIL: 400 InsufficientLiquidityError]
```

### 2.1 The Liquidity Wall (Defensive Outflow Enforcement)

The **Liquidity Wall** is a core architectural barrier preventing any financial outflow from exceeding physical liquid assets in real-time.

* **Architecture & Interceptors:**
  * Handled via `InsufficientLiquidityError` in [errors.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/shared/errors.ts) and trapped by the global Express error handler [errorHandler.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/middleware/errorHandler.ts).
  * Returns an immediate, non-negotiable `400 Bad Request` with structured error messages:
    $$\text{"INSUFFICIENT\_LIQUIDITY: Cannot withdraw more cash than the account holds."}$$
* **Coverage Scope:**
  1. **Operating Overheads (OPEX):** [expenses.repository.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/modules/expenses/expenses.repository.ts) checks physical cash in drawer balance or issues `SELECT ... FOR UPDATE` against `bank_accounts.current_balance`.
  2. **Supplier Disbursements:** [supplier-payments.repository.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/modules/supplier-payments/supplier-payments.repository.ts) blocks cash or bank payments if the disbursement exceeds liquid funds.
  3. **Customer Cash Refunds:** [customer-refunds.repository.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/modules/customer-refunds/customer-refunds.repository.ts) halts refunds if drawer or selected bank lacks liquidity.
  4. **Internal Bank Transfers (Contra):** [bank-accounts.repository.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/modules/bank-accounts/bank-accounts.repository.ts) verifies source balance before committing debit/credit pairs.
  5. **Employee Advances:** [advances.repository.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/modules/advances/advances.repository.ts) verifies funds prior to payroll loan disbursal.

### 2.2 Uncapped True Net Math (No Artificial Zero-Capping)

Standard ERP systems often apply `Math.max(0, balance)`, which destroys visibility into overpayments and refund claims. Sabir Plastic ERP implements **Uncapped True Net Math**:

$$\text{Net Invoice Total} = \text{Total Amount} - \sum |\text{Linked Credit Notes}|$$
$$\text{Balance Due} = \text{Net Invoice Total} - \text{Amount Paid}$$

* **Negative Balance Handling:**
  * If $\text{Balance Due} < 0$, the invoice is not forced to `0.00`. Instead, the system marks the invoice as **`OVERPAID`** with an Amber alert badge.
  * This negative balance seamlessly reflects into the customer's **Advance Wallet** as a payable liability of the company to the customer.
* **Customer Net Balance Decoupling:**
  * Implemented in [customers.repository.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/modules/customers/customers.repository.ts) via `computeCustomerNetBalance`:
    $$\text{Adjusted Billed} = (\text{Opening Balance} + \text{Total Invoices}) - \text{Total Returns}$$
    $$\text{If Total Paid} \ge \text{Adjusted Billed} \implies \begin{cases} \text{Outstanding} = 0 \\ \text{Advance Credit} = \text{Total Paid} - \text{Adjusted Billed} \end{cases}$$
    $$\text{If Total Paid} < \text{Adjusted Billed} \implies \begin{cases} \text{Outstanding} = \text{Adjusted Billed} - \text{Total Paid} \\ \text{Advance Credit} = 0 \end{cases}$$
    $$\text{Net Customer Balance} = \text{Outstanding} - \text{Advance Credit}$$

### 2.3 Traceable Credit & Refund Wallets

* **Customer Advance Wallet (`WALLET_ADVANCE`):**
  * When a customer makes an unallocated payment or has credit resulting from overpayment or sales returns, the surplus resides in their Advance Credit pool.
  * When creating a new invoice, the cashier/admin can apply an advance offset. The system generates a synthetic payment record tagged `payment_method = 'WALLET_ADVANCE'` linked to `payment_allocations`.
  * **Critical Audit Safeguard:** `WALLET_ADVANCE` payments are explicitly excluded from daily cash drawer inflows and total raw revenue calculations (`WHERE payment_method != 'WALLET_ADVANCE'`), preventing double-counting of cash.
* **Direct Cash Refunds (`RFD-XXXXX`):**
  * When disbursing cash back to a customer from their advance wallet, [customer-refunds.repository.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/modules/customer-refunds/customer-refunds.repository.ts):
    1. Validates $\text{Refund Amount} \le \text{Advance Credit}$.
    2. Validates liquidity wall for the disbursing account.
    3. Inserts negative payment row in `customer_payments` with `amount = -Math.abs(refundAmount)`.
    4. Inserts outflow row into `cash_drawer_ledger` (`type: 'OUTFLOW'`) or `bank_transactions` (`type: 'WITHDRAWAL'`).

### 2.4 OPEX Integration (Operating Expenses & P&L Synchronization)

* **Dual-State Expense Flow:**
  * Expenses support two states: `status: 'PAID'` and `status: 'PENDING'`.
  * `PENDING` expenses allow registering incurred liabilities (such as freight or monthly rent) without immediately triggering cash or bank deductions.
  * Subsequent settlements through `payExpenseRecord` record historical payments in `expense_payments` and execute liquidity-walled disbursements.
* **Purchase Delivery Charge OPEX Bridge:**
  * When purchase bills include delivery/freight charges, the system can automatically log an OPEX record tied to `purchase_id`, ensuring transportation overhead is recognized.
* **P&L Real-Time Integration:**
  * In [reports.repository.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/modules/reports/reports.repository.ts) (`getIncomeStatementReport`):
    $$\text{Net Revenue} = (\text{Gross Sales} + \text{Delivery Revenue}) - \text{Sales Returns}$$
    $$\text{Gross Profit} = \text{Net Revenue} - \text{COGS (Realized \& Restored)}$$
    $$\text{Net Profit} = \text{Gross Profit} - \sum \text{Operating Expenses}$$
  * Displays itemized OPEX breakdown categorized into Factory Rent, Electricity, Labor, Tea/Refreshment, Maintenance, and Freight.

### 2.5 Internal Bank Transfers (Contra Entries)

* **Dual-Entry Transactional Atomicity:**
  * Managed via `transferFunds` in [bank-accounts.repository.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/modules/bank-accounts/bank-accounts.repository.ts).
  * Executes within a single ACID transaction (`db.transaction`).
* **Source & Destination Matrix:**
  * `CASH_DRAWER` $\leftrightarrow$ `bank_accounts` (Cash deposits and withdrawals).
  * `bank_accounts` $\leftrightarrow$ `bank_accounts` (Inter-bank liquidity balancing).
* **Ledger Entries Created:**
  1. Source Outflow: Decrements `bank_accounts.current_balance` and logs `bank_transactions` (`WITHDRAWAL`, category: `INTERNAL_TRANSFER`) OR inserts `cash_drawer_ledger` (`OUTFLOW`).
  2. Destination Inflow: Increments target `bank_accounts.current_balance` and logs `bank_transactions` (`DEPOSIT`, category: `INTERNAL_TRANSFER`) OR inserts `cash_drawer_ledger` (`INFLOW`).

---

# SECTION 3: SUPPLY CHAIN & INVENTORY

```
                          ┌─────────────────────────────────────────┐
                          │         PURCHASE BILL ARRIVAL           │
                          │   New Stock Arrives from Supplier       │
                          └───────────────────┬─────────────────────┘
                                              │
                                              ▼
                          ┌─────────────────────────────────────────┐
                          │         THE INTERCEPTOR QUEUE           │
                          │   Query `pending_deliveries` FIFO       │
                          └───────────────────┬─────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │                                                   │
                    ▼                                                   ▼
       [Backorders Exist in Queue]                             [No Waiting Backorders]
                    │                                                   │
                    ▼                                                   ▼
       1. Fulfill Backorder Immediately                        1. Create Standard Batch
       2. Update `sales_invoice_items.actual_cogs`                in `inventory_batches`
       3. Retroactively Reconcile P&L Statements               2. Add Stock to Warehouse Shelves
       4. Remainder Stock Cascades to Shelves                     (`products.total_stock_kg`)
```

### 3.1 LIFO Customer Restorations (Sales Returns & Credit Notes)

When a customer returns sold goods or a Credit Note (`CN-XXXXX`) is authorized, returning inventory to physical stock must not corrupt historical FIFO/WAC cost layers.

* **The Algorithm (`restoreInventoryBucketsLifo`):**
  * Implemented in [invoices.repository.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/modules/invoices/invoices.repository.ts).
  * Queries `inventory_batches` where `product_id = returnedProductId` and `remaining_qty < original_qty`, ordered strictly **LIFO** (`ORDER BY created_date DESC`).
* **Step-by-Step Execution:**
  1. **Capacity Headroom Inspection:** For each bucket, calculates $\text{Space Available} = \text{original\_qty} - \text{remaining\_qty}$.
  2. **Sequential Restoration:** Restores $\min(\text{qtyToRestore}, \text{Space Available})$ into `remaining_qty`.
  3. **Status Reactivation:** If the bucket was `DEPLETED`, flips status back to `ACTIVE`.
  4. **COGS Reversal Recovery:** Accumulates restored COGS:
     $$\text{Restored COGS} = \sum (\text{Restored Qty} \times \text{batch\_buy\_price\_per\_kg})$$
  5. **Overflow Cascade:** If total returned quantity exceeds available depleted headroom across all existing batches, overflow is injected into the newest active bucket to guarantee 100% quantity accounting.
  6. **Physical Stock Sync:** Increments warehouse capacity `products.total_stock_kg += returned_kg`.

### 3.2 Targeted Supplier Returns (Debit Notes & Anti-Double-Spend)

When defective raw materials or granules are returned to a vendor via a Debit Note (`DN-XXXXX`), inventory cannot simply be pulled from random stock.

* **Targeted Batch Binding:**
  * Implemented in `processPurchaseReturn` ([purchases.repository.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/modules/purchases/purchases.repository.ts)).
  * Locates the exact `inventory_batches` record created by `parent_invoice_id` for that specific `product_id`.
* **Validation Wall (Anti-Double-Spend Protection):**
  * If the batch remaining quantity is less than the requested return quantity:
    $$\text{If } \text{batch.remaining\_qty} < \text{returnedQty} \implies \mathbf{THROW\ ERROR:\ 'STOCK\_ALREADY\_SOLD'}$$
  * This prevents returning goods to a vendor that have already been converted into product or sold to retail customers.
* **Dual Capacity Deduction:**
  * Deducts `returnedQty` from **BOTH** `remaining_qty` AND `original_qty` on the target batch.
  * Decrements physical warehouse stock `products.total_stock_kg = GREATEST(0, total_stock_kg - returnKg)`.
  * Decrements supplier's accounts payable balance and generates linked `purchase_invoices` row with `invoice_type = 'DEBIT_NOTE'`.

### 3.3 Deferred Fulfillment (Backorders & Rolling Fulfillment Queue)

Industrial plastic orders often exceed immediate on-hand warehouse inventory. The system implements a **Deferred Backorder Pipeline** (Migration `050_create_pending_deliveries_and_deferred_cogs.ts`).

* **Phase 1: Sales Shortfall Routing**
  * If requested quantity exceeds on-hand stock during wholesale invoice creation:
    * Available stock is deducted.
    * The item is marked `is_deferred = true`.
    * Provisional financial cost is booked to `estimated_cogs` using rolling WAC.
    * The unmet shortfall is queued in `pending_deliveries` (`status: 'PENDING'`).
* **Phase 2: The Interceptor (Rolling Auto-Reconciliation)**
  * When a new purchase invoice arrives in [purchases.repository.ts](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/backend/src/modules/purchases/purchases.repository.ts):
    1. Scans `pending_deliveries` using **FIFO** priority (`ORDER BY created_at ASC FOR UPDATE`).
    2. Before new stock hits general warehouse shelves, it satisfies waiting backorders.
    3. If incoming quantity $\ge$ pending shortfall:
       * Delivery is marked `FULFILLED`.
       * Original sales line `actual_cogs` is updated with actual purchase price.
       * `estimated_cogs` is overwritten with `actual_cogs`, and `applied_cogs_per_kg` is re-locked.
    4. If incoming quantity $<$ pending shortfall:
       * Delivery is updated to `PARTIAL`, fulfilling available amount.
       * `actual_cogs` is updated proportionally.
  * **Financial Realism:** Automatically reconciles historical income statements to exact realized profitability without manual journal entries.

### 3.4 Variant-Level Low Stock Thresholds

* **Granular Threshold Control:**
  * Column `products.low_stock_threshold` (Migration `051_add_low_stock_threshold_and_compulsory_sizes.ts`).
  * Configurable per SKU / Variant (e.g. 100 KG for fast-moving 25mm pipe fittings vs 1,000 KG for standard PE film granules).
* **Inventory Prioritization:**
  * Low stock queries order items by relative urgency:
    $$\text{ORDER BY } (\text{p.total\_stock\_kg} - \text{p.low\_stock\_threshold}) \text{ ASC}$$
  * Real-time badges across UI:
    * **Out of Stock:** Total stock $= 0\text{ KG}$ (Red).
    * **Low Stock:** Total stock $\le \text{Threshold}$ (Amber).
    * **In Stock:** Total stock $> \text{Threshold}$ (Emerald).

---

# SECTION 4: SALES & PURCHASES ENGINE

### 4.1 Bidirectional Line-Item Math

The line-item input engine across [InvoiceFormModal.tsx](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/frontend/src/pages/Invoices/InvoiceFormModal.tsx), [PurchaseFormModal.tsx](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/frontend/src/pages/Purchases/PurchaseFormModal.tsx), and [POSPage.tsx](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/frontend/src/pages/POS/POSPage.tsx) is completely bidirectional:

```
                      ┌──────────────────────┐
                      │    Bora / Bags       │
                      │    (e.g., 4 Bags)    │
                      └──────────┬───────────┘
                                 │ ▲  × / ÷ bag_weight_kg (25 KG)
                                 ▼ │
                      ┌──────────────────────┐
    ┌─────────────────┤    Quantity (KG)     ├─────────────────┐
    │                 │   (e.g., 100 KG)     │                 │
    │                 └──────────────────────┘                 │
    │                                                          │
    │ × Unit Price                                             │ ÷ Quantity
    ▼                                                          ▼
┌──────────────────────┐                             ┌──────────────────────┐
│     Line Total       │ ◄────────────────────────── │      Unit Price      │
│  (e.g., Rs. 25,000)  │        × Quantity           │   (e.g., Rs. 250/KG) │
└──────────────────────┘                             └──────────────────────┘
```

1. **Bags $\rightarrow$ Quantity (KG):**
   $$\text{Quantity (KG)} = \text{Bags Input} \times \text{Standard Bag Weight}$$
2. **Quantity (KG) $\rightarrow$ Bags:**
   $$\text{Bags Input} = \frac{\text{Quantity (KG)}}{\text{Standard Bag Weight}}$$
3. **Quantity $\times$ Unit Price $\rightarrow$ Line Total:**
   $$\text{Line Total} = \text{Round}_{2}(\text{Quantity} \times \text{Unit Price})$$
4. **Line Total $\div$ Quantity $\rightarrow$ Unit Price:**
   $$\text{Unit Price} = \frac{\text{Line Total}}{\text{Quantity}}$$

### 4.2 Rigid 2-Decimal Locking Architecture

Floating-point representations in JavaScript (`0.1 + 0.2 = 0.30000000000000004`) lead to balance divergence over thousands of transactions.

* **Frontend Rounding Discipline:**
  Every computational node enforces:
  $$\text{Round}_{2}(x) = \frac{\text{Math.round}(x \times 100)}{100}$$
* **Backend Database Integrity:**
  Database columns utilize PostgreSQL `DECIMAL(14, 2)` for monetary values and `DECIMAL(14, 4)` for high-precision physical weight multipliers.
* **Summation Consistency:**
  Invoice subtotal is derived from the sum of individually rounded line totals, guaranteeing that the visual line items on printed receipts match the invoice grand total to the exact cent.

### 4.3 Compulsory Variant & Size Enforcement

* **Relational Schema Constraints (Migration `051`):**
  * Columns `size` across `products`, `sales_invoice_items`, `purchase_invoice_items`, and `inventory_batches` are strictly enforced with `NOT NULL DEFAULT 'Standard'`.
* **Two-Tier Family Combobox Architecture:**
  * Products are grouped into parent "Product Families" by name (e.g. "Heavy Duty Garbage Bags").
  * When a Family is selected:
    * If only 1 variant exists, it auto-selects.
    * If multiple sizes/variants exist (e.g. Small, Medium, Large, Extra Heavy), the variant selector is marked **Compulsory**. The user is blocked from submitting until a specific size variant is chosen.

---

# SECTION 5: HARDWARE INTEGRATION & PRINT MEDIA ARCHITECTURE

```
                                  WINDOW PRINT CALL
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                   ▼
             body.printing-a4                    body.printing-pos
                        │                                   │
         ┌──────────────┴──────────────┐     ┌──────────────┴──────────────┐
         ▼                             ▼     ▼                             ▼
   #root { display: none }       A4 Portal   #root { display: none }    POS Portal
                               (Full Width)                             (80mm Width)
```

### 5.1 Print Media CSS Architecture (`@media print`)

In modern single-page applications, printing via browser defaults frequently renders navigation sidebars, headers, action buttons, and background canvas colors. Sabir Plastic ERP implements a strict **Portal-Swapping CSS Architecture** in [index.css](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/frontend/src/index.css):

```css
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    background-color: #ffffff !important;
  }

  /* Completely suppress React SPA viewport */
  body.printing-a4 > #root,
  body.printing-pos > #root {
    display: none !important;
  }

  /* A4 Invoice Print Portal Activation */
  body.printing-a4 .invoice-print-portal {
    display: block !important;
    position: static !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* 80mm Thermal Receipt Print Portal Activation */
  body.printing-pos .pos-print-portal {
    display: block !important;
    position: static !important;
    width: 80mm !important;
    max-width: 80mm !important;
    margin: 0 auto !important;
    padding: 0 !important;
  }
}
```

### 5.2 80mm Thermal POS Receipts vs. A4 Credit Invoices

| Feature / Dimension | 80mm Thermal POS Slip (`ThermalReceipt80mm.tsx`) | A4 Multi-Part Credit Invoice (`A4SalesInvoice.tsx`) |
| :--- | :--- | :--- |
| **Physical Width** | Fixed `80mm` roll canvas | Standard DIN A4 (`210mm × 297mm`) |
| **Primary Target** | Walk-in counter customers, retail cash sales | Wholesale B2B clients, institutional credit buyers |
| **Typography** | Monospaced high-density mono font (`11px` / `10px`) | Modern proportional sans-serif (`Inter` / `Roboto`) |
| **Visual Elements** | Dotted/dashed dividers, centered logo, thermal borders | Full corporate letterhead, 2-color table headers |
| **Cash Data** | Displays `Cash Tendered`, `Change Due`, Cashier Name | Displays `Payment Terms`, `Credit Limits`, `Due Date` |
| **Audit Trails** | POS shift sequence number and exact timestamp | Formal invoice number, delivery address, creator ID |
| **Return History** | Highlights return slip type (`CASH RETAIL RETURN`) | Renders nested child Credit Notes & linked Debit Notes |
| **Signature Blocks** | Not required (Receipt of sale) | Formal dual sign-offs ("Authorized Signatory", "Receiver") |

### 5.3 Pre-Print Configuration & Lifecycle Management

Both print modes execute a reliable event lifecycle managed in [InvoiceDetailModal.tsx](file:///c:/Users/yahya/OneDrive/Desktop/Plastics/Sabir_Plastic_ERP12/frontend/src/components/InvoiceDetailModal.tsx):
1. **Trigger:** User clicks "Print A4" or "Thermal 80mm".
2. **DOM Injection:** Injects CSS class `printing-a4` or `printing-pos` onto `document.body`.
3. **Print Dialog Execution:** Dispatches `window.print()` after a 150ms RAF delay ensuring portal layout recalculation.
4. **Lifecycle Teardown:** Listens for `window.addEventListener('afterprint', ...)`:
   * Strips print classes from `document.body`.
   * Unmounts print portal memory buffers.
   * Restores interactive React SPA viewport seamlessly without page reload.

---

# SECTION 6: COMPREHENSIVE QA TEST MATRIX (TESTING VECTORS)

| Test ID | Module | Area / Feature | High-Risk Test Scenario | Expected System Result & Assertion |
| :--- | :--- | :--- | :--- | :--- |
| **TC-LIQ-01** | Finance | Liquidity Wall (OPEX) | Attempt to log Rs. 50,000 cash expense when drawer holds Rs. 20,000. | Backend rejects with `400 InsufficientLiquidityError`. Cash drawer is unchanged. |
| **TC-LIQ-02** | Finance | Liquidity Wall (Bank) | Attempt bank transfer of Rs. 200,000 when source bank balance is Rs. 150,000. | Rejection with `INSUFFICIENT_LIQUIDITY`. No debit or credit transaction recorded. |
| **TC-LIQ-03** | Finance | Liquidity Wall (Refund) | Customer has Rs. 10,000 credit wallet, but Cash Drawer only holds Rs. 4,000. | Intercepted at liquidity wall. Rejects refund disbursement with 400 status. |
| **TC-WAL-01** | Finance | Advance Wallet Virtuals | Create sales invoice applying Rs. 15,000 from customer advance wallet. | Generates virtual payment tagged `WALLET_ADVANCE`. Cash drawer total is **not** incremented. |
| **TC-WAL-02** | Finance | Wallet Double-Counting | Query daily cash register tally after recording 5 cash sales and 2 wallet advances. | Tally reflects exact cash sales only; wallet advances are omitted from physical cash total. |
| **TC-NET-01** | Finance | Uncapped True Net Math | Invoice of Rs. 10,000 paid with Rs. 12,000. Check balance due. | Balance due shows **`-2,000.00`** with `OVERPAID` badge; math is not capped to zero. |
| **TC-CON-01** | Finance | Internal Contra Transfers | Transfer Rs. 25,000 from Cash Drawer to Meezan Bank. | Drawer decreases by Rs. 25,000; Meezan Bank increments by Rs. 25,000 in one atomic transaction. |
| **TC-RET-01** | Inventory | LIFO Return Restoration | Partially consume 3 batches (old to new). Process sales return of 50 KG. | Iterates newest bucket first (LIFO), fills available headroom, flips depleted bucket to `ACTIVE`. |
| **TC-RET-02** | Inventory | LIFO Return Overflow | Return 100 KG when total depleted headroom across all existing batches is 80 KG. | 80 KG restores existing batches; remaining 20 KG cascades to newest bucket without crash. |
| **TC-SUP-01** | Inventory | Targeted Supplier Return | Process Debit Note against purchase bill whose batch was already 100% sold. | Validation wall halts return with error: `STOCK_ALREADY_SOLD`. Physical stock untouched. |
| **TC-SUP-02** | Inventory | Supplier Return Batch Sync | Process Debit Note for 20 KG against batch with 50 KG remaining. | Deducts 20 KG from `remaining_qty` AND `original_qty`. `products.total_stock_kg` decreases. |
| **TC-DEF-01** | Supply Chain | Deferred Backorders | Create invoice for 500 KG when on-hand stock is 200 KG. | 200 KG shipped immediately; 300 KG queued in `pending_deliveries` with status `PENDING`. |
| **TC-DEF-02** | Supply Chain | The Interceptor (Rolling) | Purchase invoice for 500 KG arrives while 300 KG backorder is waiting. | 300 KG immediately fulfills backorder; only remaining 200 KG reaches warehouse shelves. |
| **TC-DEF-03** | Financials | True Cost Correction | Purchase arrives at Rs. 260/KG for backorder provisionally booked at WAC Rs. 240/KG. | `sales_invoice_items.actual_cogs` updated to Rs. 260; P&L Net Profit reconciles accurately. |
| **TC-MAT-01** | Sales/POS | Bidirectional Conversion | Enter 5 Bags in invoice line item with `bag_weight_kg = 25`. | Quantity automatically sets to 125.00 KG. Line total updates instantly. |
| **TC-MAT-02** | Sales/POS | Reverse Unit Price Math | In wholesale invoice, set Quantity to 80 KG and directly edit Total to Rs. 20,000. | Unit price automatically recalculates to exactly Rs. 250.00/KG without rounding error. |
| **TC-VAR-01** | Catalog | Compulsory Variant Block | Attempt to add a product family with 3 size variants without picking a variant. | Add button disabled or error triggered. Variant selection is strictly enforced. |
| **TC-PRN-01** | Hardware | Print Media CSS Isolation | Trigger A4 print modal from invoice details. Check browser print preview. | `#root` application is completely hidden; only `.invoice-print-portal` is rendered on white canvas. |
| **TC-PRN-02** | Hardware | 80mm Thermal Receipt Bounds | Trigger POS print for receipt with 15 items. | Page width stays strictly at 80mm; monospaced font, dotted line borders, and logo render cleanly. |
| **TC-PRN-03** | Hardware | Print Lifecycle Teardown | Cancel print preview dialog or complete print job. | `afterprint` listener fires, removes `printing-a4` / `printing-pos` classes, restores SPA screen. |

---

# SECTION 7: DEPLOYMENT PLANNING & PRODUCTION READINESS CHECKLIST

### 7.1 Environment Configuration Audit
- [ ] Ensure `NODE_ENV=production` in backend runtime environment.
- [ ] Confirm PostgreSQL connection pool limits (`DB_POOL_MIN=2`, `DB_POOL_MAX=20`).
- [ ] Validate `JWT_SECRET` and `REFRESH_SECRET` are set to cryptographically secure $\ge 256$-bit strings.
- [ ] Verify `CORS_ORIGIN` matches exact production frontend domain.

### 7.2 Database Migrations & Integrity
- [ ] Run `npm run migrate:latest` to ensure all 62 migrations are executed sequentially.
- [ ] Validate foreign key indexes on `sales_invoice_items`, `purchase_invoice_items`, and `inventory_batches`.
- [ ] Verify table `pending_deliveries` status constraint `chk_pending_deliveries_status`.

### 7.3 Final Operational Verifications
- [ ] Validate thermal receipt print alignment on physical EPSON / Xprinter 80mm thermal USB/LAN printers.
- [ ] Verify cashier role restrictions: Cashier accounts can access POS and Retail Receipts, but are blocked from backend financial reports, purchases, and employee payroll.
