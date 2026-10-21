import { NotFoundError } from '../../shared/errors';
import { CreateBankAccountInput, UpdateBankAccountInput, TransferFundsInput } from './bank-accounts.schemas';
import * as bankRepo from './bank-accounts.repository';

export async function listBankAccounts() {
  return bankRepo.findAllBankAccounts();
}

export async function getBankAccount(id: string) {
  const account = await bankRepo.findBankAccountById(id);
  if (!account) throw new NotFoundError('Bank Account');
  return account;
}

export async function addBankAccount(data: CreateBankAccountInput, userId?: string | null) {
  return bankRepo.createBankAccount(data, userId);
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

export async function getBankAccountTransactions(
  accountId: string,
  filter?: { source?: string; transaction_type?: string }
) {
  return bankRepo.getBankAccountTransactions(accountId, filter);
}

export async function getCashDrawerBalance(): Promise<number> {
  return bankRepo.getCashDrawerBalance();
}

export async function executeFundsTransfer(data: TransferFundsInput, userId?: string) {
  return bankRepo.transferFunds(data, userId);
}


