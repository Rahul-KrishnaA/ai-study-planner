import { useState } from 'react';
import { RotateCcw, ThumbsDown, Minus, ThumbsUp, ArrowLeft } from 'lucide-react';
import { Button } from './Button';
import { useApp } from '../context/AppContext';
import { rateCard, type Rating } from '../services/spacedRepetition';
import type { Flashcard } from '../types/flashcards';

interface FlashcardReviewProps {
  cards: Flashcard[];
  onDone: () => void;
}

export function FlashcardReview({ cards: initialCards, onDone }: FlashcardReviewProps) {
  const { updateFlashcard } = useApp();
  const [queue, setQueue] = useState<Flashcard[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  if (queue.length === 0 || currentIndex >= queue.length) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-bold text-app-dark dark:text-white mb-1">Review Complete!</p>
        <p className="text-sm text-gray-500 mb-4">{reviewed} card{reviewed !== 1 ? 's' : ''} reviewed</p>
        <Button onClick={onDone}>Back to Flashcards</Button>
      </div>
    );
  }

  const card = queue[currentIndex];

  function handleRate(rating: Rating) {
    const { interval, easeFactor, nextReviewDate } = rateCard(card, rating);
    updateFlashcard(card.id, { interval, easeFactor, nextReviewDate });
    setReviewed((r) => r + 1);
    setFlipped(false);

    if (rating === 'again') {
      setQueue((prev) => [...prev, { ...card, interval, easeFactor, nextReviewDate }]);
    }
    setCurrentIndex((i) => i + 1);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onDone} className="text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <ArrowLeft size={16} /> Back
        </button>
        <p className="text-xs text-gray-400">
          {currentIndex + 1} / {queue.length}
        </p>
      </div>

      {/* 3D flip card */}
      <div
        onClick={() => setFlipped(!flipped)}
        className="cursor-pointer select-none"
        style={{ perspective: '1200px', height: '260px' }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front face */}
          <div
            style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
            className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center justify-center hover:border-primary/30 transition-colors"
          >
            <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Question</p>
            <p className="text-lg font-semibold text-app-dark dark:text-white text-center leading-relaxed">
              {card.front}
            </p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-4 flex items-center gap-1">
              <RotateCcw size={12} /> Tap to reveal
            </p>
          </div>

          {/* Back face */}
          <div
            style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
            className="bg-purple-bg dark:bg-primary/10 rounded-2xl border-2 border-primary/30 p-6 flex flex-col items-center justify-center"
          >
            <p className="text-xs text-primary mb-3 uppercase tracking-wide font-semibold">Answer</p>
            <p className="text-lg font-semibold text-app-dark dark:text-white text-center leading-relaxed">
              {card.back}
            </p>
          </div>
        </div>
      </div>

      {flipped && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          <button
            onClick={() => handleRate('again')}
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <ThumbsDown size={20} />
            <span className="text-xs font-semibold">Again</span>
            <span className="text-xs text-red-400">Now</span>
          </button>
          <button
            onClick={() => handleRate('hard')}
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <Minus size={20} />
            <span className="text-xs font-semibold">Hard</span>
            <span className="text-xs text-amber-400">1d</span>
          </button>
          <button
            onClick={() => handleRate('easy')}
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <ThumbsUp size={20} />
            <span className="text-xs font-semibold">Easy</span>
            <span className="text-xs text-green-400">{Math.round(Math.max(card.interval * card.easeFactor, 3))}d</span>
          </button>
        </div>
      )}
    </div>
  );
}
