import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import {
  createCustomerSchema,
  updateCustomerSchema,
  customerQuerySchema,
} from './customers.schemas';
import * as customersService from './customers.service';

export async function listCustomersController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = customerQuerySchema.parse(req.query);
    const { data, meta } = await customersService.listCustomers(query);
    res.status(200).json(ok(data, meta));
  } catch (err) {
    next(err);
  }
}

export async function getCustomerController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const customer = await customersService.getCustomer(req.params.id);
    res.status(200).json(ok(customer));
  } catch (err) {
    next(err);
  }
}

export async function createCustomerController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = createCustomerSchema.parse(req.body);
    const customer = await customersService.addCustomer(data, req.user!.id);
    res.status(201).json(ok(customer));
  } catch (err) {
    next(err);
  }
}

export async function updateCustomerController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = updateCustomerSchema.parse(req.body);
    const customer = await customersService.editCustomer(req.params.id, data);
    res.status(200).json(ok(customer));
  } catch (err) {
    next(err);
  }
}

export async function deleteCustomerController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await customersService.deactivateCustomer(req.params.id);
    res.status(200).json(ok({ message: 'Customer deactivated successfully' }));
  } catch (err) {
    next(err);
  }
}

export async function getCustomerLedgerController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ledger = await customersService.fetchCustomerLedger(req.params.id);
    res.status(200).json(ok(ledger));
  } catch (err) {
    next(err);
  }
}
