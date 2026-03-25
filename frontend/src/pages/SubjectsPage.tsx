import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronDown, ChevronUp, Plus, X, Calendar, Layers } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { SubjectAvatar, getSubjectColor } from '../components/SubjectAvatar';
import { NotesList } from '../components/NotesList';
import { TopicList } from '../components/TopicList';
import { useApp } from '../context/AppContext';
import { generateStudyPlan } from '../services/lmstudio';
import { daysUntilExam } from '../services/scheduler';
import type { SubjectDetail } from '../types';

export function SubjectsPage() {
  const navigate = useNavigate();
  const { profile, plan, setProfile, setPlan, updateSubjectProgress, flashcards } = useApp();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [addError, setAddError] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  // Sync topic-driven progress when profile topics change
  useEffect(() => {
    if (!profile || !plan) return;
    profile.subjectDetails.forEach((d) => {
      const topicList = d.topics ?? [];
      if (topicList.length === 0) return;
      const auto = Math.round((topicList.filter((t) => t.status === 'completed').length / topicList.length) * 100);
      const current = plan.subjectProgress.find((sp) => sp.subject === d.name)?.percentDone ?? 0;
      if (auto !== current) updateSubjectProgress(d.name, auto);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]); // intentionally omit plan/updateSubjectProgress to avoid infinite loop

  if (!profile || !plan) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg dark:bg-gray-950 pb-20">
        <p className="text-gray-400">No plan found. Complete onboarding first.</p>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];

  async function handleAddSubject() {
    if (!profile) return;
    const trimmed = newSubject.trim();
    if (!trimmed) { setAddError('Enter a subject name'); return; }
    if (profile.subjects.includes(trimmed)) { setAddError('Subject already exists'); return; }

    const newDetail: SubjectDetail = { id: crypto.randomUUID(), name: trimmed, examDate: newExamDate || undefined };
    const updatedProfile = {
      ...profile,
      subjects: [...profile.subjects, trimmed],
      subjectDetails: [...profile.subjectDetails, newDetail],
    };
    setProfile(updatedProfile);
    setShowAddModal(false);
    setNewSubject('');
    setNewExamDate('');
    setAddError('');

    setRegenerating(true);
    try {
      const newPlan = await generateStudyPlan(updatedProfile);
      setPlan(newPlan);
    } catch { /* keep old plan */ }
    setRegenerating(false);
  }

  function handleRemoveSubject(subject: string) {
    if (!profile) return;
    const updatedProfile = {
      ...profile,
      subjects: profile.subjects.filter((s) => s !== subject),
      subjectDetails: profile.subjectDetails.filter((d) => d.name !== subject),
    };
    setProfile(updatedProfile);
  }

  function updateExamDate(subject: string, examDate: string) {
    if (!profile) return;
    const updatedProfile = {
      ...profile,
      subjectDetails: profile.subjectDetails.map((d) =>
        d.name === subject ? { ...d, examDate: examDate || undefined } : d
      ),
    };
    setProfile(updatedProfile);
  }

  return (
    <div className="min-h-screen bg-app-bg dark:bg-gray-950 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-12">
        <div className="flex items-center gap-2 mb-6">
          <BookOpen size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-app-dark dark:text-white">My Subjects</h1>
        </div>

        {/* Flashcards quick access */}
        <button
          onClick={() => navigate('/subjects/flashcards')}
          className="w-full flex items-center justify-between p-3 mb-4 rounded-xl bg-purple-bg dark:bg-primary/10 hover:bg-primary/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-primary" />
            <span className="text-sm font-semibold text-primary">Flashcards</span>
          </div>
          <span className="text-xs text-primary/60">{flashcards.filter(c => c.nextReviewDate <= new Date().toISOString().split('T')[0]).length} due</span>
        </button>

        {regenerating && (
          <Card className="mb-4 border border-primary">
            <p className="text-sm text-primary text-center">Regenerating your plan with AI...</p>
          </Card>
        )}

        <div className="flex flex-col gap-3 mb-6">
          {plan.subjectProgress.map((sp) => {
            const color = getSubjectColor(sp.subject, profile.subjects);
            const detail = profile.subjectDetails.find((d) => d.name === sp.subject);
            const isExpanded = expanded === sp.subject;
            const days = daysUntilExam(detail?.examDate);
            const sessionsCount = plan.weeklySchedule.reduce(
              (count, day) => count + day.sessions.filter((s) => s.subject === sp.subject).length,
              0
            );

            return (
              <Card key={sp.subject}>
                <button className="w-full flex items-center gap-3" onClick={() => setExpanded(isExpanded ? null : sp.subject)}>
                  <SubjectAvatar subject={sp.subject} allSubjects={profile.subjects} color={color} />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-app-dark dark:text-white truncate">{sp.subject}</p>
                      {days !== null && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${days <= 7 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-purple-bg text-primary'}`}>
                          {days}d
                        </span>
                      )}
                    </div>
                    <ProgressBar value={sp.percentDone} color={color} className="mt-1.5" />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-bold" style={{ color }}>{sp.percentDone}%</span>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">{sessionsCount} sessions/week</p>
                      <button
                        onClick={() => handleRemoveSubject(sp.subject)}
                        className="text-xs text-red-400 hover:text-red-500 flex items-center gap-1"
                      >
                        <X size={12} /> Remove subject
                      </button>
                    </div>

                    {/* Exam date editor */}
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className="text-gray-400 flex-shrink-0" />
                      <input
                        type="date"
                        min={today}
                        value={detail?.examDate ?? ''}
                        onChange={(e) => updateExamDate(sp.subject, e.target.value)}
                        className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <span className="text-xs text-gray-400">Exam date</span>
                    </div>

                    {/* Progress — topic-driven when topics exist, manual slider otherwise */}
                    {(() => {
                      const topicList = detail?.topics ?? [];
                      const topicDriven = topicList.length > 0;
                      const autoPercent = topicDriven
                        ? Math.round((topicList.filter((t) => t.status === 'completed').length / topicList.length) * 100)
                        : sp.percentDone;

                      return (
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-xs text-gray-500">
                              Progress {topicDriven ? '(from topics)' : ''}
                            </span>
                            <span className="text-xs font-semibold" style={{ color }}>{autoPercent}%</span>
                          </div>
                          {topicDriven ? (
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div
                                className="h-2 rounded-full transition-all"
                                style={{ width: `${autoPercent}%`, backgroundColor: color }}
                              />
                            </div>
                          ) : (
                            <input
                              type="range"
                              min={0} max={100}
                              value={sp.percentDone}
                              onChange={(e) => updateSubjectProgress(sp.subject, Number(e.target.value))}
                              className="w-full cursor-pointer"
                              style={{ accentColor: color }}
                            />
                          )}
                        </div>
                      );
                    })()}

                    {/* Topics */}
                    <TopicList subjectId={detail?.id ?? ''} />

                    {/* Notes */}
                    <NotesList subjectId={detail?.id ?? ''} subjectName={sp.subject} />

                    {/* Per-subject flashcards link */}
                    <button
                      onClick={() => navigate(`/subjects/flashcards?subject=${detail?.id}`)}
                      className="flex items-center gap-1 text-xs text-primary font-semibold mt-1"
                    >
                      <Layers size={12} /> View Flashcards
                    </button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <Card variant="purple">
          <p className="text-sm font-semibold text-app-dark dark:text-white mb-1">Need to study something new?</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Adding a subject regenerates your AI schedule.</p>
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5">
            <Plus size={14} /> Add New Subject
          </Button>
        </Card>
      </div>

      {/* Add Subject Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-app-dark dark:text-white mb-4">Add New Subject</h3>
            <input
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-app-dark dark:text-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Subject name"
              value={newSubject}
              onChange={(e) => { setNewSubject(e.target.value); setAddError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubject(); }}
            />
            <div className="flex items-center gap-2 mb-2">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                min={today}
                value={newExamDate}
                onChange={(e) => setNewExamDate(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <span className="text-xs text-gray-400">Exam (optional)</span>
            </div>
            {addError && <p className="text-xs text-red-500 mb-3">{addError}</p>}
            <div className="flex gap-3 mt-4">
              <Button variant="ghost" onClick={() => setShowAddModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleAddSubject} className="flex-grow">Add Subject</Button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
