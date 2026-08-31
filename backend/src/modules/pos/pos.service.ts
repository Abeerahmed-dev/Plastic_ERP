import { processPOSCheckout } from './pos.repository';
import { CheckoutInput } from './pos.schemas';

export async function checkout(userId: string, data: CheckoutInput) {
  const invoice = await processPOSCheckout(userId, data.items, data.discount);

  // TODO: Add audit log if/when audit_logs table is created
  
  return invoice;
}
