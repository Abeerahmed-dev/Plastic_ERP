import { Request, Response, NextFunction } from 'express';
import { ok } from '../../shared/apiResponse';
import { createExchangeSchema, exchangeQuerySchema } from './exchanges.schemas';
import * as exchangesService from './exchanges.service';
import { NotFoundError } from '../../shared/errors';

export async function createExchangeController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const payload = createExchangeSchema.parse(req.body);
    const userId = req.user?.id;

    const exchange = await exchangesService.createExchange(payload, userId);
    res.status(201).json(ok(exchange));
  } catch (err) {
    next(err);
  }
}

export async function listExchangesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = exchangeQuerySchema.parse(req.query);
    const result = await exchangesService.listExchanges(query);
    const totalPages = Math.ceil(result.total / query.limit) || 1;
    res.status(200).json(
      ok(result.rows, {
        total: result.total,
        page: query.page,
        limit: query.limit,
        totalPages,
      }),
    );
  } catch (err) {
    next(err);
  }
}

export async function getExchangeByIdController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const exchange = await exchangesService.getExchangeById(req.params.id);
    if (!exchange) {
      throw new NotFoundError('Exchange');
    }
    res.status(200).json(ok(exchange));
  } catch (err) {
    next(err);
  }
}
