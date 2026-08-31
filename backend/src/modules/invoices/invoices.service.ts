import * as invoicesRepo from './invoices.repository';
import { CreateInvoiceInput } from './invoices.schemas';
import { NotFoundError } from '../../shared/errors';

export async function createInvoice(input: CreateInvoiceInput, userId?: string) {
  const invoiceNumber = await invoicesRepo.generateNextInvoiceNumber();
  const invoiceId = await invoicesRepo.createInvoiceWithItems(input, invoiceNumber, userId);
  return await getInvoice(invoiceId);
}

export async function getInvoices() {
  return await invoicesRepo.findAllInvoices();
}

export async function getInvoice(id: string) {
  const invoice = await invoicesRepo.findInvoiceById(id);
  if (!invoice) throw new NotFoundError('Invoice not found');
  return invoice;
}
