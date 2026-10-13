import { processPOSCheckout, getTodayCashTally, getCashierShiftAudit, getPosInvoicesList } from './pos.repository';
import { CheckoutInput } from './pos.schemas';

export async function checkout(userId: string, data: CheckoutInput, userRole?: string) {
  const invoice = await processPOSCheckout(
    userId,
    data.items,
    data.discount || 0,
    userRole,
    data.customer_id,
    data.amount_paid,
    data.payment_method,
    data.bank_account_id
  );
  return invoice;
}

export async function getCashTallyForUser(userId: string) {
  return await getTodayCashTally(userId);
}

export async function getCashierShiftAuditForUser(userId: string) {
  return await getCashierShiftAudit(userId);
}

export async function getPosInvoices(filter?: { created_by?: string }) {
  return await getPosInvoicesList(filter);
}


