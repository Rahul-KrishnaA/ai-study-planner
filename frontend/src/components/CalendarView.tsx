import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { StudyPlan, TrackedSession } from '../types';

interface CalendarViewProps {
  plan: StudyPlan;
  sessions: TrackedSession[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Maps JS getDay() index to plan day names
const JS_DAY_TO_PLAN: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

export function CalendarView({ plan, sessions }: CalendarViewProps) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  function isoDate(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function sessionsForDay(day: number) {
    const iso = isoDate(day);
    const date = new Date(year, month, day);
    const isPast = iso < today;

    if (isPast || iso === today) {
      return sessions.filter((s) => s.date === iso);
    }
    // Future: project weekly template
    const dayName = JS_DAY_TO_PLAN[date.getDay()];
    return plan.weeklySchedule.find((d) => d.day === dayName)?.sessions ?? [];
  }

  function studyHoursForDay(day: number): number {
    const iso = isoDate(day);
    return sessions.filter((s) => s.date === iso).reduce((sum, s) => sum + s.duration, 0) / 60;
  }

  function heatmapOpacity(day: number): number {
    const hours = studyHoursForDay(day);
    return Math.min(hours / 4, 1); // max opacity at 4 hours
  }

  function getSelectedDaySessions(isoStr: string) {
    // Use T12:00:00 to avoid UTC-vs-local day shift
    const date = new Date(isoStr + 'T12:00:00');
    const isPastOrToday = isoStr <= today;
    if (isPastOrToday) {
      return sessions.filter((s) => s.date === isoStr);
    }
    const dayName = JS_DAY_TO_PLAN[date.getDay()];
    return plan.weeklySchedule.find((d) => d.day === dayName)?.sessions ?? [];
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ChevronLeft size={16} className="text-gray-500" />
        </button>
        <span className="text-sm font-semibold text-app-dark dark:text-white">{monthLabel}</span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ChevronRight size={16} className="text-gray-500" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const iso = isoDate(day);
          const daySessions = sessionsForDay(day);
          const isToday = iso === today;
          const opacity = heatmapOpacity(day);
          const isSelected = selectedDay === iso;

          return (
            <button
              key={iso}
              onClick={() => setSelectedDay(isSelected ? null : iso)}
              className={`relative aspect-square rounded-lg flex flex-col items-center justify-start pt-1 transition-colors
                ${isToday ? 'ring-2 ring-primary' : ''}
                ${isSelected ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
              `}
              style={opacity > 0 && !isSelected ? { backgroundColor: `rgba(108,71,255,${opacity * 0.15})` } : {}}
            >
              <span className={`text-xs font-medium leading-none ${isToday ? 'text-primary font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                {day}
              </span>
              {/* Session dots */}
              {daySessions.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                  {daySessions.slice(0, 3).map((_, i) => (
                    <div key={i} className="w-1 h-1 rounded-full bg-primary" />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (() => {
        const daySessions = getSelectedDaySessions(selectedDay);
        return (
          <div className="mt-4 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
            <p className="text-xs font-semibold text-gray-500 mb-2">
              {new Date(selectedDay + 'T12:00:00').toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            {daySessions.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No sessions planned.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {daySessions.map((s, i) => {
                  const isTracked = 'duration' in s && (s as TrackedSession).duration > 0;
                  const label = isTracked
                    ? `${s.subject} — ${(s as TrackedSession).duration} min`
                    : 'startTime' in s
                      ? `${s.subject} ${(s as { startTime: string }).startTime}`
                      : s.subject;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
