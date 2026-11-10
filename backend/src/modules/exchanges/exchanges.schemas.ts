import { z } from 'zod';

export const createExchangeSchema = z
  .object({
    // ── Invoice Line Item Exchange Fields (Atomic Return + Re-Sale) ──
    sales_invoice_item_id: z.string().uuid({ message: 'Valid sales invoice item ID is required' }).optional(),
    original_item_id: z.string().uuid().optional(),
    invoice_id: z.string().uuid().optional(),
    returned_quantity: z.coerce.number().positive({ message: 'Returned quantity must be greater than zero' }).optional(),
    returned_qty: z.coerce.number().positive().optional(),
    new_product_id: z.string().uuid({ message: 'Valid new product ID is required' }).optional(),
    new_quantity: z.coerce.number().positive({ message: 'New quantity must be greater than zero' }).optional(),
    new_unit_price: z.coerce.number().nonnegative().optional(),
    size: z.string().optional(),
    selected_unit: z.string().optional(),
    allow_backorder: z.boolean().optional(),

    // ── Standalone / Fallback Exchange Fields ──
    given_product_id: z.string().uuid({ message: 'Valid outgoing product ID is required' }).optional(),
    given_quantity: z.coerce.number().positive({ message: 'Outgoing quantity must be greater than zero' }).optional(),
    received_product_id: z.string().uuid({ message: 'Valid incoming product ID is required' }).optional(),
    received_quantity: z.coerce.number().positive({ message: 'Incoming quantity must be greater than zero' }).optional(),

    // ── Common Metadata ──
    exchange_date: z.string().optional(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine(
    (data) => {
      const isInvoiceExchange = Boolean(
        data.sales_invoice_item_id || data.original_item_id || data.invoice_id
      );

      if (isInvoiceExchange) {
        const retQty = data.returned_quantity ?? data.returned_qty ?? data.received_quantity;
        const newProd = data.new_product_id ?? data.given_product_id;
        const newQty = data.new_quantity ?? data.given_quantity;

        return Boolean(retQty && retQty > 0 && newProd && newQty && newQty > 0);
      }

      // Standalone exchange validation: both given and received must be specified and different
      if (!data.given_product_id || !data.received_product_id) {
        return false;
      }
      if (data.given_product_id === data.received_product_id) {
        return false;
      }
      if (!data.given_quantity || data.given_quantity <= 0) {
        return false;
      }
      if (!data.received_quantity || data.received_quantity <= 0) {
        return false;
      }
      return true;
    },
    {
      message: 'Invalid exchange payload. Please specify an invoice line item to return and replacement product, or valid distinct exchange products.',
      path: ['received_product_id'],
    }
  );

export type CreateExchangeInput = z.infer<typeof createExchangeSchema>;

export const exchangeQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ExchangeQuery = z.infer<typeof exchangeQuerySchema>;
