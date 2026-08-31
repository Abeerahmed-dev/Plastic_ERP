import { ConflictError, NotFoundError } from '../../shared/errors';
import { CreateUOMInput, UpdateUOMInput } from './uom.schemas';
import * as uomRepo from './uom.repository';

export async function listUOM(): Promise<uomRepo.UOMRow[]> {
  return uomRepo.findAllUOM();
}

export async function getUOM(id: string): Promise<uomRepo.UOMRow> {
  const uom = await uomRepo.findUOMById(id);
  if (!uom) throw new NotFoundError('Unit of Measure');
  return uom;
}

export async function addUOM(data: CreateUOMInput): Promise<uomRepo.UOMRow> {
  const existing = await uomRepo.findUOMByNameOrAbbr(data.name, data.abbreviation);
  if (existing) {
    throw new ConflictError('A Unit of Measure with this name or abbreviation already exists.');
  }
  return uomRepo.createUOM(data);
}

export async function editUOM(id: string, data: UpdateUOMInput): Promise<uomRepo.UOMRow> {
  await getUOM(id); // throws 404 if not found
  
  if (data.name || data.abbreviation) {
    const uom = await uomRepo.findUOMById(id);
    const checkName = data.name || uom!.name;
    const checkAbbr = data.abbreviation || uom!.abbreviation;
    const existing = await uomRepo.findUOMByNameOrAbbr(checkName, checkAbbr);
    if (existing && existing.id !== id) {
       throw new ConflictError('A Unit of Measure with this name or abbreviation already exists.');
    }
  }

  const updated = await uomRepo.updateUOM(id, data);
  if (!updated) throw new NotFoundError('Unit of Measure');
  return updated;
}

export async function deactivateUOM(id: string): Promise<void> {
  await getUOM(id);
  
  const inUse = await uomRepo.isUOMInUse(id);
  if (inUse) {
    throw new ConflictError('Cannot deactivate UOM: It is currently used by one or more active products.');
  }

  await uomRepo.softDeleteUOM(id);
}
