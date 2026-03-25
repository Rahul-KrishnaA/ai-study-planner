import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Play, User, ChevronRight, AlertCircle, Timer } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { ProgressBar } from '../components/ProgressBar';
import { SubjectAvatar, getSubjectColor } from '../components/SubjectAvatar';
import { PomodoroTimer } from '../components/PomodoroTimer';
import { NoteEditor } from '../components/NoteEditor';
import { useApp } from '../context/AppContext';
import { nextExam } from '../services/scheduler';
import type { SubjectDetail } from '../types';

function formatTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${period}`;
}

function getTodayDay(): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()];
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

export function HomePage() {
  const navigate = useNavigate();
  const { profile, plan, streak, missedSessions, dismissMissed, addNote } = useApp();
  const [activeSession, setActiveSession] = useState<{
    subject: string;
    chapter: string;
    plannedSessionId?: string;
    topicName?: string;
  } | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | undefined>(undefined);
  const [noteEditorSubject, setNoteEditorSubject] = useState<SubjectDetail | null>(null);

  if (!profile || !plan) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg dark:bg-gray-950 pb-20">
        <div className="text-center px-6">
          <p className="text-gray-500 mb-4">No plan found.</p>
          <Button onClick={() => navigate('/')}>Go to Setup</Button>
        </div>
      </div>
    );
  }

  const today = getTodayDay();
  const todaySchedule = plan.weeklySchedule.find((d) => d.day === today);
  const nextSession = todaySchedule?.sessions[0];
  const insight = plan.insights[0];

  const syllabusAvg = plan.subjectProgress.length > 0
    ? Math.round(plan.subjectProgress.reduce((s, p) => s + p.percentDone, 0) / plan.subjectProgress.length)
    : 0;

  const upcomingExam = nextExam(profile.subjectDetails);

  function handlePomodoroComplete() {
    setActiveSession(null);
  }

  function handlePomodoroCancel() {
    setActiveSession(null);
  }

  return (
    <div className="min-h-screen bg-app-bg dark:bg-gray-950 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Good {getGreeting()},</p>
            <h1 className="text-2xl font-bold text-app-dark dark:text-white">{profile.name}</h1>
            {profile.institution && (
              <p className="text-xs text-gray-400 mt-0.5">{profile.institution}{profile.semester ? ` — ${profile.semester}` : ''}</p>
            )}
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="w-10 h-10 rounded-full bg-purple-bg dark:bg-gray-800 flex items-center justify-center"
          >
            <User size={18} className="text-primary" />
          </button>
        </div>

        {/* Missed sessions alert */}
        {missedSessions.length > 0 && (
          <Card className="mb-4 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {missedSessions.length} missed session{missedSessions.length > 1 ? 's' : ''} rescheduled
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                  {missedSessions.map((m) => m.subject).join(', ')} — moved to upcoming slots in your timetable.
                </p>
              </div>
              <button onClick={dismissMissed} className="text-amber-400 hover:text-amber-600 text-xs font-medium">Dismiss</button>
            </div>
          </Card>
        )}

        {/* Exam countdown */}
        {upcomingExam && (
          <Card variant="purple" className="mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Timer size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">Next Exam</p>
                  <p className="text-sm font-bold text-app-dark dark:text-white">{upcomingExam.subject}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{upcomingExam.daysLeft}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">day{upcomingExam.daysLeft !== 1 ? 's' : ''} left</p>
              </div>
            </div>
          </Card>
        )}

        {/* AI Insight */}
        {insight && (
          <Card variant="purple" className="mb-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Zap size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-primary mb-0.5 uppercase tracking-wide">AI Insight</p>
                <p className="text-sm font-semibold text-app-dark dark:text-white mb-1">{insight.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{insight.body}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Active Pomodoro Timer */}
        {activeSession && (
          <div className="mb-4">
            <PomodoroTimer
              subject={activeSession.subject}
              chapter={activeSession.chapter}
              plannedSessionId={activeSession.plannedSessionId}
              topicName={activeSession.topicName}
              onComplete={handlePomodoroComplete}
              onCancel={handlePomodoroCancel}
              onAddNote={() => {
                const detail = profile.subjectDetails.find(d => d.name === activeSession.subject);
                if (detail) setNoteEditorSubject(detail);
              }}
            />
            {noteEditorSubject && (
              <NoteEditor
                subjectId={noteEditorSubject.id}
                subjectName={noteEditorSubject.name}
                onSave={(note) => { addNote(note); setNoteEditorSubject(null); }}
                onCancel={() => setNoteEditorSubject(null)}
              />
            )}
          </div>
        )}

        {/* Up Next */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            Up Next — {today}
          </p>
          {nextSession ? (
            <Card>
              <div className="flex items-start gap-3">
                <SubjectAvatar subject={nextSession.subject} allSubjects={profile.subjects} color={nextSession.color} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: nextSession.color }}>
                      {nextSession.subject}
                    </span>
                    {nextSession.rescheduled && (
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                        Rescheduled
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatTime(nextSession.startTime)} – {formatTime(nextSession.endTime)}</span>
                  </div>
                  <p className="text-base font-bold text-app-dark dark:text-white mb-3 truncate">{nextSession.chapter}</p>
                  {!activeSession && (() => {
                    const detail = profile.subjectDetails.find((d) => d.name === nextSession.subject);
                    const pendingTopics = detail?.topics?.filter((t) => t.status !== 'completed') ?? [];
                    return (
                      <div className="flex flex-col gap-2">
                        {pendingTopics.length > 0 && (
                          <select
                            className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
                            value={selectedTopicId ?? ''}
                            onChange={(e) => setSelectedTopicId(e.target.value || undefined)}
                          >
                            <option value="">Select topic (optional)</option>
                            {pendingTopics.map((t) => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        )}
                        <Button
                          size="sm"
                          onClick={() => {
                            const topicName = selectedTopicId
                              ? detail?.topics?.find((t) => t.id === selectedTopicId)?.name
                              : undefined;
                            setActiveSession({
                              subject: nextSession.subject,
                              chapter: topicName ?? nextSession.chapter,
                              plannedSessionId: nextSession.id,
                              topicName,
                            });
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <Play size={14} /> Start Session
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <p className="text-sm text-gray-400 text-center py-2">No sessions scheduled for today.</p>
            </Card>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Syllabus Done</p>
            <p className="text-2xl font-bold text-primary">{syllabusAvg}%</p>
            <ProgressBar value={syllabusAvg} className="mt-2" />
          </Card>
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Day Streak</p>
            <p className="text-2xl font-bold text-app-dark dark:text-white">{streak}</p>
            <p className="text-xs text-gray-400 mt-1">days in a row</p>
          </Card>
        </div>

        {/* Subjects */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Subjects</p>
            <button onClick={() => navigate('/subjects')} className="text-xs text-primary font-semibold flex items-center gap-0.5">
              View All <ChevronRight size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {plan.subjectProgress.slice(0, 4).map((sp) => {
              const detail = profile.subjectDetails.find((d) => d.name === sp.subject);
              const color = getSubjectColor(sp.subject, profile.subjects);
              const days = detail?.examDate ? Math.max(0, Math.ceil((new Date(detail.examDate).getTime() - Date.now()) / 86400000)) : null;
              return (
                <Card key={sp.subject} className="flex items-center gap-3 py-3">
                  <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-app-dark dark:text-white truncate">{sp.subject}</p>
                      {days !== null && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0 ${days <= 7 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                          {days}d
                        </span>
                      )}
                    </div>
                    <ProgressBar value={sp.percentDone} color={color} className="mt-1" />
                  </div>
                  <span className="text-xs font-semibold text-gray-500 flex-shrink-0">{sp.percentDone}%</span>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
