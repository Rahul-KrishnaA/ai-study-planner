import type { UserProfile, StudyPlan, TrackedSession, AppSettings } from '../types';
import type { Note } from '../types/notes';
import type { Flashcard } from '../types/flashcards';
import type { AchievementRecord } from '../types/achievements';

// Auto-detect backend URL: when accessed from a phone on the same LAN,
// use the same hostname as the frontend but port 8000.
function resolveApiBase(): string {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'http://127.0.0.1:8000';
  return `http://${h}:8000`;
}
export const API_BASE = resolveApiBase();
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
  notes: Note[];
  flashcards: Flashcard[];
  xp: number;
  level: number;
  best_streak: number;
  streak_freezes: number;
  achievements: AchievementRecord[];
  weekly_goal_hours: number;
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

export async function apiUpdateGamification(
  xp: number,
  level: number,
  achievements: AchievementRecord[],
  weeklyGoalHours?: number,
): Promise<void> {
  await request('/users/me/gamification', {
    method: 'PUT',
    body: JSON.stringify({ xp, level, achievements, weekly_goal_hours: weeklyGoalHours }),
  });
}

export async function apiUpdateStreakFull(
  streak: number,
  lastSessionDate: string | null,
  streakFreezes: number,
  bestStreak: number,
): Promise<void> {
  await request('/users/me/streak', {
    method: 'PUT',
    body: JSON.stringify({
      streak,
      last_session_date: lastSessionDate,
      streak_freezes: streakFreezes,
      best_streak: bestStreak,
    }),
  });
}

export async function apiSaveNotes(notes: Note[]): Promise<void> {
  await request('/users/me/notes', {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  });
}

export async function apiSaveFlashcards(flashcards: Flashcard[]): Promise<void> {
  await request('/users/me/flashcards', {
    method: 'PUT',
    body: JSON.stringify({ flashcards }),
  });
}

// ─── LM Studio proxy ──────────────────────────────────────────────────────────
export async function apiGeneratePlan(
  profile: UserProfile,
): Promise<StudyPlan> {
  return request<StudyPlan>('/lm/generate-plan', {
    method: 'POST',
    body: JSON.stringify({ profile }),
  });
}

export async function apiGenerateInsights(
  profile: UserProfile,
  sessions: { subject: string; duration: number; date: string }[],
): Promise<{ type: string; title: string; body: string }[]> {
  return request('/lm/generate-insights', {
    method: 'POST',
    body: JSON.stringify({ profile, sessions }),
  });
}

export async function apiTestLmConnection(): Promise<{ status: string; model: string }> {
  return request('/lm/test');
}

export async function apiGenerateFlashcards(
  subjectName: string,
  count: number,
): Promise<{ front: string; back: string }[]> {
  return request('/lm/generate-flashcards', {
    method: 'POST',
    body: JSON.stringify({ subject_name: subjectName, count }),
  });
}
