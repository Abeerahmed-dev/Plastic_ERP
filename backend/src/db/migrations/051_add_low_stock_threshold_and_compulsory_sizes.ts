import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Add low_stock_threshold to products table
  const hasLowStockThreshold = await knex.schema.hasColumn('products', 'low_stock_threshold');
  if (!hasLowStockThreshold) {
    await knex.schema.alterTable('products', (table) => {
      table.decimal('low_stock_threshold', 14, 4).notNullable().defaultTo(0);
    });
  }

  // 2. Backfill empty sizes on products table and enforce NOT NULL
  await knex.raw(`
    UPDATE products 
    SET size = 'Standard' 
    WHERE size IS NULL OR TRIM(size) = '';
  `);

  await knex.raw(`
    ALTER TABLE products 
    ALTER COLUMN size SET DEFAULT 'Standard',
    ALTER COLUMN size SET NOT NULL;
  `);

  // 3. Add size column to sales_invoice_items and enforce NOT NULL
  const hasSalesItemSize = await knex.schema.hasColumn('sales_invoice_items', 'size');
  if (!hasSalesItemSize) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.string('size', 100).nullable();
    });
  }

  // Backfill size from products
  await knex.raw(`
    UPDATE sales_invoice_items sii
    SET size = COALESCE(NULLIF(TRIM(p.size), ''), 'Standard')
    FROM products p
    WHERE sii.product_id = p.id;
  `);

  await knex.raw(`
    UPDATE sales_invoice_items
    SET size = 'Standard'
    WHERE size IS NULL OR TRIM(size) = '';
  `);

  await knex.raw(`
    ALTER TABLE sales_invoice_items
    ALTER COLUMN size SET DEFAULT 'Standard',
    ALTER COLUMN size SET NOT NULL;
  `);

  // 4. Add size column to purchase_invoice_items and enforce NOT NULL
  const hasPurchaseItemSize = await knex.schema.hasColumn('purchase_invoice_items', 'size');
  if (!hasPurchaseItemSize) {
    await knex.schema.alterTable('purchase_invoice_items', (table) => {
      table.string('size', 100).nullable();
    });
  }

  // Backfill size from products
  await knex.raw(`
    UPDATE purchase_invoice_items pii
    SET size = COALESCE(NULLIF(TRIM(p.size), ''), 'Standard')
    FROM products p
    WHERE pii.product_id = p.id;
  `);

  await knex.raw(`
    UPDATE purchase_invoice_items
    SET size = 'Standard'
    WHERE size IS NULL OR TRIM(size) = '';
  `);

  await knex.raw(`
    ALTER TABLE purchase_invoice_items
    ALTER COLUMN size SET DEFAULT 'Standard',
    ALTER COLUMN size SET NOT NULL;
  `);

  // 5. Add size column to inventory_batches and enforce NOT NULL
  const hasBatchSize = await knex.schema.hasColumn('inventory_batches', 'size');
  if (!hasBatchSize) {
    await knex.schema.alterTable('inventory_batches', (table) => {
      table.string('size', 100).nullable();
    });
  }

  // Backfill size from products
  await knex.raw(`
    UPDATE inventory_batches ib
    SET size = COALESCE(NULLIF(TRIM(p.size), ''), 'Standard')
    FROM products p
    WHERE ib.product_id = p.id;
  `);

  await knex.raw(`
    UPDATE inventory_batches
    SET size = 'Standard'
    WHERE size IS NULL OR TRIM(size) = '';
  `);

  await knex.raw(`
    ALTER TABLE inventory_batches
    ALTER COLUMN size SET DEFAULT 'Standard',
    ALTER COLUMN size SET NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  const hasBatchSize = await knex.schema.hasColumn('inventory_batches', 'size');
  if (hasBatchSize) {
    await knex.schema.alterTable('inventory_batches', (table) => {
      table.dropColumn('size');
    });
  }

  const hasPurchaseItemSize = await knex.schema.hasColumn('purchase_invoice_items', 'size');
  if (hasPurchaseItemSize) {
    await knex.schema.alterTable('purchase_invoice_items', (table) => {
      table.dropColumn('size');
    });
  }

  const hasSalesItemSize = await knex.schema.hasColumn('sales_invoice_items', 'size');
  if (hasSalesItemSize) {
    await knex.schema.alterTable('sales_invoice_items', (table) => {
      table.dropColumn('size');
    });
  }

  await knex.raw(`
    ALTER TABLE products ALTER COLUMN size DROP NOT NULL;
  `);

  const hasLowStockThreshold = await knex.schema.hasColumn('products', 'low_stock_threshold');
  if (hasLowStockThreshold) {
    await knex.schema.alterTable('products', (table) => {
      table.dropColumn('low_stock_threshold');
    });
  }
}
