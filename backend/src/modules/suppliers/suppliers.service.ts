import { NotFoundError } from '../../shared/errors';
import { CreateSupplierInput, UpdateSupplierInput, SupplierQuery } from './suppliers.schemas';
import {
  findAllSuppliers,
  findSupplierById,
  createSupplier,
  updateSupplier,
  softDeleteSupplier,
  getSupplierLedger as repoGetSupplierLedger,
  SupplierWithBalance,
} from './suppliers.repository';
import { PaginationMeta } from '../../shared/apiResponse';

export async function listSuppliers(query: SupplierQuery): Promise<{
  data: SupplierWithBalance[];
  meta: PaginationMeta;
}> {
  const { rows, total } = await findAllSuppliers(query);
  return {
    data: rows,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function getSupplier(id: string): Promise<SupplierWithBalance> {
  const supplier = await findSupplierById(id);
  if (!supplier) throw new NotFoundError('Supplier');
  return supplier;
}

export async function addSupplier(
  data: CreateSupplierInput,
  createdBy: string,
): Promise<SupplierWithBalance> {
  return createSupplier(data, createdBy);
}

export async function editSupplier(
  id: string,
  data: UpdateSupplierInput,
): Promise<SupplierWithBalance> {
  await getSupplier(id);
  const updated = await updateSupplier(id, data);
  if (!updated) throw new NotFoundError('Supplier');
  return updated;
}

export async function deactivateSupplier(id: string): Promise<void> {
  await getSupplier(id);
  await softDeleteSupplier(id);
}

export async function getSupplierLedger(id: string) {
  await getSupplier(id);
  return repoGetSupplierLedger(id);
}
