import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Create categories table if it does not exist
  const hasCategoriesTable = await knex.schema.hasTable('categories');
  if (!hasCategoriesTable) {
    await knex.schema.createTable('categories', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('name', 100).notNullable().unique();
      table.decimal('bag_weight_kg', 12, 4).notNullable().defaultTo(25.0000);
      table.text('description').nullable();
      table.uuid('created_by').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.timestamps(true, true);

      table.index('name');
    });
  }

  // 2. Seed initial default categories safely
  const defaultCategories = [
    { name: '30/s Poly', bag_weight_kg: 30.0, description: 'Standard 30/s Poly bags (30 KG/Bag)' },
    { name: '50/s Poly', bag_weight_kg: 50.0, description: 'Heavy duty 50/s Poly bags (50 KG/Bag)' },
    { name: 'Plastic Bag', bag_weight_kg: 25.0, description: 'Standard Plastic Bags (25 KG/Bag)' },
    { name: 'Roll', bag_weight_kg: 25.0, description: 'Plastic Rolls (25 KG/Bag)' },
    { name: 'Sheet', bag_weight_kg: 20.0, description: 'Plastic Sheets (20 KG/Bag)' },
    { name: 'Granules', bag_weight_kg: 25.0, description: 'Raw Plastic Granules (25 KG/Bag)' },
    { name: 'Packaging', bag_weight_kg: 25.0, description: 'Packaging Material (25 KG/Bag)' },
    { name: 'Other', bag_weight_kg: 25.0, description: 'General & Miscellaneous Products (25 KG/Bag)' },
  ];

  for (const cat of defaultCategories) {
    const existing = await knex('categories').where({ name: cat.name }).first();
    if (!existing) {
      await knex('categories').insert(cat);
    }
  }

  const defaultCategory = await knex('categories').where({ name: 'Other' }).first();
  const defaultCategoryId = defaultCategory ? defaultCategory.id : null;

  // 3. Add category_id foreign key to products if missing
  const hasCategoryId = await knex.schema.hasColumn('products', 'category_id');
  if (!hasCategoryId) {
    await knex.schema.alterTable('products', (table) => {
      table.uuid('category_id').nullable().references('id').inTable('categories').onDelete('RESTRICT');
    });
  }

  // Populate category_id for existing products based on string category
  const products = await knex('products').select('id', 'category');
  const allCategories = await knex('categories').select('id', 'name');
  const catMap = new Map<string, string>(allCategories.map((c) => [c.name.toLowerCase(), c.id]));

  for (const prod of products) {
    let targetCatId = prod.category ? catMap.get(prod.category.toLowerCase()) : null;
    if (!targetCatId && prod.category) {
      // Create category on the fly if not existing
      const [newCat] = await knex('categories')
        .insert({
          name: prod.category,
          bag_weight_kg: 25.0,
          description: `Auto-created from product category '${prod.category}'`,
        })
        .returning('*');
      targetCatId = newCat.id;
      catMap.set(newCat.name.toLowerCase(), newCat.id);
    }
    if (!targetCatId) {
      targetCatId = defaultCategoryId;
    }
    if (targetCatId) {
      await knex('products').where({ id: prod.id }).update({ category_id: targetCatId });
    }
  }

  // Make category_id mandatory
  await knex.raw('ALTER TABLE products ALTER COLUMN category_id SET NOT NULL');

  // 4. Drop uom_id column from products if present
  const hasUomId = await knex.schema.hasColumn('products', 'uom_id');
  if (hasUomId) {
    await knex.raw('ALTER TABLE products DROP COLUMN IF EXISTS uom_id CASCADE');
  }

  // 5. Drop units_of_measure table if present
  await knex.raw('DROP TABLE IF EXISTS units_of_measure CASCADE');
}

export async function down(knex: Knex): Promise<void> {
  // Recreate units_of_measure if rolling back
  const hasUnits = await knex.schema.hasTable('units_of_measure');
  if (!hasUnits) {
    await knex.schema.createTable('units_of_measure', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('name', 50).notNullable();
      table.string('abbreviation', 10).notNullable();
      table.timestamps(true, true);
    });
  }

  const hasUomId = await knex.schema.hasColumn('products', 'uom_id');
  if (!hasUomId) {
    await knex.schema.alterTable('products', (table) => {
      table.uuid('uom_id').nullable().references('id').inTable('units_of_measure').onDelete('RESTRICT');
    });
  }

  const hasCategoryId = await knex.schema.hasColumn('products', 'category_id');
  if (hasCategoryId) {
    await knex.raw('ALTER TABLE products DROP COLUMN IF EXISTS category_id CASCADE');
  }

  await knex.schema.dropTableIfExists('categories');
}
