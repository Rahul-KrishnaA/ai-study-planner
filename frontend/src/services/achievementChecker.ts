import type { TrackedSession } from '../types';
import type { AchievementRecord } from '../types/achievements';
import { ACHIEVEMENT_DEFS } from '../types/achievements';

interface CheckerInput {
  sessions: TrackedSession[];
  streak: number;
  level: number;
  existing: AchievementRecord[];
  // pass counts from calling context (avoids re-computing)
  totalFlashcardsReviewed: number;
  totalTopicsCompleted: number;
  latestSessionHour?: number; // 0-23, for night owl check
}

function getProgress(id: string, input: CheckerInput): number {
  const { sessions, streak, level, totalFlashcardsReviewed, totalTopicsCompleted, latestSessionHour } = input;

  switch (id) {
    case 'first_steps':
      return sessions.filter((s) => s.completed).length;
    case 'streak_3':
    case 'streak_7':
    case 'streak_30':
      return streak;
    case 'pomodoro_10':
    case 'pomodoro_50':
      return sessions.reduce((sum, s) => sum + (s.pomodoroCount ?? 0), 0);
    case 'flash_25':
    case 'flash_100':
      return totalFlashcardsReviewed;
    case 'hours_10':
    case 'hours_100':
      return Math.floor(sessions.reduce((sum, s) => sum + s.duration, 0) / 60);
    case 'topics_5':
    case 'topics_20':
      return totalTopicsCompleted;
    case 'level_5':
    case 'level_10':
      return level;
    case 'night_owl':
      return latestSessionHour !== undefined && latestSessionHour >= 22 ? 1 : 0;
    default:
      return 0;
  }
}

// Returns updated achievement records — newly unlocked ones have unlockedAt set
export function checkAchievements(input: CheckerInput): {
  updated: AchievementRecord[];
  newlyUnlocked: string[]; // achievement IDs
} {
  const now = new Date().toISOString();
  const newlyUnlocked: string[] = [];

  const updated = ACHIEVEMENT_DEFS.map((def) => {
    const existing = input.existing.find((r) => r.id === def.id) ?? { id: def.id, unlockedAt: null, progress: 0 };
    const progress = getProgress(def.id, input);

    if (!existing.unlockedAt && progress >= def.target) {
      newlyUnlocked.push(def.id);
      return { id: def.id, unlockedAt: now, progress };
    }

    return { ...existing, progress };
  });

  return { updated, newlyUnlocked };
}
