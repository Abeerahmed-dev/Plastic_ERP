import type { Knex } from 'knex';

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

export async function seed(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('categories');
  if (!hasTable) return;

  for (const cat of defaultCategories) {
    const existing = await knex('categories').where({ name: cat.name }).first();
    if (!existing) {
      await knex('categories').insert(cat);
    }
  }
}

