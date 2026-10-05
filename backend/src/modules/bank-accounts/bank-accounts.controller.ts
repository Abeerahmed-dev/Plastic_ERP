import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import { ValidationError } from '../../shared/errors';
import { createBankAccountSchema, updateBankAccountSchema } from './bank-accounts.schemas';
import * as bankService from './bank-accounts.service';

export async function listBankAccountsController(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await bankService.listBankAccounts();
    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}

export async function getBankAccountController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await bankService.getBankAccount(req.params.id);
    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}

export async function createBankAccountController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = createBankAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const data = await bankService.addBankAccount(parsed.data);
    res.status(201).json(ok(data));
  } catch (err) {
    next(err);
  }
}

export async function updateBankAccountController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateBankAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map((e) => e.message).join(', '));
    }
    const data = await bankService.editBankAccount(req.params.id, parsed.data);
    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}

export async function deleteBankAccountController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await bankService.removeBankAccount(req.params.id);
    res.status(200).json(ok({ message: 'Bank account deactivated successfully' }));
  } catch (err) {
    next(err);
  }
}

export async function getBankAccountTransactionsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const accountId = req.params.accountId || req.params.id;
    const data = await bankService.getBankAccountTransactions(accountId);
    res.status(200).json(ok(data));
  } catch (err) {
    next(err);
  }
}
