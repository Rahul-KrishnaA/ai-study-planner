import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile, StudyPlan, TrackedSession, AppSettings, MissedSession } from '../types';
import { detectMissedSessions, rescheduleMissedSessions } from '../services/scheduler';
import { scheduleSessionNotifications, notifyRescheduled, clearScheduledNotifications } from '../services/notifications';
import {
  apiGetUserData,
  apiSaveProfile,
  apiSavePlan,
  apiAddSession,
  apiSaveSettings,
  apiUpdateStreak,
  apiResetData,
} from '../services/api';

interface AppContextValue {
  profile: UserProfile | null;
  plan: StudyPlan | null;
  sessions: TrackedSession[];
  settings: AppSettings;
  streak: number;
  missedSessions: MissedSession[];
  dataLoading: boolean;
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

interface AppProviderProps {
  children: React.ReactNode;
  userId: string;
}

export function AppProvider({ children, userId: _userId }: AppProviderProps) {
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [plan, setPlanState] = useState<StudyPlan | null>(null);
  const [sessions, setSessionsState] = useState<TrackedSession[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [streak, setStreak] = useState<number>(0);
  const [lastSessionDate, setLastSessionDate] = useState<string | null>(null);
  const [missedSessions, setMissedSessions] = useState<MissedSession[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Load all data from backend on mount
  useEffect(() => {
    apiGetUserData()
      .then((data) => {
        if (data.profile) setProfileState(data.profile);
        if (data.plan) setPlanState(data.plan);
        setSessionsState(data.sessions ?? []);
        if (data.settings) setSettingsState({ ...defaultSettings, ...data.settings });

        // Streak: reset to 0 if last session was >1 day ago
        const rawStreak = data.streak ?? 0;
        const lastDate = data.last_session_date ?? null;
        const adjustedStreak =
          lastDate &&
          Math.floor((Date.now() - new Date(lastDate).getTime()) / 86_400_000) > 1
            ? 0
            : rawStreak;
        setStreak(adjustedStreak);
        setLastSessionDate(lastDate);

        // Detect and reschedule missed sessions
        if (data.plan) {
          const completedIds = new Set(
            (data.sessions ?? [])
              .filter((s) => s.completed)
              .map((s) => s.plannedSessionId ?? ''),
          );
          const missed = detectMissedSessions(data.plan, completedIds);
          if (missed.length > 0) {
            setMissedSessions(missed);
            const rescheduled = rescheduleMissedSessions(data.plan, missed);
            setPlanState(rescheduled);
            apiSavePlan(rescheduled).catch(console.error);
            notifyRescheduled(missed.length);
          }
        }
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Dark mode
  useEffect(() => {
    if (settings.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [settings.darkMode]);

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
    apiSaveProfile(p).catch(console.error);
  }, []);

  const setPlan = useCallback((p: StudyPlan) => {
    setPlanState(p);
    apiSavePlan(p).catch(console.error);
  }, []);

  const addSession = useCallback(
    (session: TrackedSession) => {
      setSessionsState((prev) => [...prev, session]);
      apiAddSession(session).catch(console.error);

      const today = new Date().toISOString().split('T')[0];
      if (lastSessionDate !== today) {
        const newStreak = lastSessionDate ? streak + 1 : 1;
        setStreak(newStreak);
        setLastSessionDate(today);
        apiUpdateStreak(newStreak, today).catch(console.error);
      }
    },
    [streak, lastSessionDate],
  );

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    setSettingsState((prev) => {
      const updated = { ...prev, ...partial };
      apiSaveSettings(partial).catch(console.error);
      return updated;
    });
  }, []);

  const updateSubjectProgress = useCallback((subject: string, percent: number) => {
    setPlanState((prev) => {
      if (!prev) return prev;
      const updated: StudyPlan = {
        ...prev,
        subjectProgress: prev.subjectProgress.map((sp) =>
          sp.subject === subject ? { ...sp, percentDone: percent } : sp,
        ),
      };
      apiSavePlan(updated).catch(console.error);
      return updated;
    });
  }, []);

  const dismissMissed = useCallback(() => setMissedSessions([]), []);

  const resetAll = useCallback(() => {
    apiResetData().catch(console.error);
    setProfileState(null);
    setPlanState(null);
    setSessionsState([]);
    setSettingsState(defaultSettings);
    setStreak(0);
    setLastSessionDate(null);
    setMissedSessions([]);
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <AppContext.Provider
      value={{
        profile,
        plan,
        sessions,
        settings,
        streak,
        missedSessions,
        dataLoading,
        setProfile,
        setPlan,
        addSession,
        updateSettings,
        updateSubjectProgress,
        dismissMissed,
        resetAll,
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
