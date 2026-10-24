import {
  processPOSCheckout,
  getTodayCashTally,
  getCashierShiftAudit,
  getPosInvoicesList,
  createHeldOrder,
  getHeldOrdersList,
  deleteHeldOrder,
} from './pos.repository';
import { CheckoutInput, CreateHeldOrderInput } from './pos.schemas';

export async function checkout(userId: string, data: CheckoutInput, userRole?: string) {
  const invoice = await processPOSCheckout(
    userId,
    data.items,
    data.discount || 0,
    userRole,
    data.customer_id,
    data.amount_paid,
    data.payment_method,
    data.bank_account_id,
    data.split_cash_amount,
    data.split_bank_amount
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

export async function saveHeldOrder(userId: string, data: CreateHeldOrderInput) {
  return await createHeldOrder(data, userId);
}

export async function getHeldOrders() {
  return await getHeldOrdersList();
}

export async function removeHeldOrder(id: string) {
  return await deleteHeldOrder(id);
}


