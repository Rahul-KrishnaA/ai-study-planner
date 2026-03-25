import type { TrackedSession } from '../types';

// XP needed to reach a given level FROM level 1
// Level 1→2: 100 XP, each level scales by 1.5x
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Total cumulative XP needed to be AT a given level (not to reach next)
export function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForLevel(l);
  return total;
}

// Which level does this total XP correspond to?
export function levelFromTotalXP(totalXp: number): number {
  let level = 1;
  let accumulated = 0;
  while (accumulated + xpForLevel(level) <= totalXp) {
    accumulated += xpForLevel(level);
    level++;
    if (level > 50) break; // max level
  }
  return Math.min(level, 50);
}

// XP progress within current level (0 to xpForLevel(level)-1)
export function xpProgressInLevel(totalXp: number): { current: number; needed: number } {
  const level = levelFromTotalXP(totalXp);
  const base = cumulativeXpForLevel(level);
  return { current: totalXp - base, needed: xpForLevel(level) };
}

// How much XP does completing this session award?
export function calcSessionXP(session: TrackedSession): number {
  if (session.pomodoroCount && session.pomodoroCount > 0) {
    // Pomodoro XP: 15 per cycle
    return session.pomodoroCount * 15;
  }
  // Duration XP: 10 per 30 min
  return Math.floor((session.duration / 30)) * 10;
}

// XP for reviewing N flashcards
export function calcFlashcardXP(count: number): number {
  return count * 2;
}

// XP for completing a topic
export const TOPIC_COMPLETE_XP = 50;

// XP bonus for hitting daily goal
export const DAILY_GOAL_XP = 25;
