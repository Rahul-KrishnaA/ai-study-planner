export interface Flashcard {
  id: string;
  subjectId: string;
  front: string;
  back: string;
  nextReviewDate: string; // ISO date YYYY-MM-DD
  interval: number; // days
  easeFactor: number; // SM-2 ease factor, starts at 2.5
  createdAt: string; // ISO
}
