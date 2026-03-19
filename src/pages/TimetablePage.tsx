import { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { useApp } from '../context/AppContext';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const START_HOUR = 7;
const END_HOUR = 23;
const HOUR_HEIGHT = 60; // px per hour

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return '12 AM';
  if (h === 12) return '12 PM';
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

export function TimetablePage() {
  const { plan } = useApp();
  const gridRef = useRef<HTMLDivElement>(null);

  if (!plan) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-bg dark:bg-gray-950 pb-20">
        <p className="text-gray-400">No plan generated yet. Complete onboarding first.</p>
      </div>
    );
  }

  const totalHours = END_HOUR - START_HOUR;
  const gridHeight = totalHours * HOUR_HEIGHT;

  return (
    <div className="min-h-screen bg-app-bg dark:bg-gray-950 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="px-4 pt-12 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-app-dark dark:text-white">Smart Timetable</h1>
          </div>
          <p className="text-xs text-gray-400">Your AI-generated weekly schedule</p>
        </div>

        {/* Scrollable grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            {/* Day headers */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-app-bg dark:bg-gray-950 z-10">
              <div className="w-12 flex-shrink-0" />
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="flex-1 text-center py-2 text-xs font-semibold text-gray-500 dark:text-gray-400"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div className="flex relative" ref={gridRef}>
              {/* Time labels */}
              <div className="w-12 flex-shrink-0 relative" style={{ height: gridHeight }}>
                {Array.from({ length: totalHours + 1 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 text-right pr-2"
                    style={{ top: i * HOUR_HEIGHT - 8 }}
                  >
                    <span className="text-xs text-gray-400">{formatHour(START_HOUR + i)}</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {FULL_DAYS.map((fullDay, dayIdx) => {
                const dayData = plan.weeklySchedule.find((d) => d.day === fullDay);
                return (
                  <div
                    key={fullDay}
                    className="flex-1 relative border-l border-gray-100 dark:border-gray-800"
                    style={{ height: gridHeight }}
                  >
                    {/* Hour lines */}
                    {Array.from({ length: totalHours }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800"
                        style={{ top: i * HOUR_HEIGHT }}
                      />
                    ))}

                    {/* Sessions */}
                    {dayData?.sessions.map((session, si) => {
                      const startMins = timeToMinutes(session.startTime);
                      const endMins = timeToMinutes(session.endTime);
                      const top = (startMins - START_HOUR * 60) * (HOUR_HEIGHT / 60);
                      const height = (endMins - startMins) * (HOUR_HEIGHT / 60);

                      if (top < 0 || height <= 0) return null;

                      return (
                        <div
                          key={`${dayIdx}-${si}`}
                          className="absolute left-1 right-1 rounded-lg px-1.5 py-1 overflow-hidden"
                          style={{
                            top,
                            height,
                            backgroundColor: session.color + '33',
                            borderLeft: `3px solid ${session.color}`,
                          }}
                        >
                          <p
                            className="text-xs font-semibold truncate leading-tight"
                            style={{ color: session.color }}
                          >
                            {session.subject}
                          </p>
                          {height > 30 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate" style={{ fontSize: 10 }}>
                              {session.startTime}–{session.endTime}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 py-4 px-4">
          Drag to reschedule (coming soon)
        </p>
      </div>
      <BottomNav />
    </div>
  );
}
