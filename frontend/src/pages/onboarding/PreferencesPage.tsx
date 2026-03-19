import { useState } from 'react';
import { Sun, Sunset, Moon } from 'lucide-react';
import { Button } from '../../components/Button';
import type { UserProfile } from '../../types';

interface PreferencesPageProps {
  initialTime: UserProfile['preferredTime'];
  initialGoal: number;
  onFinish: (time: UserProfile['preferredTime'], goal: number) => void;
  onBack: () => void;
  loading: boolean;
  step: number;
  totalSteps: number;
}

const TIME_OPTIONS: { value: UserProfile['preferredTime']; label: string; icon: typeof Sun; desc: string }[] = [
  { value: 'morning', label: 'Morning', icon: Sun, desc: '6 AM – 12 PM' },
  { value: 'afternoon', label: 'Afternoon', icon: Sunset, desc: '12 PM – 6 PM' },
  { value: 'evening', label: 'Evening', icon: Moon, desc: '6 PM – 12 AM' },
];

export function PreferencesPage({ initialTime, initialGoal, onFinish, onBack, loading, step, totalSteps }: PreferencesPageProps) {
  const [time, setTime] = useState<UserProfile['preferredTime']>(initialTime);
  const [goal, setGoal] = useState(initialGoal);

  return (
    <div className="flex flex-col min-h-screen px-6 pt-12 pb-8 bg-app-bg dark:bg-gray-950">
      <div className="flex gap-2 mb-10">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full flex-1 transition-all ${
              i < step ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>

      <h2 className="text-2xl font-bold text-app-dark dark:text-white mb-2">Study Preferences</h2>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Customize your schedule to fit your lifestyle.
      </p>

      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Preferred study time
        </p>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {TIME_OPTIONS.map(({ value, label, icon: Icon, desc }) => (
            <button
              key={value}
              onClick={() => setTime(value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                time === value
                  ? 'border-primary bg-purple-bg dark:bg-primary/20'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
              }`}
            >
              <Icon
                size={22}
                className={time === value ? 'text-primary' : 'text-gray-400'}
              />
              <span className={`text-xs font-semibold ${time === value ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`}>
                {label}
              </span>
              <span className="text-xs text-gray-400 text-center leading-tight">{desc}</span>
            </button>
          ))}
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Daily study goal
            </p>
            <span className="text-primary font-bold text-lg">{goal}h</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="w-full accent-primary h-2 rounded-full cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1h</span>
            <span>10h</span>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <Button variant="ghost" onClick={onBack} className="flex-1" disabled={loading}>
          Back
        </Button>
        <Button onClick={() => onFinish(time, goal)} className="flex-grow" loading={loading}>
          Generate My Plan
        </Button>
      </div>
    </div>
  );
}
