import { Request, Response, NextFunction } from 'express';
import { loginSchema, refreshSchema, logoutSchema } from './auth.schemas';
import * as authService from './auth.service';
import { ok } from '../../shared/apiResponse';

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input.email, input.password);
    res.status(200).json(ok(result));
  } catch (err) {
    next(err);
  }
}

export async function refreshController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = refreshSchema.parse(req.body);
    const result = await authService.refresh(input.refresh_token);
    res.status(200).json(ok(result));
  } catch (err) {
    next(err);
  }
}

export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = logoutSchema.parse(req.body ?? {});
    // req.user is guaranteed by requireAuth middleware on this route
    await authService.logout(req.user!.id, input.refresh_token);
    res.status(200).json(ok({ message: 'Logged out successfully' }));
  } catch (err) {
    next(err);
  }
}

export async function meController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.getMe(req.user!.id);
    res.status(200).json(ok(result));
  } catch (err) {
    next(err);
  }
}
