import db from '../../db/knex';

export interface IncomingPdcRow {
  id: string;
  payment_id: string | null;
  customer_id: string;
  customer_name?: string;
  customer_code?: string;
  destination_bank_account_id: string | null;
  destination_bank_name?: string;
  destination_account_title?: string;
  destination_account_number?: string;
  cheque_number: string;
  cheque_bank_name: string;
  cheque_due_date: string;
  amount: number;
  status: 'PENDING' | 'CLEARED' | 'BOUNCED';
  notes: string | null;
  payment_number?: string;
  created_at: Date;
  updated_at: Date;
}

export async function findAllIncomingPdcs(status?: string): Promise<IncomingPdcRow[]> {
  const query = db('incoming_pdcs as p')
    .join('customers as c', 'p.customer_id', 'c.id')
    .leftJoin('bank_accounts as ba', 'p.destination_bank_account_id', 'ba.id')
    .leftJoin('customer_payments as cp', 'p.payment_id', 'cp.id');

  if (status) {
    query.where('p.status', status);
  }

  const rows = await query.select(
    'p.id',
    'p.payment_id',
    'p.customer_id',
    'c.name as customer_name',
    'c.code as customer_code',
    'p.destination_bank_account_id',
    'ba.bank_name as destination_bank_name',
    'ba.account_title as destination_account_title',
    'ba.account_number as destination_account_number',
    'p.cheque_number',
    'p.cheque_bank_name',
    'p.cheque_due_date',
    'p.amount',
    'p.status',
    'p.notes',
    'cp.payment_number',
    'p.created_at',
    'p.updated_at'
  ).orderBy('p.cheque_due_date', 'asc');

  return rows.map((r: any) => ({
    ...r,
    amount: Number(r.amount || 0),
  }));
}

export async function clearIncomingPdc(pdcId: string): Promise<IncomingPdcRow> {
  return await db.transaction(async (trx) => {
    const pdc = await trx('incoming_pdcs').where('id', pdcId).first();
    if (!pdc) {
      throw new Error('Incoming PDC not found');
    }

    if (pdc.status !== 'PENDING') {
      throw new Error(`Cannot clear cheque with status: ${pdc.status}`);
    }

    const [updatedPdc] = await trx('incoming_pdcs')
      .where('id', pdcId)
      .update({
        status: 'CLEARED',
        updated_at: trx.fn.now(),
      })
      .returning('*');

    if (pdc.payment_id) {
      await trx('customer_payments')
        .where('id', pdc.payment_id)
        .update({
          cheque_status: 'CLEARED',
          updated_at: trx.fn.now(),
        });
    }

    return {
      ...updatedPdc,
      amount: Number(updatedPdc.amount || 0),
    };
  });
}

export async function bounceIncomingPdc(pdcId: string): Promise<IncomingPdcRow> {
  return await db.transaction(async (trx) => {
    const pdc = await trx('incoming_pdcs').where('id', pdcId).first();
    if (!pdc) {
      throw new Error('Incoming PDC not found');
    }

    if (pdc.status !== 'PENDING') {
      throw new Error(`Cannot bounce cheque with status: ${pdc.status}`);
    }

    const [updatedPdc] = await trx('incoming_pdcs')
      .where('id', pdcId)
      .update({
        status: 'BOUNCED',
        updated_at: trx.fn.now(),
      })
      .returning('*');

    if (pdc.payment_id) {
      await trx('customer_payments')
        .where('id', pdc.payment_id)
        .update({
          cheque_status: 'BOUNCED',
          updated_at: trx.fn.now(),
        });
    }

    return {
      ...updatedPdc,
      amount: Number(updatedPdc.amount || 0),
    };
  });
}
