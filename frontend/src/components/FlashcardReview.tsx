import { useState } from 'react';
import { RotateCcw, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import type { Flashcard } from '../types/flashcards';

interface FlashcardReviewProps {
  cards: Flashcard[];
  onDone: () => void;
}

export function FlashcardReview({ cards, onDone }: FlashcardReviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  if (cards.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-bold text-app-dark dark:text-white mb-1">No cards to review</p>
        <Button onClick={onDone}>Back to Flashcards</Button>
      </div>
    );
  }

  if (currentIndex >= cards.length) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-bold text-app-dark dark:text-white mb-1">Review Complete!</p>
        <p className="text-sm text-gray-500 mb-4">{cards.length} card{cards.length !== 1 ? 's' : ''} reviewed</p>
        <Button onClick={onDone}>Back to Flashcards</Button>
      </div>
    );
  }

  const card = cards[currentIndex];

  function goNext() {
    setFlipped(false);
    setCurrentIndex((i) => i + 1);
  }

  function goPrev() {
    setFlipped(false);
    setCurrentIndex((i) => Math.max(0, i - 1));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={onDone} className="text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <ArrowLeft size={16} /> Back
        </button>
        <p className="text-xs text-gray-400">
          {currentIndex + 1} / {cards.length}
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

      <div className="flex items-center justify-between mt-4">
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-semibold text-sm disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronLeft size={18} /> Previous
        </button>
        <span className="text-xs text-gray-400">{currentIndex + 1} / {cards.length}</span>
        <button
          onClick={goNext}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          {currentIndex === cards.length - 1 ? 'Finish' : 'Next'} <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
