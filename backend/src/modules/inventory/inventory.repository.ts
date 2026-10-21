import db from '../../db/knex';

export interface LowStockVariant {
  id: string;
  name: string;
  code: string;
  size: string;
  total_stock_kg: number;
  low_stock_threshold: number;
  deficit_kg: number;
  cost_price: number;
  sale_price: number;
  category_id: string;
  category_name: string;
  bag_weight_kg: number;
}

export async function findLowStockVariants(): Promise<LowStockVariant[]> {
  const rows = await db('products as p')
    .join('categories as c', 'p.category_id', 'c.id')
    .where('p.is_active', true)
    .where('p.low_stock_threshold', '>', 0)
    .whereRaw('p.total_stock_kg <= p.low_stock_threshold')
    .select(
      'p.id',
      'p.name',
      'p.code',
      'p.size',
      'p.total_stock_kg',
      'p.low_stock_threshold',
      'p.cost_price',
      'p.sale_price',
      'p.category_id',
      'c.name as category_name',
      'c.bag_weight_kg'
    )
    .orderByRaw('(p.total_stock_kg - p.low_stock_threshold) ASC')
    .orderBy('p.name', 'ASC');

  return rows.map((r: any) => {
    const totalStock = Number(r.total_stock_kg || 0);
    const threshold = Number(r.low_stock_threshold || 0);
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      size: r.size || 'Standard',
      total_stock_kg: Math.round(totalStock * 100) / 100,
      low_stock_threshold: Math.round(threshold * 100) / 100,
      deficit_kg: Math.max(0, Math.round((threshold - totalStock) * 100) / 100),
      cost_price: Number(r.cost_price || 0),
      sale_price: Number(r.sale_price || 0),
      category_id: r.category_id,
      category_name: r.category_name,
      bag_weight_kg: Number(r.bag_weight_kg || 25),
    };
  });
}
