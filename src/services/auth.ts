import type { AuthUser, AuthSession } from '../types';
import { STORAGE_KEYS } from '../types';

// ─── Crypto helpers ───────────────────────────────────────────────────────────
function generateId(): string {
  return crypto.randomUUID();
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── User store ───────────────────────────────────────────────────────────────
function getUsers(): AuthUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USERS);
    return raw ? (JSON.parse(raw) as AuthUser[]) : [];
  } catch {
    return [];
  }
}

function saveUsers(users: AuthUser[]): void {
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}

// ─── Session store ────────────────────────────────────────────────────────────
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function saveSession(session: AuthSession): void {
  sessionStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
  // Also persist to localStorage so it survives tab close
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
}

export function loadSession(): AuthSession | null {
  try {
    // Try sessionStorage first, fall back to localStorage
    const raw =
      sessionStorage.getItem(STORAGE_KEYS.SESSION) ||
      localStorage.getItem(STORAGE_KEYS.SESSION);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (Date.now() > session.expiresAt) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_KEYS.SESSION);
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

export function getUserById(id: string): AuthUser | null {
  return getUsers().find((u) => u.id === id) ?? null;
}

// ─── Auth API ─────────────────────────────────────────────────────────────────
export interface AuthError {
  field?: 'email' | 'password' | 'name' | 'general';
  message: string;
}

export async function register(
  name: string,
  email: string,
  password: string
): Promise<{ user: AuthUser; session: AuthSession }> {
  const users = getUsers();

  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw { field: 'email', message: 'An account with this email already exists.' } as AuthError;
  }

  const salt = generateToken();
  const passwordHash = await hashPassword(password, salt);
  const user: AuthUser = {
    id: generateId(),
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };

  saveUsers([...users, user]);

  const session: AuthSession = {
    userId: user.id,
    token: generateToken(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  saveSession(session);

  return { user, session };
}

export async function login(
  email: string,
  password: string
): Promise<{ user: AuthUser; session: AuthSession }> {
  const users = getUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());

  if (!user) {
    throw { field: 'email', message: 'No account found with this email.' } as AuthError;
  }

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    throw { field: 'password', message: 'Incorrect password.' } as AuthError;
  }

  const session: AuthSession = {
    userId: user.id,
    token: generateToken(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };
  saveSession(session);

  return { user, session };
}

export function logout(): void {
  clearSession();
}

export async function updateUserName(userId: string, newName: string): Promise<void> {
  const users = getUsers();
  const updated = users.map((u) =>
    u.id === userId ? { ...u, name: newName.trim() } : u
  );
  saveUsers(updated);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const users = getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) throw { field: 'general', message: 'User not found.' } as AuthError;

  const hash = await hashPassword(currentPassword, user.salt);
  if (hash !== user.passwordHash) {
    throw { field: 'password', message: 'Current password is incorrect.' } as AuthError;
  }

  const newSalt = generateToken();
  const newHash = await hashPassword(newPassword, newSalt);
  const updated = users.map((u) =>
    u.id === userId ? { ...u, passwordHash: newHash, salt: newSalt } : u
  );
  saveUsers(updated);
}
