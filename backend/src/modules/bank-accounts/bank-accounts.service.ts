import { NotFoundError } from '../../shared/errors';
import { CreateBankAccountInput, UpdateBankAccountInput } from './bank-accounts.schemas';
import * as bankRepo from './bank-accounts.repository';

export async function listBankAccounts() {
  return bankRepo.findAllBankAccounts();
}

export async function getBankAccount(id: string) {
  const account = await bankRepo.findBankAccountById(id);
  if (!account) throw new NotFoundError('Bank Account');
  return account;
}

export async function addBankAccount(data: CreateBankAccountInput) {
  return bankRepo.createBankAccount(data);
}

export async function editBankAccount(id: string, data: UpdateBankAccountInput) {
  const updated = await bankRepo.updateBankAccount(id, data);
  if (!updated) throw new NotFoundError('Bank Account');
  return updated;
}

export async function removeBankAccount(id: string) {
  const deleted = await bankRepo.softDeleteBankAccount(id);
  if (!deleted) throw new NotFoundError('Bank Account');
}

export async function getBankAccountTransactions(accountId: string) {
  return bankRepo.getBankAccountTransactions(accountId);
}
