import { useState, useEffect } from 'react';
import { BarChart2, Zap, TrendingUp } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { SubjectAvatar, getSubjectColor } from '../components/SubjectAvatar';
import { useApp } from '../context/AppContext';
import { generateInsights } from '../services/lmstudio';

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDates(): string[] {
  const dates: string[] = [];
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7));
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function getMonthDates(): string[] {
  const now = new Date();
  const dates: string[] = [];
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  while (d.getMonth() === now.getMonth()) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export function StatsPage() {
  const { sessions, profile, plan } = useApp();
  const [filter, setFilter] = useState<'week' | 'month'>('week');
  const [insights, setInsights] = useState<{ type: string; title: string; body: string }[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  const dates = filter === 'week' ? getWeekDates() : getMonthDates();
  const filtered = sessions.filter((s) => dates.includes(s.date));

  const totalMinutes = filtered.reduce((sum, s) => sum + s.duration, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const completedCount = filtered.filter((s) => s.completed).length;

  // Focus score: completed sessions / planned sessions (capped at 100)
  const plannedPerWeek = plan
    ? plan.weeklySchedule.reduce((t, d) => t + d.sessions.length, 0)
    : 0;
  const plannedForPeriod = filter === 'week' ? plannedPerWeek : plannedPerWeek * 4;
  const focusScore = plannedForPeriod > 0
    ? Math.min(100, Math.round((completedCount / plannedForPeriod) * 100))
    : 0;

  // Hours per day (week view)
  const barData = DAYS_SHORT.map((label, i) => {
    const date = getWeekDates()[i];
    const mins = sessions.filter((s) => s.date === date).reduce((sum, s) => sum + s.duration, 0);
    return { label, hours: mins / 60 };
  });
  const maxHours = Math.max(...barData.map((d) => d.hours), 1);

  // Subject breakdown
  const subjectMinutes: Record<string, number> = {};
  filtered.forEach((s) => { subjectMinutes[s.subject] = (subjectMinutes[s.subject] || 0) + s.duration; });
  const subjectEntries = Object.entries(subjectMinutes).sort((a, b) => b[1] - a[1]);

  // Completed vs pending (this week)
  const weekDates = getWeekDates();
  const completedThisWeek = sessions.filter((s) => weekDates.includes(s.date) && s.completed).length;
  const pendingThisWeek = Math.max(0, plannedPerWeek - completedThisWeek);

  useEffect(() => {
    if (!profile || filtered.length === 0) return;
    setLoadingInsights(true);
    const sessionData = filtered.map((s) => ({ subject: s.subject, duration: s.duration, date: s.date }));
    generateInsights(profile, sessionData)
      .then(setInsights)
      .finally(() => setLoadingInsights(false));
  }, [filter]);

  return (
    <div className="min-h-screen bg-app-bg dark:bg-gray-950 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart2 size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-app-dark dark:text-white">Analytics</h1>
          </div>
          <div className="flex gap-1 bg-gray-200 dark:bg-gray-800 rounded-xl p-1">
            {(['week', 'month'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${filter === f ? 'bg-white dark:bg-gray-700 text-primary shadow-sm' : 'text-gray-400'}`}
              >
                {f === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Hours</p>
            <p className="text-2xl font-bold text-primary">{totalHours}h</p>
            <p className="text-xs text-gray-400 mt-1">{completedCount} sessions</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Focus Score</p>
            <p className="text-2xl font-bold text-app-dark dark:text-white">{focusScore}</p>
            <ProgressBar value={focusScore} className="mt-2" />
          </Card>
        </div>

        {/* Completed vs Pending */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Card className="bg-green-50 dark:bg-green-900/20">
            <p className="text-xs text-green-600 dark:text-green-400 font-semibold mb-1">Completed</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-300">{completedThisWeek}</p>
            <p className="text-xs text-green-600 dark:text-green-400">this week</p>
          </Card>
          <Card className="bg-amber-50 dark:bg-amber-900/20">
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mb-1">Pending</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{pendingThisWeek}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">this week</p>
          </Card>
        </div>

        {/* Bar chart (week) */}
        {filter === 'week' && (
          <Card className="mb-5">
            <p className="text-sm font-semibold text-app-dark dark:text-white mb-4">Daily Study Activity</p>
            <div className="flex items-end gap-1.5 h-28">
              {barData.map(({ label, hours }) => (
                <div key={label} className="flex-1 flex flex-col items-center gap-1">
                  {hours > 0 && (
                    <span className="text-xs text-primary font-semibold" style={{ fontSize: 10 }}>{hours.toFixed(1)}h</span>
                  )}
                  <div className="w-full relative flex items-end justify-center" style={{ height: '80px' }}>
                    <div
                      className="w-full rounded-t-md bg-primary/80 transition-all"
                      style={{ height: `${Math.max(0, (hours / maxHours) * 100)}%`, minHeight: hours > 0 ? 4 : 0 }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{label}</span>
                </div>
              ))}
            </div>
            {filtered.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-2">No sessions tracked yet.</p>
            )}
          </Card>
        )}

        {/* Subject breakdown */}
        {subjectEntries.length > 0 && (
          <Card className="mb-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-primary" />
              <p className="text-sm font-semibold text-app-dark dark:text-white">Time by Subject</p>
            </div>
            <div className="flex flex-col gap-3">
              {subjectEntries.map(([subject, mins]) => {
                const pct = totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0;
                const color = getSubjectColor(subject, profile?.subjects ?? []);
                return (
                  <div key={subject} className="flex items-center gap-3">
                    <SubjectAvatar subject={subject} allSubjects={profile?.subjects ?? []} size="sm" color={color} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-semibold text-app-dark dark:text-white truncate">{subject}</span>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{(mins / 60).toFixed(1)}h</span>
                      </div>
                      <ProgressBar value={pct} color={color} height="h-1.5" />
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0 w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* AI Insights */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">AI Insights</p>
          {loadingInsights && (
            <Card className="mb-3"><p className="text-sm text-gray-400 text-center">Generating insights...</p></Card>
          )}
          {!loadingInsights && insights.length === 0 && filtered.length === 0 && (
            <Card variant="purple">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Start and complete study sessions to get personalized AI insights here.
              </p>
            </Card>
          )}
          {insights.map((insight, i) => (
            <Card key={i} variant="purple" className="mb-3">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Zap size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-app-dark dark:text-white mb-1">{insight.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{insight.body}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
