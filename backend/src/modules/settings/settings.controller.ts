import { Request, Response, NextFunction } from 'express';
import * as settingsService from './settings.service';
import { ok } from '../../shared/apiResponse';

export async function getFeatureAccessHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const access = await settingsService.getCashierFeatureAccess();
    res.json(ok(access));
  } catch (err) {
    next(err);
  }
}

export async function updateFeatureAccessHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { customer_access, party_access } = req.body;
    const access = await settingsService.updateCashierFeatureAccess({
      customer_access,
      party_access,
    });
    res.json(ok(access));
  } catch (err) {
    next(err);
  }
}

