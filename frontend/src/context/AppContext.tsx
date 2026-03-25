import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { UserProfile, StudyPlan, TrackedSession, AppSettings, MissedSession, Topic } from '../types';
import type { Note } from '../types/notes';
import type { Flashcard } from '../types/flashcards';
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
  apiSaveNotes,
  apiSaveFlashcards,
} from '../services/api';

interface AppContextValue {
  profile: UserProfile | null;
  plan: StudyPlan | null;
  sessions: TrackedSession[];
  settings: AppSettings;
  streak: number;
  missedSessions: MissedSession[];
  dataLoading: boolean;
  notes: Note[];
  flashcards: Flashcard[];
  setProfile: (profile: UserProfile) => void;
  setPlan: (plan: StudyPlan) => void;
  addSession: (session: TrackedSession) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  updateSubjectProgress: (subject: string, percent: number) => void;
  dismissMissed: () => void;
  resetAll: () => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addTopic: (subjectId: string, topic: Topic) => void;
  updateTopic: (subjectId: string, topicId: string, updates: Partial<Topic>) => void;
  removeTopic: (subjectId: string, topicId: string) => void;
  setFlashcards: (flashcards: Flashcard[]) => void;
  addFlashcard: (card: Flashcard) => void;
  updateFlashcard: (id: string, updates: Partial<Flashcard>) => void;
  deleteFlashcard: (id: string) => void;
}

const defaultSettings: AppSettings = {
  darkMode: false,
  remindersEnabled: false,
  reminderMinutesBefore: 15,
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  pomodoroLongBreakMinutes: 15,
  pomodorosBeforeLongBreak: 4,
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
  const [notes, setNotesState] = useState<Note[]>([]);
  const [flashcards, setFlashcardsState] = useState<Flashcard[]>([]);

  // Load all data from backend on mount
  useEffect(() => {
    apiGetUserData()
      .then((data) => {
        if (data.profile) {
          // Auto-migrate: ensure all subjects have stable IDs
          const needsMigration = data.profile.subjectDetails.some((d) => !d.id);
          const migratedProfile = needsMigration ? {
            ...data.profile,
            subjectDetails: data.profile.subjectDetails.map((d) => ({
              ...d,
              id: d.id || crypto.randomUUID(),
            })),
          } : data.profile;
          setProfileState(migratedProfile);
          if (needsMigration) {
            apiSaveProfile(migratedProfile).catch(console.error);
          }
        }
        if (data.plan) setPlanState(data.plan);
        setSessionsState(data.sessions ?? []);
        setNotesState(data.notes ?? []);
        setFlashcardsState(data.flashcards ?? []);
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
  }, []); // intentionally empty — runs once on mount

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

  const addTopic = useCallback((subjectId: string, topic: Topic) => {
    setProfileState((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        subjectDetails: prev.subjectDetails.map((d) =>
          d.id === subjectId ? { ...d, topics: [...(d.topics ?? []), topic] } : d
        ),
      };
      apiSaveProfile(updated).catch(console.error);
      return updated;
    });
  }, []);

  const updateTopic = useCallback((subjectId: string, topicId: string, updates: Partial<Topic>) => {
    setProfileState((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        subjectDetails: prev.subjectDetails.map((d) =>
          d.id === subjectId
            ? { ...d, topics: (d.topics ?? []).map((t) => (t.id === topicId ? { ...t, ...updates } : t)) }
            : d
        ),
      };
      apiSaveProfile(updated).catch(console.error);
      return updated;
    });
  }, []);

  const removeTopic = useCallback((subjectId: string, topicId: string) => {
    setProfileState((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        subjectDetails: prev.subjectDetails.map((d) =>
          d.id === subjectId ? { ...d, topics: (d.topics ?? []).filter((t) => t.id !== topicId) } : d
        ),
      };
      apiSaveProfile(updated).catch(console.error);
      return updated;
    });
  }, []);

  const resetAll = useCallback(() => {
    apiResetData().catch(console.error);
    setProfileState(null);
    setPlanState(null);
    setSessionsState([]);
    setSettingsState(defaultSettings);
    setStreak(0);
    setLastSessionDate(null);
    setMissedSessions([]);
    setNotesState([]);
    setFlashcardsState([]);
    document.documentElement.classList.remove('dark');
  }, []);

  // ─── Notes CRUD ──────────────────────────────────────────────────────────────
  const addNote = useCallback((note: Note) => {
    setNotesState((prev) => {
      const updated = [...prev, note];
      apiSaveNotes(updated).catch(console.error);
      return updated;
    });
  }, []);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    setNotesState((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
      apiSaveNotes(updated).catch(console.error);
      return updated;
    });
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotesState((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      apiSaveNotes(updated).catch(console.error);
      return updated;
    });
  }, []);

  // ─── Flashcards CRUD ─────────────────────────────────────────────────────────
  const setFlashcardsCtx = useCallback((cards: Flashcard[]) => {
    setFlashcardsState(cards);
    apiSaveFlashcards(cards).catch(console.error);
  }, []);

  const addFlashcard = useCallback((card: Flashcard) => {
    setFlashcardsState((prev) => {
      const updated = [...prev, card];
      apiSaveFlashcards(updated).catch(console.error);
      return updated;
    });
  }, []);

  const updateFlashcard = useCallback((id: string, updates: Partial<Flashcard>) => {
    setFlashcardsState((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      apiSaveFlashcards(updated).catch(console.error);
      return updated;
    });
  }, []);

  const deleteFlashcard = useCallback((id: string) => {
    setFlashcardsState((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      apiSaveFlashcards(updated).catch(console.error);
      return updated;
    });
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
        notes,
        flashcards,
        setProfile,
        setPlan,
        addSession,
        updateSettings,
        updateSubjectProgress,
        dismissMissed,
        resetAll,
        addNote,
        updateNote,
        deleteNote,
        addTopic,
        updateTopic,
        removeTopic,
        setFlashcards: setFlashcardsCtx,
        addFlashcard,
        updateFlashcard,
        deleteFlashcard,
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
