// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

export interface AuthSession {
  userId: string;
  token: string;
  expiresAt: number; // timestamp ms
}

// ─── Profile ──────────────────────────────────────────────────────────────────
export interface UserProfile {
  name: string;
  email: string;
  studyField: string;
  institution?: string;
  semester?: string;
  subjects: string[];
  subjectDetails: SubjectDetail[];
  preferredTime: 'morning' | 'afternoon' | 'evening';
  dailyGoalHours: number;
}

export interface SubjectDetail {
  name: string;
  examDate?: string; // ISO date YYYY-MM-DD
  hoursPerWeek?: number;
  color?: string;
}

// ─── Schedule ─────────────────────────────────────────────────────────────────
export interface StudySession {
  id: string;
  subject: string;
  chapter: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  color: string;
  rescheduled?: boolean;
  originalDay?: string;
}

export interface DaySchedule {
  day: string;
  sessions: StudySession[];
}

export interface Insight {
  type: 'tip' | 'warning' | 'achievement';
  title: string;
  body: string;
}

export interface SubjectProgress {
  subject: string;
  percentDone: number;
}

export interface StudyPlan {
  weeklySchedule: DaySchedule[];
  insights: Insight[];
  subjectProgress: SubjectProgress[];
  generatedAt: string;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────
export interface TrackedSession {
  id: string;
  date: string;       // YYYY-MM-DD
  subject: string;
  duration: number;   // minutes
  completed: boolean;
  plannedSessionId?: string;
}

export interface MissedSession {
  sessionId: string;
  originalDay: string;
  subject: string;
  startTime: string;
  endTime: string;
  color: string;
  rescheduledTo?: { day: string; startTime: string; endTime: string };
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export interface AppSettings {
  lmStudioUrl: string;
  darkMode: boolean;
  remindersEnabled: boolean;
  reminderMinutesBefore: number;
}

// ─── Storage Keys (per-user) ──────────────────────────────────────────────────
export function makeStorageKeys(userId: string) {
  return {
    PROFILE: `sp_${userId}_profile`,
    PLAN: `sp_${userId}_plan`,
    SESSIONS: `sp_${userId}_sessions`,
    SETTINGS: `sp_${userId}_settings`,
    STREAK: `sp_${userId}_streak`,
    LAST_SESSION_DATE: `sp_${userId}_last_session_date`,
    MISSED: `sp_${userId}_missed`,
  } as const;
}

// Legacy keys (pre-auth data migration)
export const STORAGE_KEYS = {
  USERS: 'sp_users',
  SESSION: 'sp_session',
} as const;
