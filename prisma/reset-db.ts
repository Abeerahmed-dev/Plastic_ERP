import { PrismaClient } from '../backend/node_modules/@prisma/client';

const prisma = new PrismaClient();

async function resetDb() {
  try {
    console.log('🗑️ Wiping all transactional ledgers...');
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "bank_transactions", "inventory_transactions", "inventory_batches", "payment_allocations", "supplier_payment_allocations", "cash_drawer_ledger" CASCADE;'
    );

    console.log('🗑️ Wiping payments, invoices, returns & expenses...');
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "customer_payments", "supplier_payments", "sales_invoice_items", "purchase_invoice_items", "sales_invoices", "purchase_invoices", "expenses", "incoming_pdcs" CASCADE;'
    );

    console.log('🗑️ Wiping master entities (customers, suppliers, products, categories, bank accounts)...');
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "customers", "suppliers", "products", "categories", "bank_accounts" CASCADE;'
    );

    console.log('🗑️ Clearing stale session tokens...');
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "refresh_tokens" CASCADE;'
    );

    console.log('👥 Selectively cleaning non-default accounts...');
    await prisma.$executeRawUnsafe(
      `DELETE FROM "users" WHERE "email" IS NOT NULL AND "email" NOT IN ('owner@sabir.local', 'cashier@sabirplastic.local');`
    );

    console.log('🌱 Seeding essential baseline records (Walk-in Customer & Standard Categories)...');
    await prisma.$executeRawUnsafe(`
      INSERT INTO "categories" ("name", "bag_weight_kg", "description") VALUES
        ('30/s Poly', 30.0000, 'Standard 30/s Poly bags (30 KG/Bag)'),
        ('50/s Poly', 50.0000, 'Heavy duty 50/s Poly bags (50 KG/Bag)'),
        ('Plastic Bag', 25.0000, 'Standard Plastic Bags (25 KG/Bag)'),
        ('Roll', 25.0000, 'Plastic Rolls (25 KG/Bag)'),
        ('Sheet', 20.0000, 'Plastic Sheets (20 KG/Bag)'),
        ('Granules', 25.0000, 'Raw Plastic Granules (25 KG/Bag)'),
        ('Packaging', 25.0000, 'Packaging Material (25 KG/Bag)'),
        ('Other', 25.0000, 'General & Miscellaneous Products (25 KG/Bag)')
      ON CONFLICT ("name") DO NOTHING;
    `);

    await prisma.$executeRawUnsafe(`
      INSERT INTO "customers" ("code", "name", "phone", "address", "opening_balance") VALUES
        ('WALK-IN', 'Walk-in Customer', '00000000000', 'POS Default Customer', 0)
      ON CONFLICT ("code") DO NOTHING;
    `);

    console.log('🔒 Preserved Owner & Cashier accounts. Seeded Walk-in Customer & 8 Categories.');
    console.log('✅ Database reset complete. Zero balances, clean slate, ready for testing!');
  } catch (error) {
    console.error('❌ Failed to reset database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDb();
