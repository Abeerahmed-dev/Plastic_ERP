import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import * as incomingPdcsRepository from './incoming-pdcs.repository';

export async function listIncomingPdcsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const pdcs = await incomingPdcsRepository.findAllIncomingPdcs(status);
    res.status(200).json(ok(pdcs));
  } catch (err) {
    next(err);
  }
}

export async function createIncomingPdcController(req: Request, res: Response): Promise<void> {
  try {
    const {
      customer_id,
      amount,
      cheque_number,
      cheque_bank_name,
      cheque_due_date,
      payment_date,
      invoice_id,
      destination_bank_account_id,
      notes,
    } = req.body;

    const pdc = await incomingPdcsRepository.createIncomingPdc(
      {
        customer_id,
        amount: Number(amount),
        cheque_number,
        cheque_bank_name,
        cheque_due_date,
        payment_date,
        invoice_id: invoice_id || null,
        destination_bank_account_id: destination_bank_account_id || null,
        notes: notes || null,
      },
      (req as any).user?.id
    );

    res.status(201).json(ok(pdc));
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to create incoming PDC' });
  }
}

export async function clearIncomingPdcController(req: Request, res: Response): Promise<void> {
  try {
    const { bank_account_id } = req.body;
    const updated = await incomingPdcsRepository.clearIncomingPdc(req.params.id, bank_account_id);
    res.status(200).json(ok(updated));
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to clear PDC' });
  }
}

export async function bounceIncomingPdcController(req: Request, res: Response): Promise<void> {
  try {
    const { reason } = req.body;
    const updated = await incomingPdcsRepository.bounceIncomingPdc(req.params.id, reason);
    res.status(200).json(ok(updated));
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to bounce PDC' });
  }
}
