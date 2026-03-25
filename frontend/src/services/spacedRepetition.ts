import type { Flashcard } from '../types/flashcards';

export type Rating = 'again' | 'hard' | 'easy';

/**
 * SM-2 variant for spaced repetition.
 * Returns updated interval, easeFactor, and nextReviewDate.
 */
export function rateCard(
  card: Flashcard,
  rating: Rating,
): { interval: number; easeFactor: number; nextReviewDate: string } {
  let { interval, easeFactor } = card;

  switch (rating) {
    case 'again':
      interval = 0;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
      break;
    case 'hard':
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      break;
    case 'easy':
      interval = Math.min(30, Math.max(interval * easeFactor, 3));
      interval = Math.round(interval);
      easeFactor = easeFactor + 0.15;
      break;
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);
  const nextReviewDate = nextDate.toISOString().split('T')[0];

  return { interval, easeFactor, nextReviewDate };
}

/**
 * Check if a card is due for review today.
 */
export function isDueToday(card: Flashcard): boolean {
  const today = new Date().toISOString().split('T')[0];
  return card.nextReviewDate <= today;
}

/**
 * Check if a card is mastered (interval >= 21 days).
 */
export function isMastered(card: Flashcard): boolean {
  return card.interval >= 21;
}

/**
 * Get review stats for a set of flashcards.
 */
export function getReviewStats(cards: Flashcard[]): {
  dueToday: number;
  mastered: number;
  total: number;
} {
  const today = new Date().toISOString().split('T')[0];
  return {
    dueToday: cards.filter((c) => c.nextReviewDate <= today).length,
    mastered: cards.filter((c) => c.interval >= 21).length,
    total: cards.length,
  };
}
