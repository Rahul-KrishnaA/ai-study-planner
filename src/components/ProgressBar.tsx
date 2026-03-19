interface ProgressBarProps {
  value: number; // 0–100
  className?: string;
  color?: string;
  height?: string;
}

export function ProgressBar({ value, className = '', color = '#6C47FF', height = 'h-2' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ${height} ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${clamped}%`, backgroundColor: color }}
      />
    </div>
  );
}
