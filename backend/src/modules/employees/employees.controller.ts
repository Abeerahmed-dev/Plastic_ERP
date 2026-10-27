import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  EmployeeQuerySchema,
  CreateEmployeeLedgerEntrySchema,
} from './employees.schemas';
import { employeesService } from './employees.service';

export async function createEmployeeController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = CreateEmployeeSchema.parse(req.body);
    const userId = (req as any).user?.id;
    const employee = await employeesService.create(parsed, userId);
    res.status(201).json(ok(employee));
  } catch (err) {
    next(err);
  }
}

export async function listEmployeesController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const query = EmployeeQuerySchema.parse(req.query);
    const employees = await employeesService.getAll(query);
    res.status(200).json(ok(employees));
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeByIdController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const employee = await employeesService.getById(req.params.id);
    res.status(200).json(ok(employee));
  } catch (err) {
    next(err);
  }
}

export async function updateEmployeeController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = UpdateEmployeeSchema.parse(req.body);
    const employee = await employeesService.update(req.params.id, parsed);
    res.status(200).json(ok(employee));
  } catch (err) {
    next(err);
  }
}

export async function deleteEmployeeController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await employeesService.delete(req.params.id);
    res.status(200).json(ok({ message: 'Employee deleted successfully' }));
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeLedgerController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const month = req.query.month as string | undefined;
    const ledger = await employeesService.getLedger(req.params.id, month);
    res.status(200).json(ok(ledger));
  } catch (err) {
    next(err);
  }
}

export async function addEmployeeLedgerEntryController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = CreateEmployeeLedgerEntrySchema.parse(req.body);
    const userId = (req as any).user?.id;
    const entry = await employeesService.addLedgerEntry(req.params.id, parsed, userId);
    res.status(201).json(ok(entry));
  } catch (err) {
    next(err);
  }
}

export async function deleteEmployeeLedgerEntryController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await employeesService.deleteLedgerEntry(req.params.entryId);
    res.status(200).json(ok({ message: 'Ledger entry deleted successfully' }));
  } catch (err) {
    next(err);
  }
}

