import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import { CreateEmployeeSchema, UpdateEmployeeSchema, EmployeeQuerySchema } from './employees.schemas';
import { employeesService } from './employees.service';

export async function createEmployeeController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = CreateEmployeeSchema.parse(req.body);
    const employee = await employeesService.create(parsed);
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
