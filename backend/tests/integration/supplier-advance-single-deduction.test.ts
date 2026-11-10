import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
const OWNER_EMAIL = 'owner@sabir.local';
const OWNER_PASSWORD = 'Admin@1234';

let ownerToken: string;
let bankAccountId: string;
let supplierId: string;
let categoryId: string;
let productId: string;
let purchaseInvoiceId: string;
let invoiceNumber: string;

beforeAll(async () => {
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  ownerToken = loginRes.body.data.access_token;

  // 1. Create a designated bank account with Rs. 50,000 initial balance
  const bankRes = await request(app)
    .post('/api/v1/bank-accounts')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      account_title: 'Supplier Advance Audit Account',
      bank_name: 'Habib Bank Ltd',
      account_number: 'PK00HBL' + Date.now().toString().slice(-8),
      iban: 'PK00HBL0000000000000000',
      initial_balance: 50000,
    });
  bankAccountId = bankRes.body.data.id;

  // 2. Create a test supplier
  const suppRes = await request(app)
    .post('/api/v1/suppliers')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Petrochem Global Supplies ' + Date.now(),
      phone: '03009876543',
      city: 'Karachi',
      payment_terms: 30,
      opening_payable: 0,
    });
  supplierId = suppRes.body.data.id;

  // 3. Category & Product for invoice testing
  let catRes = await request(app)
    .get('/api/v1/categories')
    .set('Authorization', `Bearer ${ownerToken}`);
  if (catRes.body.data && catRes.body.data.length > 0) {
    categoryId = catRes.body.data[0].id;
  } else {
    catRes = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Advance Audit Category ' + Date.now(), bag_weight_kg: 25 });
    categoryId = catRes.body.data.id;
  }

  const prodRes = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Polypropylene Granules ' + Date.now(),
      category_id: categoryId,
      size: 'Standard',
      cost_price: 300,
      sale_price: 350,
      total_stock_kg: 0,
      rolling_avg_cost_per_kg: 300,
    });
  productId = prodRes.body.data.id;
});

afterAll(async () => {
  if (purchaseInvoiceId) {
    await db('purchase_invoice_items').where('purchase_invoice_id', purchaseInvoiceId).delete();
    await db('supplier_payment_allocations').where('purchase_invoice_id', purchaseInvoiceId).delete();
    await db('inventory_batches').where('purchase_invoice_id', purchaseInvoiceId).delete();
    await db('purchase_invoices').where('id', purchaseInvoiceId).delete();
  }
  if (supplierId) {
    await db('supplier_payment_allocations').whereIn('payment_id', function () {
      this.select('id').from('supplier_payments').where('supplier_id', supplierId);
    }).delete();
    await db('cash_drawer_ledger').whereIn('reference_id', function () {
      this.select('id').from('supplier_payments').where('supplier_id', supplierId);
    }).delete();
    await db('supplier_payments').where('supplier_id', supplierId).delete();
    await db('suppliers').where('id', supplierId).delete();
  }
  if (productId) {
    await db('inventory_transactions').where('product_id', productId).delete();
    await db('inventory_batches').where('product_id', productId).delete();
    await db('products').where('id', productId).delete();
  }
  if (bankAccountId) {
    await db('bank_transactions').where('bank_account_id', bankAccountId).delete();
    await db('bank_accounts').where('id', bankAccountId).delete();
  }
  await db.destroy();
});

describe('Supplier Advance Single-Deduction & Dynamic Nomenclature', () => {
  it('Phase 1 & Liquidity Wall: Should strictly reject advance exceeding available balance', async () => {
    const res = await request(app)
      .post('/api/v1/advances/supplier')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        supplier_id: supplierId,
        amount: 999999, // Exceeds 50,000 balance
        source: bankAccountId,
        payment_date: new Date().toISOString().split('T')[0],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/INSUFFICIENT_LIQUIDITY/i);
  });

  it('Phase 1 & Phase 2: Logging Rs. 1,000 supplier advance must deduct exactly Rs. 1,000 from bank ledger (1:1 ratio)', async () => {
    // Initial bank check
    const preBankRes = await request(app)
      .get(`/api/v1/bank-accounts/${bankAccountId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const initialBalance = Number(preBankRes.body.data.current_balance);
    expect(initialBalance).toBe(50000);

    // Log Rs. 1,000 advance to supplier
    const advRes = await request(app)
      .post('/api/v1/advances/supplier')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        supplier_id: supplierId,
        amount: 1000,
        source: bankAccountId,
        payment_date: new Date().toISOString().split('T')[0],
      });

    expect(advRes.status).toBe(201);
    expect(advRes.body.success).toBe(true);

    // Verify supplier wallet balance incremented by exactly Rs. 1,000
    const suppRes = await request(app)
      .get(`/api/v1/suppliers/${supplierId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(Number(suppRes.body.data.advance_payable)).toBe(1000);

    // Verify bank account balance dropped by EXACTLY Rs. 1,000 (NOT Rs. 2,000)
    const postBankRes = await request(app)
      .get(`/api/v1/bank-accounts/${bankAccountId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    const updatedBalance = Number(postBankRes.body.data.current_balance);
    expect(updatedBalance).toBe(49000); // 50000 - 1000 = 49000

    // Verify bank transactions ledger has EXACTLY ONE outflow record for this advance
    const txRes = await request(app)
      .get(`/api/v1/bank-accounts/${bankAccountId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(txRes.status).toBe(200);
    const transactions = txRes.body.data.transactions || [];
    const outflowTxs = transactions.filter((t: any) => t.type === 'OUTFLOW');

    // CRITICAL: Exactly 1 outflow row, eliminating duplicate row bug
    expect(outflowTxs.length).toBe(1);
    expect(Number(outflowTxs[0].amount)).toBe(1000);

    // Phase 2: Verify Dynamic Nomenclature
    expect(outflowTxs[0].description).toMatch(/Advance Deposit to Supplier:/i);
    expect(outflowTxs[0].category).toBe('SUPPLIER_ADVANCE');
  });

  it('Phase 2: Payment tied to a purchase invoice must dynamically name Invoice #[number] and category SUPPLIER_PAYMENT', async () => {
    // 1. Create a purchase invoice of Rs. 5,000
    const billRes = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        supplier_id: supplierId,
        date: new Date().toISOString().split('T')[0],
        discount: 0,
        items: [
          {
            product_id: productId,
            quantity: 10,
            unit_price: 300, // 3000
          },
        ],
      });

    expect(billRes.status).toBe(201);
    purchaseInvoiceId = billRes.body.data.id;
    invoiceNumber = billRes.body.data.invoice_number;

    // 2. Pay Rs. 2,000 against this invoice via bank
    const payRes = await request(app)
      .post('/api/v1/supplier-payments')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        supplier_id: supplierId,
        purchase_invoice_id: purchaseInvoiceId,
        amount: 2000,
        payment_method: 'BANK_TRANSFER',
        bank_account_id: bankAccountId,
        payment_date: new Date().toISOString().split('T')[0],
      });

    expect(payRes.status).toBe(201);

    // 3. Inspect Bank Transactions Ledger
    const txRes = await request(app)
      .get(`/api/v1/bank-accounts/${bankAccountId}/transactions`)
      .set('Authorization', `Bearer ${ownerToken}`);

    const transactions = txRes.body.data.transactions || [];
    const invoicePayTx = transactions.find((t: any) =>
      t.description.includes(invoiceNumber)
    );

    expect(invoicePayTx).toBeDefined();
    expect(invoicePayTx.description).toMatch(new RegExp(`Payment to Supplier:.*for Invoice #${invoiceNumber}`, 'i'));
    expect(invoicePayTx.category).toBe('SUPPLIER_PAYMENT');
    expect(Number(invoicePayTx.amount)).toBe(2000);

    // Total bank balance should now be 49,000 - 2,000 = 47,000
    const bankRes = await request(app)
      .get(`/api/v1/bank-accounts/${bankAccountId}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(Number(bankRes.body.data.current_balance)).toBe(47000);
  });
});

