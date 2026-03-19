import {
  apiRegister,
  apiLogin,
  apiLogout,
  apiGetMe,
  apiUpdateName,
  apiChangePassword,
  type FrontendUser,
} from './api';
import type { AuthUser } from '../types';

export interface AuthError {
  field?: 'email' | 'password' | 'name' | 'general';
  message: string;
}

function toAuthUser(u: FrontendUser): AuthUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    passwordHash: '',
    salt: '',
    createdAt: u.createdAt,
  };
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthUser> {
  const user = await apiRegister(name, email, password);
  return toAuthUser(user);
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const user = await apiLogin(email, password);
  return toAuthUser(user);
}

export function logout(): void {
  apiLogout();
}

export async function loadSessionUser(): Promise<AuthUser | null> {
  const user = await apiGetMe();
  return user ? toAuthUser(user) : null;
}

export async function updateUserName(
  _userId: string,
  newName: string,
): Promise<void> {
  await apiUpdateName(newName);
}

export async function changePassword(
  _userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await apiChangePassword(currentPassword, newPassword);
}
