# Sabir Plastic ERP - Complete Features & Testing Specification

> **Document Purpose:** Complete functional breakdown of the Sabir Plastic ERP System separated into **Frontend Features** and **Backend Features** for designing manual and automated Test Cases (QA).

---

# PART 1: FRONTEND FEATURES SPECIFICATION

## 1.1 Authentication & Route Security
* **Files:** `src/pages/Login.tsx`, `src/components/ProtectedRoute.tsx`, `src/store/auth.store.ts`, `src/services/api.ts`
* **Features:**
  * **User Login Form:** Form validation for email/username and password. Displays loading spinner and Sonner error toast on failed login.
  * **State & Token Persistence:** Tokens (`access_token`, `refresh_token`) stored in `localStorage` and synchronized with Zustand `useAuthStore`.
  * **JWT Interceptor:** Axios request interceptor injects `Authorization: Bearer <token>`. Response interceptor detects `401 Unauthorized`, automatically invokes `/api/v1/auth/refresh`, updates the store, and replays failed queries without user interruption.
  * **Role-Based Routing (`ProtectedRoute`):**
    * Unauthenticated users are redirected to `/login`.
    * Users with role `CASHIER` are strictly redirected away from `/dashboard`, `/reports`, `/purchases`, `/users`, `/payments`, and `/suppliers` directly to `/pos`.
  * **Logout:** Clears `localStorage` tokens and Zustand state, immediately routing to `/login`.

---

## 1.2 Layout & Navigation (`MainLayout.tsx`)
* **Responsive Sidebar & Breadcrumbs:**
  * Collapsible desktop sidebar and mobile overlay drawer toggleable with hamburger menu.
  * Active route indicator highlighting with Amber gold gradients (`amber-400` to `amber-600`).
  * Dynamic header displaying Page Title and Subtitle based on the active route.
* **Role-Based Navigation Visibility:**
  * Dynamic filtering of sidebar navigation links.
  * Hides **Purchases**, **Financial Reports**, **Employees/Users**, and **Supplier Payments** when logged in as `CASHIER`.
  * Multi-level collapsible tree for `Finance -> Reports` (Income Statement, Margin Analytics, Inventory Valuation, Financial Reports).

---

## 1.3 Walk-in POS Terminal (`POSPage.tsx`)
* **Components:** `POSPage.tsx`, `ReceiptPrinter.tsx`, `AddCustomerModal.tsx`, `ShiftAuditModal.tsx`, `LogExpenseModal.tsx`
* **Features & Test Scenarios:**
  * **Fast Product Search:**
    * 300ms debounced product searching across catalog.
    * Highlights low-stock and zero-stock items.
  * **Stock Protection:**
    * Blocks adding products with 0 KG stock.
    * Warns and limits input when quantity requested exceeds available stock.
  * **Unit of Measure (UOM) Multiplier:**
    * Toggle between **KG** and **BAG / BORA**.
    * Selecting Bag/Bora dynamically multiplies entered quantity by `bag_weight_kg`.
    * Displays calculated total weight in KG on cart line.
  * **Pricing & Cart Math:**
    * Automatically populates `fixed_retail_price_per_kg`.
    * Calculates Line Total: `Total KG × Price per KG`.
    * Cart summary updates: Subtotal, Discount, Grand Total.
    * **Discounts:** Supports **Fixed PKR** or **Percentage (%)**. Validates discount does not exceed subtotal.
    * **Cash Tender & Change:** Input field for `Amount Paid`; calculates `Change Due` in real-time.
  * **Customer Selection & Creation:**
    * Dropdown filtered for cash/walk-in customers.
    * Inline **Add Customer Modal** to create customer on the fly without abandoning current cart.
  * **Petty Cash Expense:**
    * Inline **Log Expense Modal** to record cash payments directly out of the cash drawer (e.g. tea, transport).
  * **Thermal Receipt Printing:**
    * Generates formatted printable slip (80mm / 58mm) with invoice number, date/time, cashier name, item rows, discounts, paid amount, and change due.
  * **Cashier Shift Audit & Tally:**
    * Shows today's cash tally collected.
    * **Shift Audit Modal:** Inputs physical cash counted in drawer, compares with system expected cash, and highlights cash surplus or deficit.

---

## 1.4 Sales Invoices (`InvoicesListPage.tsx`)
* **Components:** `InvoicesListPage.tsx`, `InvoiceFormModal.tsx`, `InvoiceDetailModal.tsx`, `ProcessReturnModal.tsx`, `CascadingFilterBar.tsx`
* **Features & Test Scenarios:**
  * **Invoices Grid View:** Lists invoices with Invoice Number, Date, Customer Name, Total, Balance Due, Status (PAID, PARTIAL, UNPAID), and Creator Badge (`Cashier` vs `Admin/Owner`).
  * **3-Tier Cascading Filter Bar:**
    * Filter by **City** ➔ automatically limits available **Customer Names** ➔ automatically limits available **Invoice Numbers**.
    * Reset filter button clears all tiers simultaneously.
  * **Invoice Creation Modal:**
    * Allows creating credit or wholesale invoices.
    * Multi-item line addition: Product selector, UOM selector, Quantity, Unit Rate, Line Total.
    * Calculates overall tax, discount, freight charges, and initial payment.
  * **Invoice Detail Modal:**
    * Deep-dive view of line items, payments already applied, and outstanding balance.
  * **Sales Returns (`ProcessReturnModal`):**
    * Allows returning specific quantities of sold items.
    * Restores product stock to inventory.
    * Updates customer balance or issues credit adjustment.

---

## 1.5 Customer Directory, Ledger & Refunds
* **Components:** `CustomersListPage.tsx`, `CustomerFormModal.tsx`, `CustomerLedger.tsx`, `CustomerRefundModal.tsx`
* **Features & Test Scenarios:**
  * **Customer Management:**
    * Add/edit customer profiles: Name, Phone, Address, City, Customer Type (`CASH` vs `CREDIT`), Credit Limit, Opening Balance.
  * **Customer Ledger:**
    * Chronological statement showing Invoices (Debit), Payments (Credit), Returns, and running balance.
  * **Customer Refunds:**
    * Modal to disburse refunds for customer credit balances via Cash or Bank Account.

---

## 1.6 Customer Payments & Incoming PDCs
* **Components:** `PaymentsListPage.tsx`, `PaymentFormModal.tsx`, `PdcLedgerModal.tsx`
* **Features & Test Scenarios:**
  * **Payment Entry:**
    * Record payments against customer balances.
    * Modes: **Cash**, **Bank Transfer**, or **Cheque / PDC**.
    * Allocation: Applies to specific open invoices or general account credit.
  * **Post-Dated Cheques (Incoming PDCs):**
    * Ledger displaying cheque number, bank name, drawer, cheque date, due date, amount, status.
    * Status filters: `PENDING`, `DEPOSITED`, `CLEARED`, `BOUNCED`.

---

## 1.7 Purchases & Supplier Invoices
* **Components:** `PurchasesListPage.tsx`, `PurchaseFormModal.tsx`
* **Features & Test Scenarios:**
  * **Purchases Grid:** View all supplier purchase bills, date, bill number, supplier name, total amount, paid amount, and payment status.
  * **Purchase Invoice Modal:**
    * Supplier selection and purchase invoice number input.
    * Add raw materials / granule / bag items with quantity in KG or Bags, unit cost, and line totals.
    * Adds stock to inventory and triggers backend rolling average cost recalculation.

---

## 1.8 Supplier Payments & Payables (A/P)
* **Components:** `SupplierPaymentsListPage.tsx`, `SupplierPaymentFormModal.tsx`, `SuppliersListPage.tsx`, `SupplierFormModal.tsx`
* **Features & Test Scenarios:**
  * **Supplier Directory:** Manage raw material suppliers, payment terms, contact info, and total payables.
  * **Supplier Payments:**
    * Disburse payments against supplier outstanding balances.
    * Payment source: Cash Register or Bank Account.
    * Tracks cheques issued to suppliers with maturity dates.

---

## 1.9 Inventory, Products & Categories
* **Components:** `ProductsListPage.tsx`, `ProductFormModal.tsx`, `CategoriesPage.tsx`, `CashierStockPage.tsx`
* **Features & Test Scenarios:**
  * **Product Catalog:**
    * Item code/SKU, Product Name, Category dropdown, Base UOM.
    * Standard **Bag Weight (KG)**.
    * **Fixed Retail Price per KG** and **Rolling Average Cost per KG**.
    * Stock level thresholds with badges: In Stock, Low Stock (< threshold), Out of Stock.
  * **Categories & UOM Management:**
    * Create, edit, and delete product categories and units.
  * **Cashier Stock Page (`CashierStockPage.tsx`):**
    * Simplified view for retail cashiers to check current stock without revealing internal purchasing costs.

---

## 1.10 Operating Expenses
* **Components:** `ExpensesListPage.tsx`, `ExpenseFormModal.tsx`
* **Features & Test Scenarios:**
  * **Expense Ledger:** List of all company overheads with date, category, payment source, amount, and notes.
  * **Expense Logging Modal:**
    * Categories: Factory Rent, Electricity, Labor/Salaries, Machinery Maintenance, Tea/Refreshment, Transport, etc.
    * Source selection: Cash in Register vs Bank Account.

---

## 1.11 Financial Reports & Business Intelligence
* **Components:** `FinancialReports.tsx`, `IncomeStatementPage.tsx`, `MarginAnalyticsPage.tsx`, `InventoryValuationPage.tsx`, `LiquidityLedger.tsx`, `CashBookModal.tsx`, `BankAccountsModal.tsx`, `BusinessPerformanceCharts.tsx`
* **Features & Test Scenarios:**
  * **Executive Dashboard (`Dashboard.tsx`):**
    * High-level stat cards: Total Sales, Cash in Register, Receivables (A/R), Payables (A/P), Low stock alert count.
    * Recharts visual trends: Sales trend charts over weekly/monthly intervals.
  * **Income Statement (P&L):**
    * Real-time calculation: Net Sales Revenue − Cost of Goods Sold (COGS) = Gross Profit − Operating Expenses = Net Profit/Loss.
    * Customizable date ranges (Today, This Week, This Month, Custom Date Range).
  * **Margin Analytics:**
    * Sales margin % per product and category.
    * Identifies most and least profitable product lines.
  * **Inventory Valuation:**
    * Computes total inventory value using **Weighted Average Cost (WAC)**.
    * Shows FIFO batches breakdown (Batch date, initial qty, remaining qty, unit cost).
  * **Liquidity & Cash Book Modal:**
    * Cash ledger recording every cash inflow (POS sales, customer cash payments) and cash outflow (expenses, cash purchases, supplier cash payments).
  * **Bank Accounts Modal:**
    * Balances for individual bank accounts.
    * Tracks deposits, withdrawals, and bank-to-bank transfers.

---

## 1.12 Employee / User Management
* **Components:** `UsersListPage.tsx`, `UserFormModal.tsx`
* **Features & Test Scenarios:**
  * List all users with status (Active / Inactive) and roles (`OWNER`, `ADMIN`, `CASHIER`, `MANAGER`).
  * Add user with username, full name, email, phone, role, and password.
  * Edit user details and deactivate accounts.

---
---

# PART 2: BACKEND FEATURES SPECIFICATION

## 2.1 Server Architecture & Global Middleware
* **Files:** `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/middleware/errorHandler.ts`
* **Features & Test Scenarios:**
  * **Security Headers:** Helmet enabled for HTTP header hardening.
  * **CORS:** Configured for frontend origins.
  * **Anti-Cache Headers:** Custom middleware sets `Cache-Control: no-store, no-cache, must-revalidate` and disables ETag to prevent stale JSON API responses on ERP transactions.
  * **Structured Logging:** Pino-HTTP logger for request/response tracing.
  * **Standardized JSON Envelope:** All responses follow unified structure: `{ success: true, data: ... }` or `{ success: false, message: ..., errors: ... }`.
  * **Global Error Handler:** Catches unhandled exceptions, Zod validation errors, PostgreSQL errors, and returns appropriate HTTP status codes (400, 401, 403, 404, 409, 500).

---

## 2.2 Authentication & RBAC Module (`/api/v1/auth`)
* **Endpoints:**
  * `POST /api/v1/auth/login`: Authenticates credentials, generates JWT access token and cryptographically secure refresh token.
  * `POST /api/v1/auth/refresh`: Validates refresh token from DB/cache and issues a fresh access token.
  * `POST /api/v1/auth/logout`: Revokes refresh token.
  * `GET /api/v1/auth/me`: Returns currently authenticated user details, role, and permissions array.
* **Middleware:**
  * `authenticateJWT`: Validates `Authorization: Bearer <token>` in header.
  * `requireRole([...])`: Enforces role-based permissions at endpoint level.

---

## 2.3 POS Backend Engine (`/api/v1/pos`)
* **Endpoints:**
  * `POST /api/v1/pos/checkout`: Atomic transaction handling POS retail sale.
    * Validates stock availability for each item.
    * Deducts stock in KG from warehouse inventory.
    * Computes subtotal, discounts, and total.
    * Records sales invoice marked as `PAID`.
    * Creates a corresponding `payment` record for the cash register.
    * If stock is insufficient, triggers atomic rollback with 400 Bad Request.
  * `GET /api/v1/pos/today-tally`: Returns total cash sales and total cash collected today.
  * `POST /api/v1/pos/shift-audit`: Submits shift closing figures, logs variance between counted cash and recorded cash.

---

## 2.4 Invoices & Sales Module (`/api/v1/invoices`, `/api/v1/sales`)
* **Endpoints:**
  * `GET /api/v1/invoices`: Returns paginated invoices with customer details, creator role, balances, and filter parameters.
  * `GET /api/v1/invoices/:id`: Detailed invoice view with itemized products, weights, rates, and payment allocations.
  * `POST /api/v1/invoices`: Generates new wholesale/credit sales invoice:
    * Validates customer credit limit if invoice is on credit.
    * Calculates line totals and invoice totals.
    * Deducts inventory stock for each line item within a database transaction.
    * Updates customer ledger balance.
  * `POST /api/v1/invoices/:id/return`: Processes full or partial sales return:
    * Validates returned quantity does not exceed original invoice sold quantity.
    * Increments product inventory stock by returned quantity.
    * Adjusts invoice total or generates credit balance on customer account.

---

## 2.5 Purchases & Rolling Average Cost Engine (`/api/v1/purchases`)
* **Endpoints:**
  * `GET /api/v1/purchases`: Lists all purchase bills from suppliers with payment status.
  * `GET /api/v1/purchases/:id`: Retrieves purchase bill details and line items.
  * `POST /api/v1/purchases`: Records supplier purchase invoice:
    * **Weighted Average Cost (WAC) Algorithm:**
      $$\text{New Average Cost} = \frac{(\text{Current Stock} \times \text{Current WAC}) + (\text{New Qty} \times \text{Purchase Price})}{\text{Current Stock} + \text{New Qty}}$$
    * Updates product's `rolling_avg_cost_per_kg`.
    * Increments warehouse stock quantity.
    * Appends purchase amount to supplier's payable ledger balance.
    * Creates FIFO batch record for valuation tracking.

---

## 2.6 Customer Payments & Allocations (`/api/v1/payments`)
* **Endpoints:**
  * `GET /api/v1/payments`: Fetches customer payment receipts.
  * `POST /api/v1/payments`: Records payment from customer:
    * Updates customer ledger (Credit).
    * Handles payment methods:
      * **Cash**: Directly increments cash in hand / register.
      * **Bank Transfer**: Increments selected bank account balance.
      * **Cheque / PDC**: Creates an incoming PDC record with status `PENDING`.
    * Allocates amount across outstanding invoices (FIFO or explicit invoice IDs) and updates invoice payment status (`PAID`, `PARTIAL`, `UNPAID`).

---

## 2.7 Incoming Post-Dated Cheques (`/api/v1/incoming-pdcs`)
* **Endpoints:**
  * `GET /api/v1/incoming-pdcs`: Lists received PDCs with status filters (`PENDING`, `DEPOSITED`, `CLEARED`, `BOUNCED`).
  * `PATCH /api/v1/incoming-pdcs/:id/status`: Transitions cheque lifecycle:
    * Transition to `CLEARED`: Credits target bank account and finalizes customer ledger clearance.
    * Transition to `BOUNCED`: Reverses provisional credit, creates penalty charge if applicable, and restores customer outstanding balance.

---

## 2.8 Supplier Payments & Payables (`/api/v1/supplier-payments`)
* **Endpoints:**
  * `GET /api/v1/supplier-payments`: Lists disbursement records to suppliers.
  * `POST /api/v1/supplier-payments`: Processes supplier bill payment:
    * Deducts cash from register or specified bank account.
    * Decrements supplier's accounts payable balance.
    * Updates status of associated purchase bills.

---

## 2.9 Customer Refunds (`/api/v1/customer-refunds`)
* **Endpoints:**
  * `GET /api/v1/customer-refunds`: Lists all customer refund transactions.
  * `POST /api/v1/customer-refunds`: Disburses refund to customer:
    * Validates customer has sufficient positive credit balance.
    * Deducts amount from cash drawer or bank account.
    * Updates customer ledger balance.

---

## 2.10 Products, Inventory & Categories (`/api/v1/products`, `/api/v1/categories`)
* **Endpoints:**
  * `GET /api/v1/products`: List products with search, pagination, category filter, stock status, and pricing.
  * `GET /api/v1/products/pos-available`: High-performance query returning products with positive stock for POS terminals.
  * `POST /api/v1/products`: Create new product (SKU, name, category, bag weight, retail price per KG, rolling cost).
  * `PUT /api/v1/products/:id`: Update product master data.
  * `DELETE /api/v1/products/:id`: Soft delete or delete product if no transaction history exists.
  * `GET /api/v1/categories`: List product categories.
  * `POST /api/v1/categories`: Create category.

---

## 2.11 Operating Expenses Module (`/api/v1/expenses`)
* **Endpoints:**
  * `GET /api/v1/expenses`: Filter expenses by date range, category, and payment source.
  * `POST /api/v1/expenses`: Record an operating expense:
    * Source `CASH`: Deducts from daily cash register.
    * Source `BANK`: Deducts from bank account balance.
    * Logs category, amount, recipient, remarks, and expense date.

---

## 2.12 Bank Accounts Module (`/api/v1/bank-accounts`)
* **Endpoints:**
  * `GET /api/v1/bank-accounts`: List all bank accounts with current balances.
  * `POST /api/v1/bank-accounts`: Register new bank account (Bank Name, Account Number, Title, Opening Balance).
  * `POST /api/v1/bank-accounts/transfer`: Internal fund transfer between two bank accounts with audit log.
  * `GET /api/v1/bank-accounts/:id/ledger`: Transaction history for specific bank account.

---

## 2.13 Reports & Financial Analytics (`/api/v1/reports`)
* **Endpoints:**
  * `GET /api/v1/reports/dashboard-metrics`: Aggregated numbers for Dashboard (Today Sales, Cash in Register, AR, AP, Low stock count).
  * `GET /api/v1/reports/income-statement`:
    * Evaluates Gross Sales, Returns, Net Sales.
    * Evaluates COGS using rolling average costs.
    * Evaluates Operating Expenses.
    * Computes Net Profit / Loss for requested date range.
  * `GET /api/v1/reports/margin-analytics`: Computes profit margin percentages across products and product categories.
  * `GET /api/v1/reports/inventory-valuation`: Calculates total warehouse asset valuation using WAC and lists FIFO batch valuation.
  * `GET /api/v1/reports/liquidity-ledger`: Aggregates cash in / cash out streams across the entire organization.

---

## 2.14 User Management & System Health (`/api/v1/users`, `/api/v1/health`)
* **Endpoints:**
  * `GET /api/v1/users`: Retrieve users list with role assignments.
  * `POST /api/v1/users`: Create user account with hashed password (bcrypt).
  * `PUT /api/v1/users/:id`: Update role, permissions, status (Active/Inactive).
  * `GET /api/v1/health`: System health check (database connection check, uptime, memory usage).

---
---

# PART 3: QA TEST SCENARIOS MATRIX (FOR TEST CASE WRITING)

| Test ID | Module | Area | Scenario Description | Expected Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **TC-AUTH-01** | Frontend/Backend | Auth | Valid login with correct credentials | JWT tokens stored in localStorage, redirect to dashboard or POS based on role |
| **TC-AUTH-02** | Frontend/Backend | Auth | Login with incorrect password | 401 Unauthorized, Sonner toast displaying error, no tokens stored |
| **TC-AUTH-03** | Frontend/Backend | Auth | Cashier role navigation test | Cashier redirected away from `/dashboard` and `/reports` directly to `/pos` |
| **TC-AUTH-04** | Frontend/Backend | Auth | Expired access token with valid refresh token | Response interceptor catches 401, calls `/refresh`, replays request seamlessly |
| **TC-POS-01** | Frontend | POS | Product search debouncing | Search query fires after 300ms pause, filters active product list |
| **TC-POS-02** | Frontend/Backend | POS | Selling out-of-stock product (0 KG) | UI disables or warns; backend rejects with 400 Bad Request |
| **TC-POS-03** | Frontend | POS | Unit conversion (Bag to KG) | Entering 2 Bags with bag weight 25 KG calculates 50 KG total and correct line price |
| **TC-POS-04** | Frontend | POS | Percentage discount calculation | 10% discount on 10,000 PKR calculates 1,000 PKR discount and 9,000 PKR net total |
| **TC-POS-05** | Frontend/Backend | POS | Walk-in checkout completion | Inventory deducted by sold KG, invoice created as PAID, cash tally updated |
| **TC-INV-01** | Frontend | Invoices | 3-tier cascading filter | Selecting City narrows Customer list; selecting Customer narrows Invoices list |
| **TC-INV-02** | Frontend/Backend | Invoices | Partial sales return | Returned quantity restored to warehouse stock; customer balance reduced |
| **TC-PUR-01** | Backend | Purchases | Weighted Average Cost (WAC) recalculation | New purchase at different rate updates product's `rolling_avg_cost_per_kg` accurately |
| **TC-PAY-01** | Frontend/Backend | Payments | Cheque / PDC payment entry | Status saved as `PENDING`; bank balance not touched until cheque is marked `CLEARED` |
| **TC-EXP-01** | Frontend/Backend | Expenses | Register petty cash expense | Deducts immediately from Cash in Register and appears in Cash Book outflow |
| **TC-REP-01** | Backend | Reports | Income statement accuracy | $\text{Net Profit} = (\text{Sales} - \text{Returns}) - \text{COGS} - \text{Expenses}$ matches ledger entries |
| **TC-REF-01** | Backend | Customer Refunds | Refund exceeding credit balance | Backend rejects transaction with 400 when refund > available credit |
