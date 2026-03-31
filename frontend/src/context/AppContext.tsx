import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { UserProfile, StudyPlan, TrackedSession, AppSettings, MissedSession, Topic } from '../types';
import type { Note } from '../types/notes';
import type { Flashcard } from '../types/flashcards';
import type { AchievementRecord } from '../types/achievements';
import { buildInitialAchievements } from '../types/achievements';
import { detectMissedSessions, rescheduleMissedSessions } from '../services/scheduler';
import { scheduleSessionNotifications, notifyRescheduled, clearScheduledNotifications } from '../services/notifications';
import { calcSessionXP, calcFlashcardXP, TOPIC_COMPLETE_XP, levelFromTotalXP } from '../services/xp';
import { checkAchievements } from '../services/achievementChecker';
import {
  apiGetUserData,
  apiSaveProfile,
  apiSavePlan,
  apiAddSession,
  apiSaveSettings,
  apiUpdateStreakFull,
  apiResetData,
  apiSaveNotes,
  apiSaveFlashcards,
  apiUpdateGamification,
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
  xp: number;
  level: number;
  bestStreak: number;
  streakFreezes: number;
  achievements: AchievementRecord[];
  lastUnlockedAchievements: string[];
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
  awardXP: (amount: number) => void;
  awardFlashcardXP: (count: number) => void;
  awardTopicXP: () => void;
  clearUnlockedAchievements: () => void;
}

const defaultSettings: AppSettings = {
  darkMode: false,
  remindersEnabled: false,
  reminderMinutesBefore: 15,
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  pomodoroLongBreakMinutes: 15,
  pomodorosBeforeLongBreak: 4,
  weeklyGoalHours: 10,
  aiProvider: 'gemini',
  localLmUrl: 'http://127.0.0.1:1240',
  localLmModel: 'qwen3.5-4b',
};

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  children: React.ReactNode;
  userId: string;
}

export function AppProvider({ children, userId }: AppProviderProps) {
  const profileCacheKey = `sp_${userId}_profile_cache`;
  const planCacheKey = `sp_${userId}_plan_cache`;

  const [profile, setProfileState] = useState<UserProfile | null>(() => {
    try { return JSON.parse(localStorage.getItem(profileCacheKey) ?? 'null'); } catch { return null; }
  });
  const [plan, setPlanState] = useState<StudyPlan | null>(() => {
    try { return JSON.parse(localStorage.getItem(planCacheKey) ?? 'null'); } catch { return null; }
  });
  const [sessions, setSessionsState] = useState<TrackedSession[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [streak, setStreak] = useState<number>(0);
  const [lastSessionDate, setLastSessionDate] = useState<string | null>(null);
  const [missedSessions, setMissedSessions] = useState<MissedSession[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [notes, setNotesState] = useState<Note[]>([]);
  const [flashcards, setFlashcardsState] = useState<Flashcard[]>([]);

  // ─── Gamification state ───────────────────────────────────────────────────────
  const [xp, setXp] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [bestStreak, setBestStreak] = useState<number>(0);
  const [streakFreezes, setStreakFreezes] = useState<number>(0);
  const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
  const [lastUnlockedAchievements, setLastUnlockedAchievements] = useState<string[]>([]);
  const [totalFlashcardsReviewed, setTotalFlashcardsReviewed] = useState<number>(0);
  const [totalTopicsCompleted, setTotalTopicsCompleted] = useState<number>(0);

  // Skip achievement check on initial data load
  const achievementsInitialized = useRef(false);

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
          localStorage.setItem(profileCacheKey, JSON.stringify(migratedProfile));
          if (needsMigration) {
            apiSaveProfile(migratedProfile).catch(console.error);
          }
        }
        if (data.plan) {
          setPlanState(data.plan);
          localStorage.setItem(planCacheKey, JSON.stringify(data.plan));
        }
        setSessionsState(data.sessions ?? []);
        setNotesState(data.notes ?? []);
        setFlashcardsState(data.flashcards ?? []);
        if (data.settings) setSettingsState({ ...defaultSettings, ...data.settings });

        // Load gamification state
        setXp(data.xp ?? 0);
        setLevel(data.level ?? 1);
        setBestStreak(data.best_streak ?? 0);
        setAchievements(data.achievements?.length ? data.achievements : buildInitialAchievements());

        // Compute flashcards reviewed count from review history
        const flashcardReviewedCount = (data.flashcards ?? []).reduce(
          (sum: number, c: { interval: number }) => sum + (c.interval > 0 ? 1 : 0),
          0,
        );
        setTotalFlashcardsReviewed(flashcardReviewedCount);

        // Streak + freeze logic
        const rawStreak = data.streak ?? 0;
        const lastDate = data.last_session_date ?? null;
        const daysMissed = lastDate
          ? Math.floor((Date.now() - new Date(lastDate + 'T12:00:00').getTime()) / 86_400_000)
          : 0;

        let adjustedStreak = rawStreak;
        let adjustedFreezes = data.streak_freezes ?? 0;
        const rawBest = data.best_streak ?? 0;

        if (daysMissed > 1) {
          const freezesToUse = Math.min(adjustedFreezes, daysMissed - 1);
          adjustedFreezes -= freezesToUse;
          const unprotectedDays = (daysMissed - 1) - freezesToUse;
          if (unprotectedDays > 0) adjustedStreak = 0;
        }

        setStreak(adjustedStreak);
        setLastSessionDate(lastDate);
        setStreakFreezes(adjustedFreezes);
        setBestStreak(rawBest);

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

  // Achievement check — runs when key counters change, skips initial load
  useEffect(() => {
    if (!achievementsInitialized.current) {
      achievementsInitialized.current = true;
      return;
    }
    const { updated, newlyUnlocked } = checkAchievements({
      sessions,
      streak,
      level,
      existing: achievements,
      totalFlashcardsReviewed,
      totalTopicsCompleted,
    });
    if (newlyUnlocked.length > 0) {
      setAchievements(updated);
      setLastUnlockedAchievements(newlyUnlocked);
      apiUpdateGamification(xp, level, updated).catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length, streak, level, totalFlashcardsReviewed, totalTopicsCompleted]);

  const setProfile = useCallback((p: UserProfile) => {
    setProfileState(p);
    localStorage.setItem(profileCacheKey, JSON.stringify(p));
    apiSaveProfile(p).catch(console.error);
  }, [profileCacheKey]);

  const setPlan = useCallback((p: StudyPlan) => {
    setPlanState(p);
    localStorage.setItem(planCacheKey, JSON.stringify(p));
    apiSavePlan(p).catch(console.error);
  }, [planCacheKey]);

  const addSession = useCallback(
    (session: TrackedSession) => {
      setSessionsState((prev) => [...prev, session]);
      apiAddSession(session).catch(console.error);

      // Award XP
      setXp((prevXp) => {
        const xpAmount = calcSessionXP(session);
        const newXp = prevXp + xpAmount;
        const newLevel = levelFromTotalXP(newXp);
        setLevel(newLevel);
        apiUpdateGamification(newXp, newLevel, achievements).catch(console.error);
        return newXp;
      });

      // Update streak with freeze and best streak tracking
      const today = new Date().toISOString().split('T')[0];
      if (lastSessionDate !== today) {
        const newStreak = lastSessionDate ? streak + 1 : 1;
        const newBest = Math.max(bestStreak, newStreak);
        const newFreezes = newStreak % 7 === 0 ? Math.min(streakFreezes + 1, 2) : streakFreezes;
        setStreak(newStreak);
        setBestStreak(newBest);
        setStreakFreezes(newFreezes);
        setLastSessionDate(today);
        apiUpdateStreakFull(newStreak, today, newFreezes, newBest).catch(console.error);
      }
    },
    [streak, lastSessionDate, bestStreak, streakFreezes, achievements],
  );

  const awardXP = useCallback((amount: number) => {
    setXp((prevXp) => {
      const newXp = prevXp + amount;
      const newLevel = levelFromTotalXP(newXp);
      setLevel(newLevel);
      apiUpdateGamification(newXp, newLevel, achievements).catch(console.error);
      return newXp;
    });
  }, [achievements]);

  const awardFlashcardXP = useCallback((count: number) => {
    setTotalFlashcardsReviewed((prev) => prev + count);
    const amount = calcFlashcardXP(count);
    setXp((prevXp) => {
      const newXp = prevXp + amount;
      const newLevel = levelFromTotalXP(newXp);
      setLevel(newLevel);
      apiUpdateGamification(newXp, newLevel, achievements).catch(console.error);
      return newXp;
    });
  }, [achievements]);

  const awardTopicXP = useCallback(() => {
    setTotalTopicsCompleted((prev) => prev + 1);
    setXp((prevXp) => {
      const newXp = prevXp + TOPIC_COMPLETE_XP;
      const newLevel = levelFromTotalXP(newXp);
      setLevel(newLevel);
      apiUpdateGamification(newXp, newLevel, achievements).catch(console.error);
      return newXp;
    });
  }, [achievements]);

  const clearUnlockedAchievements = useCallback(() => setLastUnlockedAchievements([]), []);

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
    localStorage.removeItem(profileCacheKey);
    localStorage.removeItem(planCacheKey);
    setProfileState(null);
    setPlanState(null);
    setSessionsState([]);
    setSettingsState(defaultSettings);
    setStreak(0);
    setLastSessionDate(null);
    setMissedSessions([]);
    setNotesState([]);
    setFlashcardsState([]);
    setXp(0);
    setLevel(1);
    setBestStreak(0);
    setStreakFreezes(0);
    setAchievements([]);
    setLastUnlockedAchievements([]);
    setTotalFlashcardsReviewed(0);
    setTotalTopicsCompleted(0);
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
        xp,
        level,
        bestStreak,
        streakFreezes,
        achievements,
        lastUnlockedAchievements,
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
        awardXP,
        awardFlashcardXP,
        awardTopicXP,
        clearUnlockedAchievements,
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
