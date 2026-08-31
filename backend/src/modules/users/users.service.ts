import bcrypt from 'bcrypt';
import * as usersRepo from './users.repository';
import { CreateUserInput, UpdateUserInput } from './users.schemas';
import { ConflictError, NotFoundError } from '../../shared/errors';

export async function getUsers() {
  return usersRepo.findAllUsers();
}

export async function getUser(id: string) {
  const user = await usersRepo.findUserById(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function createUser(input: CreateUserInput) {
  const exists = await usersRepo.checkEmailExists(input.email);
  if (exists) throw new ConflictError('Email already in use');

  const password_hash = await bcrypt.hash(input.password, 10);

  const id = await usersRepo.createUser({
    name: input.name,
    email: input.email,
    password_hash,
    role_id: input.role_id,
  });

  return getUser(id);
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await usersRepo.findUserById(id);
  if (!user) throw new NotFoundError('User not found');

  if (input.email) {
    const exists = await usersRepo.checkEmailExists(input.email, id);
    if (exists) throw new ConflictError('Email already in use');
  }

  await usersRepo.updateUser(id, input);
  return getUser(id);
}

export async function deleteUser(id: string) {
  const user = await usersRepo.findUserById(id);
  if (!user) throw new NotFoundError('User not found');

  // Hard delete
  await usersRepo.deleteUser(id);
}

export async function getRoles() {
  return usersRepo.findAllRoles();
}
