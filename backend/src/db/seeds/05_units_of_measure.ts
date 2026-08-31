import { Knex } from 'knex';

const DEFAULT_UOMS = [
  { name: 'Kilogram', abbreviation: 'Kg' },
  { name: 'Piece', abbreviation: 'Pcs' },
  { name: 'Bundle', abbreviation: 'Bdl' },
  { name: 'Roll', abbreviation: 'Roll' },
  { name: 'Bag', abbreviation: 'Bag' },
  { name: 'Carton', abbreviation: 'Ctn' },
  { name: 'Meter', abbreviation: 'm' },
  { name: 'Liter', abbreviation: 'L' },
];

export async function seed(knex: Knex): Promise<void> {
  // Idempotent seed: insert or do nothing if the abbreviation already exists
  for (const uom of DEFAULT_UOMS) {
    await knex('units_of_measure')
      .insert({
        name: uom.name,
        abbreviation: uom.abbreviation,
        is_active: true,
      })
      .onConflict('abbreviation')
      .ignore();
  }
}
