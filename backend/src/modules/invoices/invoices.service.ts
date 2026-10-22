import * as invoicesRepo from './invoices.repository';
import { CreateInvoiceInput, CreateSalesReturnInput } from './invoices.schemas';
import { NotFoundError } from '../../shared/errors';

export async function createInvoice(input: CreateInvoiceInput, userId?: string) {
  const invoiceNumber = await invoicesRepo.generateNextInvoiceNumber();
  const invoiceId = await invoicesRepo.createInvoiceWithItems(input, invoiceNumber, userId);
  return await getInvoice(invoiceId);
}

export async function getInvoices(filter?: { created_by?: string; is_pos_only?: boolean }) {
  return await invoicesRepo.findAllInvoices(filter);
}

export async function getInvoice(id: string) {
  const invoice = await invoicesRepo.findInvoiceById(id);
  if (!invoice) throw new NotFoundError('Invoice not found');
  return invoice;
}

export async function getInvoiceReturnSummary(id: string) {
  return await invoicesRepo.getInvoiceReturnSummary(id);
}

export async function processSalesReturn(id: string, input: CreateSalesReturnInput, userId?: string) {
  return await invoicesRepo.processSalesReturn(id, input, userId);
}

export async function getPendingDeliveries(query?: { status?: string; product_id?: string }) {
  return await invoicesRepo.getPendingDeliveries(query);
}

