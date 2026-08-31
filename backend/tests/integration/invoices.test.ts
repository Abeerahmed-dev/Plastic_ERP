import request from 'supertest';
import { createApp } from '../../src/app';
import db from '../../src/db/knex';

const app = createApp();
const OWNER_EMAIL = 'owner@sabir.local';
const OWNER_PASSWORD = 'Admin@1234';

let ownerToken: string;
let customerId: string;
let productId: string;
let uomId: string;
let invoiceId: string;

beforeAll(async () => {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  ownerToken = res.body.data.access_token;
  
  // Create a customer
  const customerRes = await request(app)
    .post('/api/v1/customers')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Invoice Test Customer',
      credit_limit: 100000,
      opening_balance: 0,
    });
  customerId = customerRes.body.data.id;
  
  // Get or Create a UOM
  let uomRes = await request(app)
    .get('/api/v1/uom')
    .set('Authorization', `Bearer ${ownerToken}`);
  
  if (uomRes.body.data && uomRes.body.data.length > 0) {
    uomId = uomRes.body.data[0].id;
  } else {
    uomRes = await request(app)
      .post('/api/v1/uom')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'kg test ' + Date.now(), abbreviation: 'kgT' + Date.now() });
    uomId = uomRes.body.data.id;
  }

  // Create a product
  const productRes = await request(app)
    .post('/api/v1/products')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      name: 'Test Product for Invoice',
      category: 'Plastic Bag',
      uom_id: uomId,
      cost_price: 100,
      sale_price: 500,
    });
  if (!productRes.body.data) {
    console.error('Product Creation Failed:', productRes.body);
  }
  productId = productRes.body.data?.id;
});

afterAll(async () => {
  await db('customer_payments').delete();
  await db('sales_invoice_items').delete();
  await db('sales_invoices').delete();
  await db('products').where('id', productId).delete();
  await db('units_of_measure').where('id', uomId).delete();
  await db('customers').where('id', customerId).delete();
  await db.destroy();
});

describe('Invoices, Payments & Ledger API (Integration)', () => {
  describe('POST /api/v1/invoices', () => {
    it('should create a new invoice', async () => {
      const res = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: customerId,
          date: new Date().toISOString(),
          due_date: new Date().toISOString(),
          discount: 50,
          items: [
            {
              product_id: productId,
              quantity: 2,
              unit_price: 500, // 2 * 500 = 1000, discount 50, total = 950
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.total_amount)).toBe(950);
      expect(res.body.data.status).toBe('UNPAID');
      
      invoiceId = res.body.data.id;
    });
  });

  describe('GET /api/v1/invoices/:id', () => {
    it('should fetch an invoice with items', async () => {
      const res = await request(app)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.id).toBe(invoiceId);
    });
  });

  describe('POST /api/v1/payments', () => {
    it('should record a partial payment against the invoice', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: customerId,
          invoice_id: invoiceId,
          amount: 400,
          payment_date: new Date().toISOString(),
          payment_method: 'BANK_TRANSFER',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();

      // Verify invoice status updated
      const invRes = await request(app)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
        
      expect(Number(invRes.body.data.paid_amount)).toBe(400);
      expect(invRes.body.data.status).toBe('PARTIAL');
    });

    it('should record the remaining payment and mark invoice as PAID', async () => {
      const res = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          customer_id: customerId,
          invoice_id: invoiceId,
          amount: 550, // Remaining 550
          payment_date: new Date().toISOString(),
          payment_method: 'CASH',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.id).toBeDefined();

      // Verify invoice status updated
      const invRes = await request(app)
        .get(`/api/v1/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
        
      expect(Number(invRes.body.data.paid_amount)).toBe(950);
      expect(invRes.body.data.status).toBe('PAID');
    });
  });

  describe('GET /api/v1/customers/:id/ledger', () => {
    it('should calculate the chronological ledger correctly', async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${customerId}/ledger`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      const ledger = res.body.data;
      
      expect(ledger.length).toBeGreaterThan(0);
      expect(ledger[0].type).toBe('OPENING_BALANCE');
      
      // Should find the invoice (debit) and payments (credit)
      const invoiceEntry = ledger.find((l: any) => l.type === 'INVOICE' && l.debit === 950);
      const paymentEntry1 = ledger.find((l: any) => l.type === 'PAYMENT' && l.credit === 400);
      const paymentEntry2 = ledger.find((l: any) => l.type === 'PAYMENT' && l.credit === 550);
      
      expect(invoiceEntry).toBeDefined();
      expect(paymentEntry1).toBeDefined();
      expect(paymentEntry2).toBeDefined();
    });
  });
});
