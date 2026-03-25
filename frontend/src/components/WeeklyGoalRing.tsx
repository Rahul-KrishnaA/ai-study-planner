interface WeeklyGoalRingProps {
  hoursStudied: number;
  goalHours: number;
}

export function WeeklyGoalRing({ hoursStudied, goalHours }: WeeklyGoalRingProps) {
  const pct = goalHours > 0 ? Math.min(hoursStudied / goalHours, 1) : 0;
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="4"
            className="text-gray-200 dark:text-gray-700" />
          <circle cx="32" cy="32" r={r} fill="none" stroke="#6C47FF" strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-app-dark dark:text-white leading-none">
            {hoursStudied.toFixed(1)}
          </span>
          <span className="text-xs text-gray-400 leading-none">h</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        / {goalHours}h goal
      </p>
    </div>
  );
}
