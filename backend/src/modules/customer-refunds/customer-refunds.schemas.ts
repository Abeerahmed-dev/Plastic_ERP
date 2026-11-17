import { z } from 'zod';

export const createCustomerRefundSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  amount: z.coerce.number().positive('Refund amount must be greater than zero'),
  source: z.string().default('CASH_DRAWER'), // 'CASH_DRAWER' or bank_account_id
  notes: z.string().optional().default('Refunded cash to customer from Advance Wallet'),
  refund_date: z.string().optional(),
  linked_invoice_id: z.string().uuid().optional().nullable(),
});

export type CreateCustomerRefundInput = z.infer<typeof createCustomerRefundSchema>;
