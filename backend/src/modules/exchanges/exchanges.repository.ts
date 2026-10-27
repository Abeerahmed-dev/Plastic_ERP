import type { Knex } from 'knex';
import db from '../../db/knex';
import { CreateExchangeInput, ExchangeQuery } from './exchanges.schemas';
import { NotFoundError, ValidationError, InsufficientStockError } from '../../shared/errors';

export interface ProductExchangeRow {
  id: string;
  exchange_number: string;
  exchange_date: string;
  given_product_id: string;
  given_quantity: number;
  given_unit_cost: number;
  received_product_id: string;
  received_quantity: number;
  received_unit_cost: number;
  notes: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  given_product_name?: string;
  given_product_code?: string;
  given_product_size?: string;
  received_product_name?: string;
  received_product_code?: string;
  received_product_size?: string;
  created_by_name?: string;
}

export async function generateNextExchangeNumber(trx: Knex.Transaction | Knex = db): Promise<string> {
  const rows = await trx('product_exchanges')
    .where('exchange_number', 'like', 'EXCH-%')
    .select('exchange_number');

  let maxNum = 0;
  for (const r of rows) {
    if (r.exchange_number) {
      const numPart = r.exchange_number.replace('EXCH-', '');
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }

  return `EXCH-${(maxNum + 1).toString().padStart(5, '0')}`;
}

export async function createExchangeTransaction(
  payload: CreateExchangeInput,
  userId?: string,
): Promise<ProductExchangeRow> {
  return await db.transaction(async (trx) => {
    if (payload.given_product_id === payload.received_product_id) {
      throw new ValidationError('Cannot exchange a product for itself.');
    }

    if (payload.given_quantity <= 0 || payload.received_quantity <= 0) {
      throw new ValidationError('Given and received quantities must be greater than zero.');
    }

    // Deadlock Prevention: lock product rows in consistent order
    const [firstId, secondId] = [payload.given_product_id, payload.received_product_id].sort();
    await trx('products').where({ id: firstId }).forUpdate();
    await trx('products').where({ id: secondId }).forUpdate();

    const givenProduct = await trx('products')
      .where({ id: payload.given_product_id })
      .first();

    if (!givenProduct) {
      throw new NotFoundError(`Outgoing product with ID ${payload.given_product_id}`);
    }

    const receivedProduct = await trx('products')
      .where({ id: payload.received_product_id })
      .first();

    if (!receivedProduct) {
      throw new NotFoundError(`Incoming product with ID ${payload.received_product_id}`);
    }

    if (!givenProduct.is_active) {
      throw new ValidationError(`Outgoing product "${givenProduct.name}" is deactivated and cannot be exchanged.`);
    }

    if (!receivedProduct.is_active) {
      throw new ValidationError(`Incoming product "${receivedProduct.name}" is deactivated and cannot be exchanged.`);
    }

    const liveAvailableStock = Number(givenProduct.total_stock_kg || 0);
    if (liveAvailableStock < payload.given_quantity) {
      throw new InsufficientStockError(
        liveAvailableStock,
        `Insufficient stock for "${givenProduct.name}". Available stock is ${liveAvailableStock} KG, but ${payload.given_quantity} KG was requested to exchange.`,
      );
    }

    // ── FIFO Price-Bucket Stock Deduction for Outgoing Product ──
    let kgToDeduct = payload.given_quantity;
    let totalGivenCost = 0;

    const activeBuckets = await trx('inventory_batches')
      .where('product_id', payload.given_product_id)
      .andWhere('remaining_qty', '>', 0)
      .orderBy('created_at', 'asc');

    for (const bucket of activeBuckets) {
      if (kgToDeduct <= 0) break;
      const available = Number(bucket.remaining_qty || 0);
      const buyPrice = Number(bucket.batch_buy_price_per_kg || 0);

      if (available >= kgToDeduct) {
        const newRemaining = available - kgToDeduct;
        await trx('inventory_batches')
          .where('id', bucket.id)
          .update({
            remaining_qty: newRemaining,
            status: newRemaining <= 0 ? 'DEPLETED' : 'ACTIVE',
            updated_at: new Date(),
          });
        totalGivenCost += kgToDeduct * buyPrice;
        kgToDeduct = 0;
        break;
      } else {
        await trx('inventory_batches')
          .where('id', bucket.id)
          .update({
            remaining_qty: 0,
            status: 'DEPLETED',
            updated_at: new Date(),
          });
        totalGivenCost += available * buyPrice;
        kgToDeduct -= available;
      }
    }

    // Fallback valuation if tracked batches were less than total_stock_kg
    if (kgToDeduct > 0) {
      const fallbackCost = Number(givenProduct.rolling_avg_cost_per_kg || givenProduct.cost_price || 0);
      totalGivenCost += kgToDeduct * fallbackCost;
    }

    const givenUnitCost =
      payload.given_quantity > 0
        ? Math.round((totalGivenCost / payload.given_quantity) * 10000) / 10000
        : Number(givenProduct.rolling_avg_cost_per_kg || givenProduct.cost_price || 0);

    // Deduct stock from outgoing product
    await trx('products')
      .where({ id: payload.given_product_id })
      .update({
        total_stock_kg: trx.raw('GREATEST(0, total_stock_kg - ?)', [payload.given_quantity]),
        updated_at: new Date(),
      });

    // ── Incoming Product Stock Addition & WAC Calculation ──
    const receivedUnitCost = Number(
      receivedProduct.rolling_avg_cost_per_kg || receivedProduct.cost_price || givenUnitCost || 0,
    );

    const curRecStock = Number(receivedProduct.total_stock_kg || 0);
    const curRecAvg = Number(receivedProduct.rolling_avg_cost_per_kg || 0);
    const curRecTotalVal = curRecStock * curRecAvg;
    const incomingVal = payload.received_quantity * receivedUnitCost;
    const newRecTotalStock = curRecStock + payload.received_quantity;

    const newRecRollingAvg =
      newRecTotalStock > 0
        ? Math.round(((curRecTotalVal + incomingVal) / newRecTotalStock) * 10000) / 10000
        : (curRecAvg > 0 ? curRecAvg : receivedUnitCost);

    // Update incoming product stock
    await trx('products')
      .where({ id: payload.received_product_id })
      .update({
        total_stock_kg: newRecTotalStock,
        rolling_avg_cost_per_kg: newRecRollingAvg,
        updated_at: new Date(),
      });

    // ── Generate Exchange Reference Number ──
    const exchangeNumber = await generateNextExchangeNumber(trx);

    // ── Create Price-Bucket for Received Product ──
    const batchNum = `PB-EXCH-${exchangeNumber}-${Date.now().toString().slice(-4)}`;
    const recSize = (receivedProduct.size && String(receivedProduct.size).trim().length > 0)
      ? String(receivedProduct.size).trim()
      : 'Standard';

    await trx('inventory_batches').insert({
      product_id: payload.received_product_id,
      batch_number: batchNum,
      batch_buy_price_per_kg: Math.round(receivedUnitCost * 100) / 100,
      original_qty: payload.received_quantity,
      remaining_qty: payload.received_quantity,
      status: 'ACTIVE',
      size: recSize,
    });

    // ── Record Inventory Ledger Transactions ──
    // 1. Outgoing stock deduction
    await trx('inventory_transactions').insert({
      product_id: payload.given_product_id,
      transaction_type: 'ADJUSTMENT',
      quantity_kg: payload.given_quantity,
      unit_cost: givenUnitCost,
      total_asset_value: Math.round(totalGivenCost * 100) / 100,
      capital_equity_value: 0,
      notes: `Product Exchange ${exchangeNumber}: Dispatched ${payload.given_quantity} KG of ${givenProduct.name} (exchanged for ${payload.received_quantity} KG of ${receivedProduct.name})`,
      created_by: userId || null,
    });

    // 2. Incoming stock addition
    await trx('inventory_transactions').insert({
      product_id: payload.received_product_id,
      transaction_type: 'ADJUSTMENT',
      quantity_kg: payload.received_quantity,
      unit_cost: receivedUnitCost,
      total_asset_value: Math.round(incomingVal * 100) / 100,
      capital_equity_value: 0,
      notes: `Product Exchange ${exchangeNumber}: Received ${payload.received_quantity} KG of ${receivedProduct.name} (in exchange for ${payload.given_quantity} KG of ${givenProduct.name})`,
      created_by: userId || null,
    });

    // ── Insert Exchange Record ──
    const [inserted] = await trx('product_exchanges')
      .insert({
        exchange_number: exchangeNumber,
        exchange_date: payload.exchange_date ? new Date(payload.exchange_date) : new Date(),
        given_product_id: payload.given_product_id,
        given_quantity: payload.given_quantity,
        given_unit_cost: givenUnitCost,
        received_product_id: payload.received_product_id,
        received_quantity: payload.received_quantity,
        received_unit_cost: receivedUnitCost,
        notes: payload.notes || null,
        status: 'COMPLETED',
        created_by: userId || null,
      })
      .returning('*');

    return {
      ...inserted,
      given_quantity: Number(inserted.given_quantity),
      given_unit_cost: Number(inserted.given_unit_cost),
      received_quantity: Number(inserted.received_quantity),
      received_unit_cost: Number(inserted.received_unit_cost),
      given_product_name: givenProduct.name,
      given_product_code: givenProduct.code,
      given_product_size: givenProduct.size,
      received_product_name: receivedProduct.name,
      received_product_code: receivedProduct.code,
      received_product_size: receivedProduct.size,
    };
  });
}

export async function findExchanges(query: ExchangeQuery): Promise<{
  rows: ProductExchangeRow[];
  total: number;
}> {
  const { page, limit, search, startDate, endDate } = query;
  const offset = (page - 1) * limit;

  const baseQuery = db('product_exchanges as pe')
    .leftJoin('products as gp', 'pe.given_product_id', 'gp.id')
    .leftJoin('products as rp', 'pe.received_product_id', 'rp.id')
    .leftJoin('users as u', 'pe.created_by', 'u.id')
    .modify((qb) => {
      if (search) {
        const term = `%${search}%`;
        qb.where((inner) => {
          inner
            .whereILike('pe.exchange_number', term)
            .orWhereILike('gp.name', term)
            .orWhereILike('gp.code', term)
            .orWhereILike('rp.name', term)
            .orWhereILike('rp.code', term)
            .orWhereILike('pe.notes', term);
        });
      }
      if (startDate) {
        qb.where('pe.exchange_date', '>=', new Date(startDate));
      }
      if (endDate) {
        qb.where('pe.exchange_date', '<=', new Date(endDate));
      }
    });

  const [{ count }] = await baseQuery.clone().count<[{ count: string }]>('pe.id as count');
  const total = parseInt(count, 10);

  const rows = await baseQuery
    .clone()
    .select(
      'pe.*',
      'gp.name as given_product_name',
      'gp.code as given_product_code',
      'gp.size as given_product_size',
      'rp.name as received_product_name',
      'rp.code as received_product_code',
      'rp.size as received_product_size',
      'u.name as created_by_name',
    )
    .orderBy('pe.exchange_date', 'desc')
    .orderBy('pe.created_at', 'desc')
    .limit(limit)
    .offset(offset);

  const mapped: ProductExchangeRow[] = rows.map((r: any) => ({
    ...r,
    given_quantity: Number(r.given_quantity || 0),
    given_unit_cost: Number(r.given_unit_cost || 0),
    received_quantity: Number(r.received_quantity || 0),
    received_unit_cost: Number(r.received_unit_cost || 0),
  }));

  return { rows: mapped, total };
}

export async function findExchangeById(id: string): Promise<ProductExchangeRow | undefined> {
  const row = await db('product_exchanges as pe')
    .leftJoin('products as gp', 'pe.given_product_id', 'gp.id')
    .leftJoin('products as rp', 'pe.received_product_id', 'rp.id')
    .leftJoin('users as u', 'pe.created_by', 'u.id')
    .where('pe.id', id)
    .select(
      'pe.*',
      'gp.name as given_product_name',
      'gp.code as given_product_code',
      'gp.size as given_product_size',
      'rp.name as received_product_name',
      'rp.code as received_product_code',
      'rp.size as received_product_size',
      'u.name as created_by_name',
    )
    .first();

  if (!row) return undefined;

  return {
    ...row,
    given_quantity: Number(row.given_quantity || 0),
    given_unit_cost: Number(row.given_unit_cost || 0),
    received_quantity: Number(row.received_quantity || 0),
    received_unit_cost: Number(row.received_unit_cost || 0),
  };
}
