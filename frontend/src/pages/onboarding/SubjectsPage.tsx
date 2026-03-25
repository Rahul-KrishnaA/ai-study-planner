import { useState } from 'react';
import { Plus, X, Calendar } from 'lucide-react';
import { Button } from '../../components/Button';
import type { SubjectDetail } from '../../types';

interface SubjectsPageProps {
  initialSubjects: SubjectDetail[];
  onNext: (subjects: SubjectDetail[]) => void;
  onBack: () => void;
  step: number;
  totalSteps: number;
}

export function SubjectsPage({ initialSubjects, onNext, onBack, step, totalSteps }: SubjectsPageProps) {
  const [subjects, setSubjects] = useState<SubjectDetail[]>(initialSubjects);
  const [inputName, setInputName] = useState('');
  const [inputDate, setInputDate] = useState('');
  const [error, setError] = useState('');

  function addSubject() {
    const trimmed = inputName.trim();
    if (!trimmed) return;
    if (subjects.find((s) => s.name === trimmed)) { setError('Subject already added'); return; }
    setSubjects((prev) => [...prev, { id: crypto.randomUUID(), name: trimmed, examDate: inputDate || undefined }]);
    setInputName('');
    setInputDate('');
    setError('');
  }

  function updateExamDate(name: string, date: string) {
    setSubjects((prev) => prev.map((s) => s.name === name ? { ...s, examDate: date || undefined } : s));
  }

  function removeSubject(name: string) {
    setSubjects((prev) => prev.filter((s) => s.name !== name));
  }

  function handleNext() {
    if (subjects.length === 0) { setError('Add at least one subject'); return; }
    onNext(subjects);
  }

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="flex flex-col min-h-screen px-6 pt-12 pb-8 bg-app-bg dark:bg-gray-950">
      <div className="flex gap-2 mb-10">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`h-1 rounded-full flex-1 transition-all ${i < step ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'}`} />
        ))}
      </div>

      <h2 className="text-2xl font-bold text-app-dark dark:text-white mb-1">Your Subjects</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Add subjects and optional exam dates for priority scheduling.
      </p>

      {/* Input row */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex gap-2">
          <input
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-app-dark dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="e.g. Mathematics"
            value={inputName}
            onChange={(e) => { setInputName(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubject(); } }}
          />
          <button
            onClick={addSubject}
            className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center flex-shrink-0 hover:bg-primary-dark active:scale-95 transition-all"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="date"
            min={today}
            value={inputDate}
            onChange={(e) => setInputDate(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <span className="text-xs text-gray-400">Exam date (optional)</span>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {/* Subject list */}
      <div className="flex-1 overflow-y-auto">
        {subjects.length === 0 && <p className="text-gray-400 text-sm mt-2">No subjects added yet.</p>}
        {subjects.map((s) => (
          <div key={s.name} className="flex flex-col bg-white dark:bg-gray-800 rounded-xl px-3 py-2.5 mb-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-app-dark dark:text-white">{s.name}</span>
              <button onClick={() => removeSubject(s.name)} className="text-gray-400 hover:text-red-400">
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <Calendar size={12} className="text-gray-400" />
              <input
                type="date"
                min={today}
                value={s.examDate ?? ''}
                onChange={(e) => updateExamDate(s.name, e.target.value)}
                className="text-xs text-gray-500 dark:text-gray-400 bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 cursor-pointer"
              />
              {s.examDate ? (
                <span className="text-xs bg-purple-bg dark:bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                  Exam: {new Date(s.examDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              ) : (
                <span className="text-xs text-gray-400">No exam date</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="ghost" onClick={onBack} className="flex-1">Back</Button>
        <Button onClick={handleNext} className="flex-grow">Next</Button>
      </div>
    </div>
  );
}
