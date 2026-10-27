import { z } from 'zod';

export const createExchangeSchema = z
  .object({
    given_product_id: z.string().uuid({ message: 'Valid outgoing product ID is required' }),
    given_quantity: z.coerce
      .number()
      .positive({ message: 'Outgoing quantity must be greater than zero' }),
    received_product_id: z.string().uuid({ message: 'Valid incoming product ID is required' }),
    received_quantity: z.coerce
      .number()
      .positive({ message: 'Incoming quantity must be greater than zero' }),
    exchange_date: z.string().optional(),
    notes: z.string().max(1000).optional().nullable(),
  })
  .refine((data) => data.given_product_id !== data.received_product_id, {
    message: 'The outgoing product and incoming product cannot be the same',
    path: ['received_product_id'],
  });

export type CreateExchangeInput = z.infer<typeof createExchangeSchema>;

export const exchangeQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type ExchangeQuery = z.infer<typeof exchangeQuerySchema>;
