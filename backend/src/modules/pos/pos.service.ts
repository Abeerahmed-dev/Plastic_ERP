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
  const deliveryCharges = Number(data.delivery_charges ?? data.delivery_charge ?? 0);
  const isAllReturns = data.items && data.items.length > 0 && data.items.every((i) => Number(i.quantity) < 0);
  const slipCharges = isAllReturns && data.slip_charges === undefined ? 0 : Number(data.slip_charges ?? 2);
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
    data.split_bank_amount,
    deliveryCharges,
    slipCharges,
    {
      offline_id: data.offline_id || undefined,
      offline_timestamp: data.offline_timestamp || undefined,
    }
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


