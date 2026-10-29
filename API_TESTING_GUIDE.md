# Sabir Plastic ERP — API Testing & Reference Guide

Yeh file Sabir Plastic ERP ki tamam backend APIs ki complete documentation hai. Is me har API ka HTTP method, URL endpoint, headers, request body sample, query parameters, aur expected JSON response likha hua hai taa ke aap **Postman**, **Thunder Client**, **Insomnia**, ya **cURL** ke zariye asani se test kar saken.

---

## 📌 1. General Setup & Quick Start

- **Base URL:** `http://localhost:3001/api/v1` *(Legacy/short alias `http://localhost:3001/api` bhi chalte hain)*
- **Content-Type:** `application/json`
- **Default Port:** `3001`
- **Authorization Header:** `Authorization: Bearer <ACCESS_TOKEN>`

### Default Seed Credentials (For Testing)
| Role | Email | Password | Allowed Access |
| :--- | :--- | :--- | :--- |
| **Owner / Admin** | `owner@sabir.local` | `Admin@1234` | Full System Access, Financials, Reports |
| **Cashier** | `cashier@sabirplastic.local` | `Cashier@123` | POS, Invoices, View Customers/Products |

---

## 📦 Standard API Response Envelopes

Backend standard response wrapper follow karta hai:

### Success Response Envelope (`HTTP 200 / 201`)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3
  }
}
```

### Error Response Envelope (`HTTP 400 / 401 / 403 / 404 / 500`)
```json
{
  "success": false,
  "error": "Error description message",
  "message": "Error description message",
  "details": {
    "field_name": ["Specific validation error"]
  }
}
```

---

## 📑 Index of Modules
1. [Health & Diagnostics](#1-health--diagnostics)
2. [Authentication (`/auth`)](#2-authentication-apiauth)
3. [User & Employee Access Management (`/users`)](#3-users--roles-apiusers)
4. [Customers & CRM (`/customers`)](#4-customers-apicustomers)
5. [Suppliers & Vendors (`/suppliers`)](#5-suppliers-apisuppliers)
6. [Categories (`/categories`)](#6-categories-apicategories)
7. [Products & Catalog (`/products`)](#7-products-apiproducts)
8. [Inventory (`/inventory`)](#8-inventory-apiinventory)
9. [Sales Invoices & Returns (`/invoices` or `/sales`)](#9-sales-invoices--returns-apiinvoices)
10. [Purchases & Purchase Returns (`/purchases`)](#10-purchases--returns-apipurchases)
11. [Customer Payments & Cheque Clearing (`/payments`)](#11-customer-payments-apipayments)
12. [Supplier Payments & Cheques (`/supplier-payments`)](#12-supplier-payments-apisupplier-payments)
13. [Advances (`/advances`)](#13-advances-apiadvances)
14. [Refunds (`/refunds` & `/customer-refunds`)](#14-refunds-apirefunds--apicustomer-refunds)
15. [Expenses (`/expenses`)](#15-expenses-apiexpenses)
16. [Point of Sale (POS) (`/pos`)](#16-pos-point-of-sale-apipos)
17. [Bank Accounts & Cash Drawer (`/bank-accounts`)](#17-bank-accounts--treasury-apibank-accounts)
18. [Incoming Post-Dated Cheques (`/incoming-pdcs`)](#18-incoming-pdcs-apiincoming-pdcs)
19. [Employees & Payroll Ledger (`/employees`)](#19-employees--payroll-apiemployees)
20. [Product Exchanges (`/exchanges`)](#20-product-exchanges-apiexchanges)
21. [Reports & Business Intelligence (`/reports`)](#21-reports--bi-apireports)
22. [Onboarding & Bulk Migration (`/onboarding`)](#22-onboarding--bulk-import-apionboarding)
23. [Developer Tools (`/dev`)](#23-developer-tools-apidev)

---

## 1. Health & Diagnostics

### `GET /api/v1/health`
- **Auth:** Public
- **Description:** Server status aur PostgreSQL database connectivity check karta hai.
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": {
    "service": "Sabir Plastic ERP API",
    "version": "0.1.0",
    "status": "healthy",
    "db": "ok",
    "timestamp": "2026-10-28T15:20:00.000Z"
  }
}
```

---

## 2. Authentication (`/api/v1/auth`)

### `POST /api/v1/auth/login`
- **Auth:** Public
- **Description:** User login karta hai aur JWT Access Token + Refresh Token deta hai.
- **Request Body:**
```json
{
  "email": "owner@sabir.local",
  "password": "Admin@1234"
}
```
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "def50200...",
    "user": {
      "id": "c1f7b093-9c8e-4a65-8b89-10657999dd74",
      "name": "Owner",
      "email": "owner@sabir.local",
      "role": "Owner",
      "permissions": ["*"]
    }
  }
}
```

### `POST /api/v1/auth/refresh`
- **Auth:** Public
- **Description:** Expired access token ko new access token se exchange karta hai.
- **Request Body:**
```json
{
  "refresh_token": "<YOUR_REFRESH_TOKEN>"
}
```
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "def50200..."
  }
}
```

### `POST /api/v1/auth/logout`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "refresh_token": "<YOUR_REFRESH_TOKEN>"
}
```
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

### `GET /api/v1/auth/me`
- **Auth:** Bearer Token
- **Description:** Logged in user ka profile, current role aur permissions fetch karta hai.
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "c1f7b093-9c8e-4a65-8b89-10657999dd74",
    "name": "Owner",
    "email": "owner@sabir.local",
    "role": "Owner",
    "permissions": ["*"]
  }
}
```

---

## 3. Users & Roles (`/api/v1/users`)

### `GET /api/v1/users/roles`
- **Auth:** Bearer Token (Permission: `users:read`)
- **Description:** System me mojood available roles (Owner, Admin, Cashier, Accountant wagera) fetch karta hai.
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": [
    { "id": "11111111-1111-1111-1111-111111111111", "name": "Owner", "description": "Full access" },
    { "id": "22222222-2222-2222-2222-222222222222", "name": "Admin", "description": "Administrative access" },
    { "id": "33333333-3333-3333-3333-333333333333", "name": "Cashier", "description": "POS and Sales counter" }
  ]
}
```

### `GET /api/v1/users`
- **Auth:** Bearer Token (Permission: `users:read`)
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "c1f7b093-9c8e-4a65-8b89-10657999dd74",
      "name": "Owner",
      "email": "owner@sabir.local",
      "role": "Owner",
      "job_title": "Store Owner",
      "pay_frequency": "MONTHLY",
      "base_salary": 0,
      "is_active": true
    }
  ]
}
```

### `GET /api/v1/users/:id`
- **Auth:** Bearer Token (Permission: `users:read`)
- **Expected Status:** `200 OK`

### `POST /api/v1/users`
- **Auth:** Bearer Token (Permission: `users:write`)
- **Request Body (Login Access wala User):**
```json
{
  "name": "Bilal Ahmed",
  "grant_access": true,
  "email": "bilal@sabirplastic.local",
  "password": "Password@123",
  "role_id": "33333333-3333-3333-3333-333333333333",
  "job_title": "Counter Salesman",
  "pay_frequency": "MONTHLY",
  "base_salary": 35000,
  "is_active": true
}
```
- **Expected Status:** `201 Created`

### `PUT /api/v1/users/:id`
- **Auth:** Bearer Token (Permission: `users:write`)
- **Request Body:** Partial update fields (e.g. `name`, `base_salary`, `is_active`).
- **Expected Status:** `200 OK`

### `DELETE /api/v1/users/:id`
- **Auth:** Bearer Token (Permission: `users:delete`)
- **Expected Status:** `200 OK`

---

## 4. Customers (`/api/v1/customers`)

### `GET /api/v1/customers`
- **Auth:** Bearer Token
- **Query Parameters:**
  - `page`: default `1`
  - `limit`: default `20`
  - `search`: search name/phone
  - `city`: filter by city
  - `customer_type`: `CASH` ya `CREDIT`
  - `is_active`: `true` ya `false`
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000001",
      "name": "Walk-in Customer",
      "customer_type": "CASH",
      "phone": null,
      "current_balance": 0,
      "advance_balance": 0,
      "credit_limit": 0,
      "is_active": true
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### `GET /api/v1/customers/:id`
- **Auth:** Bearer Token
- **Expected Status:** `200 OK`

### `POST /api/v1/customers`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`)
- **Request Body:**
```json
{
  "name": "Al-Rehman Traders",
  "phone": "03001234567",
  "email": "alrehman@gmail.com",
  "address": "Shop # 12, Plastic Market",
  "city": "Lahore",
  "region": "Punjab",
  "customer_type": "CREDIT",
  "credit_limit": 500000,
  "opening_balance": 15000,
  "opening_advance": 0,
  "notes": "Regular credit buyer"
}
```
- **Expected Status:** `201 Created`

### `PUT /api/v1/customers/:id`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`)
- **Request Body:** Partial update (e.g. `phone`, `credit_limit`, `is_active`, `notes`).
- **Expected Status:** `200 OK`

### `DELETE /api/v1/customers/:id`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`)
- **Expected Status:** `200 OK`

### `GET /api/v1/customers/:id/statement`
- **Auth:** Bearer Token
- **Query Params:** `startDate=YYYY-MM-DD`, `endDate=YYYY-MM-DD`
- **Expected Status:** `200 OK` (Customer balance summary + ledger transactions list)

### `GET /api/v1/customers/:id/ledger`
- **Auth:** Bearer Token
- **Expected Status:** `200 OK`

### `GET /api/v1/customers/:id/refundable-credits`
- **Auth:** Bearer Token
- **Description:** Customer ka unused advance balance aur overpayments return karne ke liye fetch karta hai.
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": {
    "total_refundable": 5000,
    "advances": [],
    "overpaid_invoices": []
  }
}
```

---

## 5. Suppliers (`/api/v1/suppliers`)

### `GET /api/v1/suppliers`
- **Auth:** Bearer Token
- **Query Parameters:** `page`, `limit`, `search`, `city`, `region`, `is_active`
- **Expected Status:** `200 OK`

### `POST /api/v1/suppliers`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`)
- **Request Body:**
```json
{
  "name": "Pak Polymer Corporation",
  "phone": "03219876543",
  "email": "sales@pakpolymer.com",
  "address": "Sundar Industrial Estate",
  "city": "Lahore",
  "region": "Punjab",
  "payment_terms": 15,
  "opening_payable": 120000,
  "opening_advance": 0,
  "notes": "Primary supplier for PP granules"
}
```
- **Expected Status:** `201 Created`

### `GET /api/v1/suppliers/:id`
- **Auth:** Bearer Token
- **Expected Status:** `200 OK`

### `PUT /api/v1/suppliers/:id`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`)
- **Expected Status:** `200 OK`

### `DELETE /api/v1/suppliers/:id`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`)
- **Expected Status:** `200 OK`

### `GET /api/v1/suppliers/:id/statement` & `GET /api/v1/suppliers/:id/ledger`
- **Auth:** Bearer Token
- **Expected Status:** `200 OK`

### `GET /api/v1/suppliers/:id/refundable-credits`
- **Auth:** Bearer Token
- **Expected Status:** `200 OK`

### `POST /api/v1/suppliers/payments` (or `/api/v1/suppliers/:id/payments`)
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`)
- **Request Body:** Check section 12 [Supplier Payments](#12-supplier-payments-apisupplier-payments).

---

## 6. Categories (`/api/v1/categories`)

### `GET /api/v1/categories`
- **Auth:** Bearer Token
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "a9b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "name": "Polypropylene (PP)",
      "bag_weight_kg": 25.0,
      "description": "Standard 25kg PP bags"
    }
  ]
}
```

### `POST /api/v1/categories`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`)
- **Request Body:**
```json
{
  "name": "High Density Polyethylene (HDPE)",
  "bag_weight_kg": 25.0,
  "description": "HDPE Blow moulding grade"
}
```
- **Expected Status:** `201 Created`

### `PUT /api/v1/categories/:id`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`)
- **Expected Status:** `200 OK`

### `DELETE /api/v1/categories/:id`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`)
- **Expected Status:** `200 OK`

---

## 7. Products (`/api/v1/products`)

### `GET /api/v1/products`
- **Auth:** Bearer Token
- **Query Params:** `page`, `limit`, `search`, `category_id`, `is_active`
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b",
      "code": "PP-FILM-01",
      "name": "PP Film Grade Granule",
      "name_urdu": "پی پی دانہ",
      "size": "25kg Bag",
      "category_id": "a9b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      "cost_price": 380.0,
      "sale_price": 420.0,
      "stock_quantity": 1500,
      "stock_quantity_kg": 1500.0,
      "low_stock_threshold": 250,
      "is_active": true
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### `GET /api/v1/products/pos-available`
- **Auth:** Bearer Token
- **Description:** Sirf active products jin ka stock available hai POS counter ke liye laata hai.
- **Expected Status:** `200 OK`

### `GET /api/v1/products/:id`
- **Auth:** Bearer Token
- **Expected Status:** `200 OK`

### `GET /api/v1/products/:id/batches`
- **Auth:** Bearer Token
- **Description:** Product ke specific FIFO/Weighted purchase batches aur current remaining stock dikhata hai.
- **Expected Status:** `200 OK`

### `POST /api/v1/products`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`)
- **Request Body:**
```json
{
  "code": "HDPE-5502",
  "name": "HDPE 5502 Pipe Grade",
  "name_urdu": "ایچ ڈی پی ای دانہ",
  "size": "25kg Bag",
  "category_id": "a9b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "cost_price": 395.0,
  "sale_price": 440.0,
  "fixed_retail_price_per_kg": 440.0,
  "opening_stock": 20,
  "opening_stock_kg": 500,
  "low_stock_threshold": 100,
  "notes": "Fresh lot"
}
```
- **Expected Status:** `201 Created`

### `PUT /api/v1/products/:id`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`)
- **Request Body:** Partial update fields (e.g. `sale_price`, `cost_price`, `name`, `low_stock_threshold`, `is_active`).
- **Expected Status:** `200 OK`

### `DELETE /api/v1/products/:id`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`)
- **Expected Status:** `200 OK`

---

## 8. Inventory (`/api/v1/inventory`)

### `GET /api/v1/inventory/low-stock`
- **Auth:** Bearer Token
- **Description:** Jin products ka stock low stock threshold se kam hai unki list return karta hai.
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b",
      "name": "PP Film Grade Granule",
      "current_stock_kg": 75.0,
      "low_stock_threshold": 250.0,
      "category_name": "Polypropylene (PP)"
    }
  ]
}
```

---

## 9. Sales Invoices & Returns (`/api/v1/invoices` ya `/api/v1/sales`)

### `GET /api/v1/invoices`
- **Auth:** Bearer Token (Permission: `sales:read`)
- **Query Params:** `page`, `limit`, `search`, `customer_id`, `status` (`PAID`, `UNPAID`, `PARTIAL`), `startDate`, `endDate`
- **Expected Status:** `200 OK`

### `GET /api/v1/invoices/unpaid`
- **Auth:** Bearer Token (Permission: `sales:read`)
- **Description:** Tamam pending / udhaar wali invoices fetch karta hai.
- **Expected Status:** `200 OK`

### `GET /api/v1/invoices/pending-deliveries`
- **Auth:** Bearer Token (Permission: `sales:read`)
- **Expected Status:** `200 OK`

### `GET /api/v1/invoices/:id`
- **Auth:** Bearer Token (Permission: `sales:read`)
- **Expected Status:** `200 OK`

### `POST /api/v1/invoices`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`, Permission: `sales:write`)
- **Request Body:**
```json
{
  "customer_id": "00000000-0000-0000-0000-000000000001",
  "date": "2026-10-28T12:00:00.000Z",
  "due_date": "2026-11-15T12:00:00.000Z",
  "discount": 500,
  "delivery_charge": 1000,
  "advance_applied_amount": 0,
  "notes": "Counter sale invoice",
  "items": [
    {
      "product_id": "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b",
      "quantity": 50,
      "selected_unit": "KG",
      "unit_price": 420.0,
      "actual_weight_per_unit": 50.0
    }
  ]
}
```
- **Expected Status:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "invoice_number": "INV-202610-0001",
    "customer_id": "00000000-0000-0000-0000-000000000001",
    "subtotal": 21000,
    "discount": 500,
    "delivery_charge": 1000,
    "total_amount": 21500,
    "paid_amount": 0,
    "status": "UNPAID"
  }
}
```

### `GET /api/v1/invoices/:id/returns/summary`
- **Auth:** Bearer Token (Permission: `sales:read`)
- **Description:** Is invoice se ab tak kitne items return ho chuke hain aur kitne returnable hain.
- **Expected Status:** `200 OK`

### `POST /api/v1/invoices/:id/returns`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`, Permission: `sales:write`)
- **Request Body:**
```json
{
  "return_reason": "Damaged packing / customer returned",
  "items": [
    {
      "product_id": "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b",
      "return_quantity": 5
    }
  ]
}
```
- **Expected Status:** `200 OK`

---

## 10. Purchases & Returns (`/api/v1/purchases`)

### `GET /api/v1/purchases`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`)
- **Expected Status:** `200 OK`

### `GET /api/v1/purchases/unpaid`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`)
- **Expected Status:** `200 OK`

### `GET /api/v1/purchases/:id`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`)
- **Expected Status:** `200 OK`

### `POST /api/v1/purchases`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`)
- **Request Body:**
```json
{
  "supplier_id": "b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e",
  "date": "2026-10-28T10:00:00.000Z",
  "due_date": "2026-11-12T10:00:00.000Z",
  "discount": 1000,
  "advance_applied_amount": 0,
  "notes": "Direct truck delivery from factory",
  "items": [
    {
      "product_id": "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b",
      "quantity": 100,
      "quantity_kg": 2500,
      "selected_unit": "BAG",
      "price_per_kg": 375.0,
      "actual_kanta_wt": 2498.5
    }
  ]
}
```
- **Expected Status:** `201 Created`

### `PATCH /api/v1/purchases/:id/status`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`)
- **Request Body:**
```json
{
  "status": "PAID",
  "paid_amount": 935000
}
```
- **Expected Status:** `200 OK`

### `GET /api/v1/purchases/:id/returns/summary`
- **Auth:** Bearer Token
- **Expected Status:** `200 OK`

### `POST /api/v1/purchases/:id/returns` (ya `POST /api/v1/purchases/returns` / `/api/v1/purchase-returns`)
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`)
- **Request Body:**
```json
{
  "parent_invoice_id": "<PURCHASE_INVOICE_UUID>",
  "return_reason": "Low melt index grade",
  "items": [
    {
      "product_id": "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b",
      "return_quantity": 250
    }
  ]
}
```
- **Expected Status:** `200 OK`

---

## 11. Customer Payments (`/api/v1/payments`)

### `GET /api/v1/payments`
- **Auth:** Bearer Token (Permission: `customers:read`)
- **Expected Status:** `200 OK`

### `POST /api/v1/payments`
- **Auth:** Bearer Token (Role: Not Cashier, Permission: `customers:write`)
- **Request Body Examples:**

#### Option A: Direct Cash Payment against Invoice
```json
{
  "customer_id": "<CUSTOMER_UUID>",
  "invoice_id": "<INVOICE_UUID>",
  "payment_date": "2026-10-28T14:00:00.000Z",
  "amount": 20000,
  "payment_method": "CASH",
  "notes": "Cash collected at counter"
}
```

#### Option B: Bank Transfer with Bank Account
```json
{
  "customer_id": "<CUSTOMER_UUID>",
  "payment_date": "2026-10-28T14:00:00.000Z",
  "amount": 50000,
  "payment_method": "BANK_TRANSFER",
  "bank_account_id": "<BANK_ACCOUNT_UUID>",
  "notes": "Online IBFT received"
}
```

#### Option C: Post-Dated Cheque (PDC)
```json
{
  "customer_id": "<CUSTOMER_UUID>",
  "payment_date": "2026-10-28T14:00:00.000Z",
  "amount": 100000,
  "payment_method": "PDC",
  "cheque_number": "CHQ-89721",
  "cheque_bank_name": "Meezan Bank",
  "cheque_due_date": "2026-11-20",
  "cheque_status": "PENDING"
}
```

#### Option D: Split Payment (Cash + Bank)
```json
{
  "customer_id": "<CUSTOMER_UUID>",
  "payment_date": "2026-10-28T14:00:00.000Z",
  "amount": 60000,
  "payment_method": "SPLIT",
  "split_cash_amount": 20000,
  "split_bank_amount": 40000,
  "bank_account_id": "<BANK_ACCOUNT_UUID>"
}
```

#### Option E: Direct To Supplier (Third-party routing)
```json
{
  "customer_id": "<CUSTOMER_UUID>",
  "supplier_id": "<SUPPLIER_UUID>",
  "payment_date": "2026-10-28T14:00:00.000Z",
  "amount": 85000,
  "payment_method": "DIRECT_TO_SUPPLIER",
  "notes": "Customer directly paid supplier on our behalf"
}
```
- **Expected Status:** `201 Created`

### `PUT /api/v1/payments/:id/clear-cheque`
- **Auth:** Bearer Token (Permission: `customers:write`)
- **Description:** Cheque clear karta hai aur accounts me balance update karta hai.
- **Expected Status:** `200 OK`

---

## 12. Supplier Payments (`/api/v1/supplier-payments`)

### `GET /api/v1/supplier-payments`
- **Auth:** Bearer Token (Permission: `payments:read`)
- **Query Params:** `page`, `limit`, `supplier_id`, `purchase_invoice_id`
- **Expected Status:** `200 OK`

### `GET /api/v1/supplier-payments/:id`
- **Auth:** Bearer Token (Permission: `payments:read`)
- **Expected Status:** `200 OK`

### `POST /api/v1/supplier-payments` (also `/api/v1/suppliers/payments`)
- **Auth:** Bearer Token (Role: Not Cashier, Permission: `payments:write`)
- **Request Body:**
```json
{
  "supplier_id": "<SUPPLIER_UUID>",
  "purchase_invoice_id": "<OPTIONAL_PURCHASE_INVOICE_UUID>",
  "payment_date": "2026-10-28T16:00:00.000Z",
  "amount": 75000,
  "payment_method": "BANK_TRANSFER",
  "bank_account_id": "<BANK_ACCOUNT_UUID>",
  "notes": "Payment for bulk raw material delivery"
}
```
- **Expected Status:** `201 Created`

### `PUT /api/v1/supplier-payments/:id/clear-cheque`
- **Auth:** Bearer Token (Permission: `payments:write`)
- **Expected Status:** `200 OK`

---

## 13. Advances (`/api/v1/advances`)

Advance tab use hota hai jab koi customer advance payment de ya supplier ko advance cash/bank transfer diya jaye:

### `POST /api/v1/advances/customer`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "customer_id": "<CUSTOMER_UUID>",
  "amount": 30000,
  "source": "CASH_DRAWER",
  "notes": "Booking advance for future orders",
  "payment_date": "2026-10-28"
}
```
*(Note: `source` can be `'CASH_DRAWER'` or Bank Account UUID)*
- **Expected Status:** `201 Created`

### `POST /api/v1/advances/supplier`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "supplier_id": "<SUPPLIER_UUID>",
  "amount": 50000,
  "source": "<BANK_ACCOUNT_UUID>",
  "notes": "Token advance sent via IBFT",
  "payment_date": "2026-10-28"
}
```
- **Expected Status:** `201 Created`

### `POST /api/v1/advances` (General Entity Router)
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "entity_type": "CUSTOMER",
  "customer_id": "<CUSTOMER_UUID>",
  "amount": 10000,
  "source": "CASH_DRAWER"
}
```
- **Expected Status:** `201 Created`

---

## 14. Refunds (`/api/v1/refunds` & `/api/v1/customer-refunds`)

Agar customer ka advance wapis karna ho ya overpayment refund karni ho:

### `POST /api/v1/refunds/customer` (or `POST /api/v1/customer-refunds`)
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "customer_id": "<CUSTOMER_UUID>",
  "amount": 5000,
  "source": "CASH_DRAWER",
  "notes": "Refunded advance money to customer",
  "refund_date": "2026-10-28"
}
```
- **Expected Status:** `200 OK`

### `POST /api/v1/refunds/supplier`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "supplier_id": "<SUPPLIER_UUID>",
  "amount": 12000,
  "source": "CASH_DRAWER",
  "notes": "Supplier refunded overpayment"
}
```
- **Expected Status:** `200 OK`

---

## 15. Expenses (`/api/v1/expenses`)

### `GET /api/v1/expenses`
- **Auth:** Bearer Token
- **Query Params:** `startDate`, `endDate`, `category`, `payment_method`, `bank_account_id`
- **Expected Status:** `200 OK`

### `POST /api/v1/expenses`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "amount": 4500,
  "category": "Utilities",
  "description": "Electricity meter bill payment",
  "payment_method": "CASH",
  "expense_date": "2026-10-28"
}
```
*(Valid Categories: `Salaries`, `Utilities`, `Logistics`, `Petty Cash`, `Tea & Refreshments`, `Maintenance`, `Rent`, `Other`)*
- **Expected Status:** `201 Created`

### `DELETE /api/v1/expenses/:id`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`)
- **Expected Status:** `200 OK`

---

## 16. POS (Point of Sale) (`/api/v1/pos`)

### `POST /api/v1/pos/checkout` (or `POST /api/v1/pos`)
- **Auth:** Bearer Token (Permission: `sales:write`)
- **Request Body:**
```json
{
  "customer_id": "00000000-0000-0000-0000-000000000001",
  "items": [
    {
      "product_id": "e4f5a6b7-c8d9-0e1f-2a3b-4c5d6e7f8a9b",
      "quantity": 25,
      "selected_unit": "KG",
      "unit_price": 420.0
    }
  ],
  "discount": 200,
  "amount_paid": 10300,
  "payment_method": "CASH"
}
```
- **Expected Status:** `200 OK` or `201 Created`
```json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "...",
      "invoice_number": "POS-202610-0002",
      "total_amount": 10300,
      "paid_amount": 10300,
      "status": "PAID"
    }
  }
}
```

### `GET /api/v1/pos/today-tally`
- **Auth:** Bearer Token (Permission: `sales:read`)
- **Description:** Aaj ka POS cash drawer status, sales count, aur collected total batata hai.
- **Expected Status:** `200 OK`

### `GET /api/v1/pos/shift-audit`
- **Auth:** Bearer Token (Permission: `sales:read`)
- **Description:** Current cashier ki shift audit report.
- **Expected Status:** `200 OK`

### `GET /api/v1/pos/invoices`
- **Auth:** Bearer Token (Permission: `sales:read`)
- **Expected Status:** `200 OK`

### Held Orders (Counter park feature):
- `GET /api/v1/pos/held-orders` -> List all held orders
- `POST /api/v1/pos/held-orders` -> Save order on hold
```json
{
  "reference_note": "Customer gone to ATM",
  "customer_id": null,
  "items": [{ "product_id": "...", "quantity": 10, "unit_price": 400 }],
  "total_amount": 4000,
  "payment_method": "CASH"
}
```
- `DELETE /api/v1/pos/held-orders/:id` -> Unhold / Cancel held order

---

## 17. Bank Accounts & Treasury (`/api/v1/bank-accounts`)

### `GET /api/v1/bank-accounts`
- **Auth:** Bearer Token
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": [
    {
      "id": "7a8b9c0d-1e2f-3a4b-5c6d-7e8f9a0b1c2d",
      "bank_name": "Meezan Bank Ltd",
      "account_title": "Sabir Plastic Store",
      "account_number": "01020304050607",
      "current_balance": 850000.0,
      "is_active": true
    }
  ]
}
```

### `GET /api/v1/bank-accounts/cash-drawer-balance`
- **Auth:** Bearer Token
- **Description:** Physical Cash Register / Drawer me is waqt mojood cash balance.
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "data": {
    "balance": 45200.0,
    "currency": "PKR"
  }
}
```

### `POST /api/v1/bank-accounts`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `ACCOUNTANT`)
- **Request Body:**
```json
{
  "bank_name": "Bank Alfalah",
  "account_title": "Sabir Plastic Works",
  "account_number": "100987654321",
  "iban_details": "PK36ALFH1009876543210001",
  "opening_balance": 100000
}
```
- **Expected Status:** `201 Created`

### `POST /api/v1/bank-accounts/transfer`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `ACCOUNTANT`, `CASHIER`)
- **Description:** Cash drawer se bank me cash deposit ya bank se cash withdraw ya bank-to-bank transfer.
- **Request Body:**
```json
{
  "from_account_id": "CASH_DRAWER",
  "to_account_id": "<BANK_ACCOUNT_UUID>",
  "amount": 25000,
  "notes": "Daily evening cash deposit into bank",
  "date": "2026-10-28"
}
```
- **Expected Status:** `200 OK`

### `GET /api/v1/bank-accounts/:id/transactions`
- **Auth:** Bearer Token
- **Expected Status:** `200 OK`

---

## 18. Incoming PDCs (`/api/v1/incoming-pdcs`)

### `GET /api/v1/incoming-pdcs`
- **Auth:** Bearer Token
- **Query Params:** `status` (`PENDING`, `CLEARED`, `BOUNCED`)
- **Expected Status:** `200 OK`

### `POST /api/v1/incoming-pdcs/:id/clear`
- **Auth:** Bearer Token
- **Description:** PDC clear mark karta hai aur bank balance credit karta hai.
- **Expected Status:** `200 OK`

### `POST /api/v1/incoming-pdcs/:id/bounce`
- **Auth:** Bearer Token
- **Description:** PDC bounce mark karta hai aur customer debt wapis reinstate karta hai.
- **Expected Status:** `200 OK`

---

## 19. Employees & Payroll (`/api/v1/employees`)

### `GET /api/v1/employees`
- **Auth:** Bearer Token
- **Query Params:** `search`, `status` (`ACTIVE`, `INACTIVE`, `ON_LEAVE`), `designation`
- **Expected Status:** `200 OK`

### `POST /api/v1/employees`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "employee_id": "EMP-001",
  "name": "Muhammad Aslam",
  "phone": "03017654321",
  "designation": "Machine Operator",
  "store_timing": "09:00 AM - 07:00 PM",
  "salary": 38000,
  "cnic": "35202-1234567-1",
  "status": "ACTIVE",
  "joining_date": "2026-01-15",
  "notes": "Permanent production staff"
}
```
- **Expected Status:** `201 Created`

### `GET /api/v1/employees/:id/ledger`
- **Auth:** Bearer Token
- **Expected Status:** `200 OK`

### `POST /api/v1/employees/:id/ledger` (Salary / Advance / Payment Entry)
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "transaction_type": "SALARY",
  "amount": 38000,
  "reference_month": "2026-10",
  "payment_method": "CASH",
  "description": "October 2026 Monthly Salary"
}
```
*(Types: `SALARY`, `ADVANCE`, `PAYMENT`, `BONUS`, `DEDUCTION`)*
- **Expected Status:** `201 Created`

### `DELETE /api/v1/employees/:id/ledger/:entryId`
- **Auth:** Bearer Token
- **Expected Status:** `200 OK`

---

## 20. Product Exchanges (`/api/v1/exchanges`)

Barter / Dana Badli (ek product de kar doosra product lene ka record):

### `GET /api/v1/exchanges`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`)
- **Expected Status:** `200 OK`

### `POST /api/v1/exchanges`
- **Auth:** Bearer Token (Role: `OWNER`, `ADMIN`, `CASHIER`)
- **Request Body:**
```json
{
  "given_product_id": "<PRODUCT_A_UUID>",
  "given_quantity": 50.0,
  "received_product_id": "<PRODUCT_B_UUID>",
  "received_quantity": 50.0,
  "exchange_date": "2026-10-28",
  "notes": "Direct lot exchange with neighboring shop"
}
```
- **Expected Status:** `201 Created`

---

## 21. Reports & BI (`/api/v1/reports`)

### General Reports (Accessible by `OWNER`, `ADMIN`, `CASHIER`):
- `GET /api/v1/reports/dashboard` -> Top metrics (sales today, low stock alerts, cash, payables, receivables).
- `GET /api/v1/reports/inventory` -> Complete stock position, valuation, and movements.
- `GET /api/v1/reports/cashier-tally` -> Current user shift cash reconciliation.
- `GET /api/v1/reports/pdc` -> All post-dated cheques overview.
- `GET /api/v1/reports/issued-pdc` -> Cheques issued to suppliers.

### Executive Financial Reports (Restricted to `OWNER` & `ADMIN` only):
- `GET /api/v1/reports/liquidity` -> Net Cash, Bank, Receivables vs Payables position.
- `GET /api/v1/reports/liquidity/receivables` -> Customer outstanding market debt breakdown.
- `GET /api/v1/reports/liquidity/payables` -> Supplier upcoming payables list.
- `GET /api/v1/reports/liquidity/customer-advances` -> Advance cash collected from customers.
- `GET /api/v1/reports/liquidity/supplier-advances` -> Advance cash paid to suppliers.
- `GET /api/v1/reports/liquidity/unsold-stock` -> Tied-up capital in unsold warehouse inventory.
- `GET /api/v1/reports/profit`?productId=&timeFilter= -> Gross profit per product / time window.
- `GET /api/v1/reports/pnl`?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD -> Profit and Loss Statement.
- `GET /api/v1/reports/income-statement`?startDate=&endDate= -> Income Statement report.
- `GET /api/v1/reports/income-statement/returns-detail` -> Sales returns financial impact.
- `GET /api/v1/reports/margin-analytics`?startDate=&endDate= -> Margin percentage per product/category.
- `GET /api/v1/reports/inventory-valuation` -> Weighted average cost inventory valuation.
- `GET /api/v1/reports/cash-ledger`?startDate=&endDate= -> Raw Cash inflows & outflows audit trail.

**Sample Dashboard Output (`GET /api/v1/reports/dashboard`):**
```json
{
  "success": true,
  "data": {
    "total_receivables": 450000,
    "total_payables": 320000,
    "cash_drawer_balance": 45200,
    "bank_balance": 850000,
    "inventory_valuation": 1250000,
    "today_sales": 85000,
    "low_stock_count": 3
  }
}
```

---

## 22. Onboarding & Bulk Import (`/api/v1/onboarding`)

System start hone par opening data bulk me import karne ke endpoints:

### `POST /api/v1/onboarding/customers`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "customers": [
    {
      "name": "Bismillah Plastic",
      "phone": "03009998877",
      "city": "Gujranwala",
      "opening_balance": 45000
    },
    {
      "name": "Ittihad Polythene",
      "phone": "03215554433",
      "city": "Lahore",
      "opening_balance": 120000
    }
  ]
}
```
- **Expected Status:** `200 OK`

### `POST /api/v1/onboarding/suppliers`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "suppliers": [
    {
      "name": "Engro Polymer & Chemicals",
      "phone": "021111211211",
      "city": "Karachi",
      "opening_balance": 650000
    }
  ]
}
```
- **Expected Status:** `200 OK`

### `POST /api/v1/onboarding/inventory`
- **Auth:** Bearer Token
- **Request Body:**
```json
{
  "items": [
    {
      "product_id": "<PRODUCT_UUID>",
      "initial_kg": 5000,
      "avg_buy_price_per_kg": 365.0,
      "notes": "Opening stock verified from godown physical count"
    }
  ]
}
```
- **Expected Status:** `200 OK`

---

## 23. Developer Tools (`/api/v1/dev`)

> ⚠️ **Warning:** Sirf Development mode (`NODE_ENV=development`) me chalta hai. Production me 403 Forbidden return hota hai.

### `POST /api/v1/dev/reset-database`
- **Auth:** Public in development
- **Description:** Tamam operational tables (`sales`, `purchases`, `payments`, `inventory`, `customers`, `products`) ko wipe out kar ke clean slate karta hai taa ke fresh testing ki jaa sake.
- **Expected Status:** `200 OK`
```json
{
  "success": true,
  "message": "Operational database tables successfully wiped and identity sequences reset.",
  "truncated_tables": [
    "customer_payments",
    "supplier_payments",
    "expenses",
    "sales_invoice_items",
    "sales_invoices",
    "purchase_invoice_items",
    "purchase_invoices",
    "inventory_transactions",
    "inventory_batches",
    "products",
    "customers",
    "suppliers",
    "categories"
  ]
}
```

---

## 🚀 Step-by-Step API Testing Flow (In Postman / Thunder Client)

Postman ya Thunder Client me test karne ke liye yeh sequence follow karen:

1. **Get Token:**
   - Request: `POST http://localhost:3001/api/v1/auth/login`
   - Body: `{"email": "owner@sabir.local", "password": "Admin@1234"}`
   - Token copy karen aur collection variable me set karen: `{{token}}`.
2. **Set Header in next requests:**
   - `Authorization`: `Bearer {{token}}`
   - `Content-Type`: `application/json`
3. **Check System Health:**
   - `GET http://localhost:3001/api/v1/health`
4. **Create Master Data:**
   - Category banayein (`POST /categories`)
   - Product banayein (`POST /products`)
   - Supplier banayein (`POST /suppliers`)
   - Customer banayein (`POST /customers`)
   - Bank Account banayein (`POST /bank-accounts`)
5. **Run Operational Flows:**
   - Raw material purchase invoice banayein (`POST /purchases`)
   - Supplier ko payment bheinjen (`POST /supplier-payments`)
   - Customer ko sale invoice ya POS checkout karen (`POST /pos/checkout`)
   - Customer se payment receive karen (`POST /payments`)
6. **Verify Financial Reports:**
   - `GET /reports/dashboard`
   - `GET /reports/inventory`
   - `GET /reports/liquidity`
   - `GET /bank-accounts/cash-drawer-balance`
