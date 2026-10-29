import * as repo from './purchases.repository';
import { PurchaseInvoiceQuery } from './purchases.repository';

export async function getPurchaseInvoices(query: PurchaseInvoiceQuery) {
  return await repo.findAllPurchaseInvoices(query);
}

export async function getPurchaseInvoiceById(id: string) {
  const invoice = await repo.findPurchaseInvoiceById(id);
  if (!invoice) throw new Error('Purchase Invoice not found');
  return invoice;
}

export async function createPurchaseInvoice(data: any, createdBy: string) {
  return await repo.createPurchaseInvoice(data, createdBy);
}

export async function updatePurchaseInvoiceStatus(id: string, updateData: { status?: string; paid_amount?: number }) {
  return await repo.updatePurchaseInvoiceStatus(id, updateData);
}

export async function processPurchaseReturn(
  input: {
    parent_invoice_id: string;
    items?: { product_id: string; return_quantity?: number; quantity?: number }[];
    line_items?: { product_id: string; return_quantity?: number; quantity?: number }[];
    return_reason?: string;
  },
  userId?: string
) {
  return await repo.processPurchaseReturn(input, userId);
}

export async function getPurchaseInvoiceReturnSummary(parentInvoiceId: string) {
  return await repo.getPurchaseInvoiceReturnSummary(parentInvoiceId);
}

export async function getRecentPurchasesForStockUpdate(limit: number = 20) {
  return await repo.getRecentPurchasesForStockUpdate(limit);
}

export async function updateStockDcAndPrices(
  purchaseId: string,
  payload: {
    delivery_charges?: number;
    items: Array<{
      product_id: string;
      selling_price: number;
    }>;
  },
  userId?: string
) {
  return await repo.updateStockDcAndPrices(purchaseId, payload, userId);
}
