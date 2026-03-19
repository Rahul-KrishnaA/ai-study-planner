import type { UserProfile, StudyPlan, TrackedSession, AppSettings } from '../types';

export const API_BASE = 'http://127.0.0.1:8000';
const TOKEN_KEY = 'sp_token';

// ─── Token helpers ────────────────────────────────────────────────────────────
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    const detail = err.detail;
    if (detail && typeof detail === 'object') {
      throw detail; // { field, message }
    }
    throw { message: String(detail ?? 'Request failed') };
  }
  return res.json() as Promise<T>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
interface ApiUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

interface ApiAuthResponse {
  token: string;
  user: ApiUser;
}

export interface FrontendUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

function toFrontendUser(u: ApiUser): FrontendUser {
  return { id: u.id, name: u.name, email: u.email, createdAt: u.created_at };
}

export async function apiRegister(
  name: string,
  email: string,
  password: string,
): Promise<FrontendUser> {
  const data = await request<ApiAuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setToken(data.token);
  return toFrontendUser(data.user);
}

export async function apiLogin(email: string, password: string): Promise<FrontendUser> {
  const data = await request<ApiAuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return toFrontendUser(data.user);
}

export function apiLogout(): void {
  clearToken();
}

export async function apiGetMe(): Promise<FrontendUser | null> {
  if (!getToken()) return null;
  try {
    const data = await request<ApiUser>('/auth/me');
    return toFrontendUser(data);
  } catch {
    return null;
  }
}

export async function apiUpdateName(name: string): Promise<void> {
  await request('/users/me/name', { method: 'PUT', body: JSON.stringify({ name }) });
}

export async function apiChangePassword(
  current_password: string,
  new_password: string,
): Promise<void> {
  await request('/users/me/password', {
    method: 'PUT',
    body: JSON.stringify({ current_password, new_password }),
  });
}

// ─── User data ────────────────────────────────────────────────────────────────
export interface UserDataResponse {
  profile: UserProfile | null;
  plan: StudyPlan | null;
  sessions: TrackedSession[];
  settings: AppSettings | null;
  streak: number;
  last_session_date: string | null;
}

export async function apiGetUserData(): Promise<UserDataResponse> {
  return request<UserDataResponse>('/users/me/data');
}

export async function apiSaveProfile(profile: UserProfile): Promise<void> {
  await request('/users/me/profile', {
    method: 'PUT',
    body: JSON.stringify({ profile }),
  });
}

export async function apiSavePlan(plan: StudyPlan): Promise<void> {
  await request('/users/me/plan', { method: 'PUT', body: JSON.stringify({ plan }) });
}

export async function apiAddSession(session: TrackedSession): Promise<void> {
  await request('/users/me/sessions', {
    method: 'POST',
    body: JSON.stringify({ session }),
  });
}

export async function apiSaveSettings(settings: Partial<AppSettings>): Promise<void> {
  await request('/users/me/settings', {
    method: 'PUT',
    body: JSON.stringify({ settings }),
  });
}

export async function apiUpdateStreak(
  streak: number,
  last_session_date: string | null,
): Promise<void> {
  await request('/users/me/streak', {
    method: 'PUT',
    body: JSON.stringify({ streak, last_session_date }),
  });
}

export async function apiResetData(): Promise<void> {
  await request('/users/me/data', { method: 'DELETE' });
}

// ─── LM Studio proxy ──────────────────────────────────────────────────────────
export async function apiGeneratePlan(
  profile: UserProfile,
  lmStudioUrl: string,
): Promise<StudyPlan> {
  return request<StudyPlan>('/lm/generate-plan', {
    method: 'POST',
    body: JSON.stringify({ profile, lm_studio_url: lmStudioUrl }),
  });
}

export async function apiGenerateInsights(
  profile: UserProfile,
  sessions: { subject: string; duration: number; date: string }[],
  lmStudioUrl: string,
): Promise<{ type: string; title: string; body: string }[]> {
  return request('/lm/generate-insights', {
    method: 'POST',
    body: JSON.stringify({ profile, sessions, lm_studio_url: lmStudioUrl }),
  });
}
