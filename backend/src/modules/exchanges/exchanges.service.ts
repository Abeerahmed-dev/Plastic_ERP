import * as exchangesRepo from './exchanges.repository';
import { CreateExchangeInput, ExchangeQuery } from './exchanges.schemas';

export async function createExchange(payload: CreateExchangeInput, userId?: string) {
  return await exchangesRepo.createExchangeTransaction(payload, userId);
}

export async function listExchanges(query: ExchangeQuery) {
  return await exchangesRepo.findExchanges(query);
}

export async function getExchangeById(id: string) {
  return await exchangesRepo.findExchangeById(id);
}
