import { Request, Response, NextFunction } from 'express';
import * as usersService from './users.service';
import { createUserSchema, updateUserSchema } from './users.schemas';
import { ok } from '../../shared/apiResponse';
import { ValidationError } from '../../shared/errors';

export async function listUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await usersService.getUsers();
    res.json(ok(users));
  } catch (error) {
    next(error);
  }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await usersService.getUser(req.params.id);
    res.json(ok(user));
  } catch (error) {
    next(error);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }

    const user = await usersService.createUser(parsed.data);
    res.status(201).json(ok(user));
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors.map(e => e.message).join(', '));
    }

    const user = await usersService.updateUser(req.params.id, parsed.data);
    res.json(ok(user));
  } catch (error) {
    next(error);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    await usersService.deleteUser(req.params.id);
    res.json(ok({ deleted: true }));
  } catch (error) {
    next(error);
  }
}

export async function listRoles(_req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await usersService.getRoles();
    res.json(ok(roles));
  } catch (error) {
    next(error);
  }
}
