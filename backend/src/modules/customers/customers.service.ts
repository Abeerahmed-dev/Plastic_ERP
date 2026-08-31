import { NotFoundError, ConflictError } from '../../shared/errors';
import { CreateCustomerInput, UpdateCustomerInput, CustomerQuery } from './customers.schemas';
import {
  findAllCustomers,
  findCustomerById,
  createCustomer,
  updateCustomer,
  softDeleteCustomer,
  CustomerWithBalance,
} from './customers.repository';
import { PaginationMeta } from '../../shared/apiResponse';

export async function listCustomers(query: CustomerQuery): Promise<{
  data: CustomerWithBalance[];
  meta: PaginationMeta;
}> {
  const { rows, total } = await findAllCustomers(query);
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

export async function getCustomer(id: string): Promise<CustomerWithBalance> {
  const customer = await findCustomerById(id);
  if (!customer) throw new NotFoundError('Customer');
  return customer;
}

export async function addCustomer(
  data: CreateCustomerInput,
  createdBy: string,
): Promise<CustomerWithBalance> {
  // Validate email uniqueness if provided
  if (data.email) {
    const { findAllCustomers: findByEmail } = await import('./customers.repository');
    const existing = await findByEmail({ page: 1, limit: 1, search: data.email, is_active: undefined });
    const emailMatch = existing.rows.find(
      (c) => c.email?.toLowerCase() === data.email?.toLowerCase(),
    );
    if (emailMatch) throw new ConflictError(`A customer with email "${data.email}" already exists`);
  }

  return createCustomer(data, createdBy);
}

export async function editCustomer(
  id: string,
  data: UpdateCustomerInput,
): Promise<CustomerWithBalance> {
  await getCustomer(id); // throws 404 if not found
  const updated = await updateCustomer(id, data);
  if (!updated) throw new NotFoundError('Customer');
  return updated;
}

export async function deactivateCustomer(id: string): Promise<void> {
  await getCustomer(id);
  await softDeleteCustomer(id);
}

export async function fetchCustomerLedger(id: string) {
  await getCustomer(id); // ensure exists
  const { getCustomerLedger } = await import('./customers.repository');
  return await getCustomerLedger(id);
}
