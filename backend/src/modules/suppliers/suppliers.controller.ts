import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import {
  createSupplierSchema,
  updateSupplierSchema,
  supplierQuerySchema,
} from './suppliers.schemas';
import * as suppliersService from './suppliers.service';

export async function listSuppliersController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = supplierQuerySchema.parse(req.query);
    const { data, meta } = await suppliersService.listSuppliers(query);
    res.status(200).json(ok(data, meta));
  } catch (err) { next(err); }
}

export async function getSupplierController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const supplier = await suppliersService.getSupplier(req.params.id);
    res.status(200).json(ok(supplier));
  } catch (err) { next(err); }
}

export async function createSupplierController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createSupplierSchema.parse(req.body);
    const supplier = await suppliersService.addSupplier(data, req.user!.id);
    res.status(201).json(ok(supplier));
  } catch (err) { next(err); }
}

export async function updateSupplierController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = updateSupplierSchema.parse(req.body);
    const supplier = await suppliersService.editSupplier(req.params.id, data);
    res.status(200).json(ok(supplier));
  } catch (err) { next(err); }
}

export async function deleteSupplierController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await suppliersService.deactivateSupplier(req.params.id);
    res.json(ok({ deleted: true }));
  } catch (error: any) {
    next(error);
  }
}

export async function getSupplierLedgerController(req: Request, res: Response) {
  try {
    const ledger = await suppliersService.getSupplierLedger(req.params.id);
    res.json({ success: true, data: ledger });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
