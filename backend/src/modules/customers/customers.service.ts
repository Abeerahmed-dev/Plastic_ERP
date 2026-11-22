import { NotFoundError, ConflictError, ValidationError } from '../../shared/errors';
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
  const customer = await getCustomer(id); // throws 404 if not found
  if (
    customer.name === 'Walk-in Cash Customer' &&
    data.customer_type !== undefined &&
    data.customer_type !== 'CASH'
  ) {
    throw new ValidationError("Cannot change customer type of 'Walk-in Cash Customer'");
  }
  const updated = await updateCustomer(id, data);
  if (!updated) throw new NotFoundError('Customer');
  return updated;
}

export async function deactivateCustomer(id: string): Promise<void> {
  const customer = await getCustomer(id);
  if (customer.name === 'Walk-in Cash Customer') {
    throw new ValidationError("Cannot delete or deactivate 'Walk-in Cash Customer'");
  }
  await softDeleteCustomer(id);
}

export async function fetchCustomerStatement(id: string) {
  await getCustomer(id); // ensure exists
  const { getCustomerStatement } = await import('./customers.repository');
  return await getCustomerStatement(id);
}

export async function fetchCustomerLedger(id: string) {
  return await fetchCustomerStatement(id);
}

export async function getCustomerRefundableCredits(id: string) {
  await getCustomer(id);
  const { getCustomerRefundableCredits: repoGetCustomerRefundableCredits } = await import('./customers.repository');
  return await repoGetCustomerRefundableCredits(id);
}

