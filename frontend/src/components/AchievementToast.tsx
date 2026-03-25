import { useEffect, useState } from 'react';
import { ACHIEVEMENT_DEFS } from '../types/achievements';

interface AchievementToastProps {
  achievementId: string;
  onDismiss: () => void;
}

export function AchievementToast({ achievementId, onDismiss }: AchievementToastProps) {
  const [visible, setVisible] = useState(false);
  const def = ACHIEVEMENT_DEFS.find((d) => d.id === achievementId);

  useEffect(() => {
    // Slide in
    const t1 = setTimeout(() => setVisible(true), 50);
    // Auto-dismiss after 3.5s
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, 3500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDismiss]);

  if (!def) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
    >
      <div className="bg-white dark:bg-gray-900 border border-primary/30 rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3 min-w-[260px]">
        <span className="text-2xl">{def.icon}</span>
        <div>
          <p className="text-xs font-semibold text-primary uppercase tracking-wide">Achievement Unlocked!</p>
          <p className="text-sm font-bold text-app-dark dark:text-white">{def.name}</p>
          <p className="text-xs text-gray-400">{def.description}</p>
        </div>
      </div>
    </div>
  );
}
