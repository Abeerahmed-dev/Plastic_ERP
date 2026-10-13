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

export async function clearIncomingPdcController(req: Request, res: Response): Promise<void> {
  try {
    const updated = await incomingPdcsRepository.clearIncomingPdc(req.params.id);
    res.status(200).json(ok(updated));
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to clear PDC' });
  }
}

export async function bounceIncomingPdcController(req: Request, res: Response): Promise<void> {
  try {
    const updated = await incomingPdcsRepository.bounceIncomingPdc(req.params.id);
    res.status(200).json(ok(updated));
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Failed to bounce PDC' });
  }
}
