import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Layers } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { FlashcardReview } from '../components/FlashcardReview';
import { useApp } from '../context/AppContext';
import { isDueToday, isMastered, getReviewStats } from '../services/spacedRepetition';
import type { Flashcard } from '../types/flashcards';

export function FlashcardsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterSubjectId = searchParams.get('subject');

  const { profile, flashcards, addFlashcard, deleteFlashcard } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(filterSubjectId);

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [cardSubjectId, setCardSubjectId] = useState(filterSubjectId ?? profile?.subjectDetails[0]?.id ?? '');
  const [createError, setCreateError] = useState('');

  if (!profile) return null;

  const subjects = profile.subjectDetails;

  const filtered = selectedSubjectId
    ? flashcards.filter((c) => c.subjectId === selectedSubjectId)
    : flashcards;

  const stats = getReviewStats(filtered);
  const dueCards = filtered.filter(isDueToday);

  function getSubjectName(subjectId: string): string {
    return subjects.find((s) => s.id === subjectId)?.name ?? 'Unknown';
  }

  function handleCreate() {
    if (!front.trim()) { setCreateError('Question is required'); return; }
    if (!back.trim()) { setCreateError('Answer is required'); return; }

    const card: Flashcard = {
      id: crypto.randomUUID(),
      subjectId: cardSubjectId,
      front: front.trim(),
      back: back.trim(),
      nextReviewDate: new Date().toISOString().split('T')[0],
      interval: 0,
      easeFactor: 2.5,
      createdAt: new Date().toISOString(),
    };
    addFlashcard(card);
    setFront('');
    setBack('');
    setCreateError('');
    setShowCreate(false);
  }

  if (reviewMode) {
    return (
      <div className="min-h-screen bg-app-bg dark:bg-gray-950 pb-24">
        <div className="max-w-lg mx-auto px-4 pt-12">
          <FlashcardReview cards={dueCards} onDone={() => setReviewMode(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg dark:bg-gray-950 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/subjects')} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Layers size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-app-dark dark:text-white">Flashcards</h1>
          </div>
        </div>

        {/* Subject filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          <button
            onClick={() => setSelectedSubjectId(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              !selectedSubjectId ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            }`}
          >
            All
          </button>
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSubjectId(s.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selectedSubjectId === s.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card>
            <p className="text-xs text-gray-500 mb-0.5">Due Today</p>
            <p className="text-xl font-bold text-primary">{stats.dueToday}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 mb-0.5">Mastered</p>
            <p className="text-xl font-bold text-green-500">{stats.mastered}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 mb-0.5">Total</p>
            <p className="text-xl font-bold text-app-dark dark:text-white">{stats.total}</p>
          </Card>
        </div>

        {/* Review button */}
        {dueCards.length > 0 && (
          <Button onClick={() => setReviewMode(true)} className="w-full mb-4">
            Review {dueCards.length} Due Card{dueCards.length !== 1 ? 's' : ''}
          </Button>
        )}

        {/* Card list */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Cards ({filtered.length})
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs text-primary font-semibold flex items-center gap-1"
          >
            <Plus size={12} /> New Card
          </button>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-400 text-center py-4">
              No flashcards yet. Create one to get started!
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((card) => (
              <Card key={card.id} className="group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-bg dark:bg-primary/20 text-primary font-semibold">
                        {getSubjectName(card.subjectId)}
                      </span>
                      {isMastered(card) && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600">
                          Mastered
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-app-dark dark:text-white truncate">{card.front}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{card.back}</p>
                  </div>
                  <button
                    onClick={() => deleteFlashcard(card.id)}
                    className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-app-dark dark:text-white mb-4">New Flashcard</h3>

            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Subject</label>
              <select
                value={cardSubjectId}
                onChange={(e) => setCardSubjectId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-app-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <textarea
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-app-dark dark:text-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              placeholder="Question (front)"
              value={front}
              onChange={(e) => { setFront(e.target.value); setCreateError(''); }}
            />

            <textarea
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-app-dark dark:text-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              placeholder="Answer (back)"
              value={back}
              onChange={(e) => { setBack(e.target.value); setCreateError(''); }}
            />

            {createError && <p className="text-xs text-red-500 mb-3">{createError}</p>}

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleCreate} className="flex-grow">Create Card</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
