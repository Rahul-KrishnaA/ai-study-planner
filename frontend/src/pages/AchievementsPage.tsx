import { useNavigate } from 'react-router-dom';
import { Trophy, ChevronLeft } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';
import { Card } from '../components/Card';
import { useApp } from '../context/AppContext';
import { ACHIEVEMENT_DEFS } from '../types/achievements';

export function AchievementsPage() {
  const navigate = useNavigate();
  const { achievements } = useApp();

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length;

  return (
    <div className="min-h-screen bg-app-bg dark:bg-gray-950 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-12">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">
            <ChevronLeft size={20} />
          </button>
          <Trophy size={20} className="text-primary" />
          <h1 className="text-xl font-bold text-app-dark dark:text-white">Achievements</h1>
          <span className="ml-auto text-sm text-gray-400">{unlockedCount}/{ACHIEVEMENT_DEFS.length}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {ACHIEVEMENT_DEFS.map((def) => {
            const record = achievements.find((a) => a.id === def.id);
            const isUnlocked = !!record?.unlockedAt;
            const progress = record?.progress ?? 0;
            const pct = Math.min((progress / def.target) * 100, 100);

            return (
              <Card key={def.id} className={`${isUnlocked ? '' : 'opacity-60'}`}>
                <div className="flex flex-col items-center text-center gap-1">
                  <span className={`text-3xl ${isUnlocked ? '' : 'grayscale'}`}>{def.icon}</span>
                  <p className="text-sm font-bold text-app-dark dark:text-white leading-tight">{def.name}</p>
                  <p className="text-xs text-gray-400 leading-snug">{def.description}</p>
                  {isUnlocked ? (
                    <span className="text-xs text-green-500 font-semibold mt-1">✓ Unlocked</span>
                  ) : (
                    <div className="w-full mt-2">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>{progress}</span>
                        <span>{def.target}</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="h-1.5 rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
