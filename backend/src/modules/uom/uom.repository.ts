import db from '../../db/knex';
import { CreateUOMInput, UpdateUOMInput } from './uom.schemas';

export interface UOMRow {
  id: string;
  name: string;
  abbreviation: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function findAllUOM(): Promise<UOMRow[]> {
  return db('units_of_measure').select('*').orderBy('name', 'asc');
}

export async function findUOMById(id: string): Promise<UOMRow | undefined> {
  return db('units_of_measure').where({ id }).first();
}

export async function findUOMByNameOrAbbr(name: string, abbreviation: string): Promise<UOMRow | undefined> {
  return db('units_of_measure')
    .whereRaw('LOWER(name) = ?', name.toLowerCase())
    .orWhereRaw('LOWER(abbreviation) = ?', abbreviation.toLowerCase())
    .first();
}

export async function createUOM(data: CreateUOMInput): Promise<UOMRow> {
  const [row] = await db('units_of_measure')
    .insert(data)
    .returning('*');
  return row;
}

export async function updateUOM(id: string, data: UpdateUOMInput): Promise<UOMRow | undefined> {
  const [row] = await db('units_of_measure')
    .where({ id })
    .update({ ...data, updated_at: new Date() })
    .returning('*');
  return row;
}

export async function isUOMInUse(id: string): Promise<boolean> {
  const product = await db('products').where({ uom_id: id, is_active: true }).first('id');
  return !!product;
}

export async function softDeleteUOM(id: string): Promise<boolean> {
  const count = await db('units_of_measure')
    .where({ id })
    .update({ is_active: false, updated_at: new Date() });
  return count > 0;
}
