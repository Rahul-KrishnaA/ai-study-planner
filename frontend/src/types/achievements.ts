// AchievementRecord: persisted per-user state (stored in backend)
export interface AchievementRecord {
  id: string;
  unlockedAt: string | null; // ISO timestamp or null if locked
  progress: number;          // current progress value
}

// AchievementDef: static definition (never persisted, lives in code)
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;        // emoji
  target: number;      // progress value needed to unlock
  category: 'sessions' | 'streaks' | 'flashcards' | 'pomodoro' | 'topics' | 'xp';
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'first_steps',  name: 'First Steps',    description: 'Complete your first study session',        icon: '🎯', target: 1,   category: 'sessions' },
  { id: 'streak_3',     name: 'On a Roll',       description: 'Study 3 days in a row',                   icon: '🔥', target: 3,   category: 'streaks' },
  { id: 'streak_7',     name: 'Week Warrior',    description: 'Maintain a 7-day streak',                 icon: '⚡', target: 7,   category: 'streaks' },
  { id: 'streak_30',    name: 'Unstoppable',     description: 'Maintain a 30-day streak',                icon: '💎', target: 30,  category: 'streaks' },
  { id: 'pomodoro_10',  name: 'Focused',         description: 'Complete 10 Pomodoro cycles',             icon: '🍅', target: 10,  category: 'pomodoro' },
  { id: 'pomodoro_50',  name: 'Pomodoro Pro',    description: 'Complete 50 Pomodoro cycles',             icon: '🏆', target: 50,  category: 'pomodoro' },
  { id: 'flash_25',     name: 'Card Shark',      description: 'Review 25 flashcards',                    icon: '🃏', target: 25,  category: 'flashcards' },
  { id: 'flash_100',    name: 'Flash Master',    description: 'Review 100 flashcards',                   icon: '🧠', target: 100, category: 'flashcards' },
  { id: 'hours_10',     name: 'Dedicated',       description: 'Study for 10 total hours',                icon: '📚', target: 10,  category: 'sessions' },
  { id: 'hours_100',    name: 'Century',         description: 'Study for 100 total hours',               icon: '💯', target: 100, category: 'sessions' },
  { id: 'topics_5',     name: 'Topic Tackler',   description: 'Complete 5 topics',                       icon: '✅', target: 5,   category: 'topics' },
  { id: 'topics_20',    name: 'Syllabus Slayer', description: 'Complete 20 topics',                      icon: '🎓', target: 20,  category: 'topics' },
  { id: 'level_5',      name: 'Rising Star',     description: 'Reach Level 5',                           icon: '⭐', target: 5,   category: 'xp' },
  { id: 'level_10',     name: 'Scholar',         description: 'Reach Level 10',                          icon: '🌟', target: 10,  category: 'xp' },
  { id: 'night_owl',    name: 'Night Owl',       description: 'Start a study session after 10 PM',       icon: '🦉', target: 1,   category: 'sessions' },
];

// Build initial records for a new user (all locked, progress 0)
export function buildInitialAchievements(): AchievementRecord[] {
  return ACHIEVEMENT_DEFS.map((def) => ({ id: def.id, unlockedAt: null, progress: 0 }));
}
