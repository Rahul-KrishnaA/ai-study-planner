import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile, StudyPlan, TrackedSession, AppSettings, MissedSession } from '../types';
import { makeStorageKeys } from '../types';
import { detectMissedSessions, rescheduleMissedSessions } from '../services/scheduler';
import { scheduleSessionNotifications, notifyRescheduled, clearScheduledNotifications } from '../services/notifications';

interface AppContextValue {
  profile: UserProfile | null;
  plan: StudyPlan | null;
  sessions: TrackedSession[];
  settings: AppSettings;
  streak: number;
  missedSessions: MissedSession[];
  setProfile: (profile: UserProfile) => void;
  setPlan: (plan: StudyPlan) => void;
  addSession: (session: TrackedSession) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  updateSubjectProgress: (subject: string, percent: number) => void;
  dismissMissed: () => void;
  resetAll: () => void;
}

const defaultSettings: AppSettings = {
  lmStudioUrl: 'http://127.0.0.1:1240',
  darkMode: false,
  remindersEnabled: false,
  reminderMinutesBefore: 15,
};

const AppContext = createContext<AppContextValue | null>(null);

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

function save<T>(key: string, value: T): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

function computeStreak(keys: ReturnType<typeof makeStorageKeys>): number {
  const raw = localStorage.getItem(keys.STREAK);
  const lastDate = localStorage.getItem(keys.LAST_SESSION_DATE);
  const streak = raw ? parseInt(raw, 10) : 0;
  if (!lastDate) return streak;
  const diff = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000);
  return diff > 1 ? 0 : streak;
}

interface AppProviderProps {
  children: React.ReactNode;
  userId: string;
}

export function AppProvider({ children, userId }: AppProviderProps) {
  const keys = makeStorageKeys(userId);

  const [profile, setProfileState] = useState<UserProfile | null>(() => load<UserProfile>(keys.PROFILE));
  const [plan, setPlanState] = useState<StudyPlan | null>(() => load<StudyPlan>(keys.PLAN));
  const [sessions, setSessionsState] = useState<TrackedSession[]>(() => load<TrackedSession[]>(keys.SESSIONS) ?? []);
  const [settings, setSettingsState] = useState<AppSettings>(() => load<AppSettings>(keys.SETTINGS) ?? defaultSettings);
  const [streak, setStreak] = useState<number>(() => computeStreak(keys));
  const [missedSessions, setMissedSessions] = useState<MissedSession[]>([]);

  // Dark mode
  useEffect(() => {
    if (settings.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [settings.darkMode]);

  // On plan load: detect missed sessions and reschedule
  useEffect(() => {
    if (!plan) return;
    const completedIds = new Set(sessions.filter((s) => s.completed).map((s) => s.plannedSessionId ?? ''));
    const missed = detectMissedSessions(plan, completedIds);

    if (missed.length > 0) {
      setMissedSessions(missed);
      const rescheduled = rescheduleMissedSessions(plan, missed);
      setPlanState(rescheduled);
      save(keys.PLAN, rescheduled);
      notifyRescheduled(missed.length);
    }
  }, []); // run once on mount

  // Schedule notifications when plan or settings change
  useEffect(() => {
    if (plan && settings.remindersEnabled) {
      scheduleSessionNotifications(plan, settings);
    } else {
      clearScheduledNotifications();
    }
    return () => clearScheduledNotifications();
  }, [plan, settings]);

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    save(keys.PROFILE, p);
  }, [keys.PROFILE]);

  const setPlan = useCallback((p: StudyPlan) => {
    setPlanState(p);
    save(keys.PLAN, p);
  }, [keys.PLAN]);

  const addSession = useCallback((session: TrackedSession) => {
    setSessionsState((prev) => {
      const updated = [...prev, session];
      save(keys.SESSIONS, updated);
      return updated;
    });

    const today = new Date().toISOString().split('T')[0];
    const lastDate = localStorage.getItem(keys.LAST_SESSION_DATE);
    if (lastDate !== today) {
      const current = computeStreak(keys);
      const newStreak = lastDate ? current + 1 : 1;
      localStorage.setItem(keys.STREAK, String(newStreak));
      localStorage.setItem(keys.LAST_SESSION_DATE, today);
      setStreak(newStreak);
    }
  }, [keys]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...partial };
      save(keys.SETTINGS, updated);
      return updated;
    });
  }, [keys.SETTINGS]);

  const updateSubjectProgress = useCallback((subject: string, percent: number) => {
    setPlanState((prev) => {
      if (!prev) return prev;
      const updated: StudyPlan = {
        ...prev,
        subjectProgress: prev.subjectProgress.map((sp) =>
          sp.subject === subject ? { ...sp, percentDone: percent } : sp
        ),
      };
      save(keys.PLAN, updated);
      return updated;
    });
  }, [keys.PLAN]);

  const dismissMissed = useCallback(() => setMissedSessions([]), []);

  const resetAll = useCallback(() => {
    Object.values(keys).forEach((k) => localStorage.removeItem(k));
    setProfileState(null);
    setPlanState(null);
    setSessionsState([]);
    setSettingsState(defaultSettings);
    setStreak(0);
    setMissedSessions([]);
    document.documentElement.classList.remove('dark');
  }, [keys]);

  return (
    <AppContext.Provider
      value={{
        profile, plan, sessions, settings, streak, missedSessions,
        setProfile, setPlan, addSession, updateSettings,
        updateSubjectProgress, dismissMissed, resetAll,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
