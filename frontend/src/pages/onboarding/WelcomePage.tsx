import { BookOpen } from 'lucide-react';
import { Button } from '../../components/Button';

interface WelcomePageProps {
  onNext: () => void;
}

export function WelcomePage({ onNext }: WelcomePageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center bg-app-bg dark:bg-gray-950">
      <div className="w-24 h-24 rounded-3xl bg-primary flex items-center justify-center mb-8 shadow-lg shadow-primary/30">
        <BookOpen size={44} className="text-white" />
      </div>

      <h1 className="text-3xl font-bold text-app-dark dark:text-white mb-3">
        AI Study Planner
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-base leading-relaxed max-w-xs mb-10">
        Your personalized AI-powered schedule to study smarter, not harder.
      </p>

      {/* Step indicators */}
      <div className="flex gap-2 mb-12">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all ${
              i === 0 ? 'w-8 bg-primary' : 'w-4 bg-gray-300 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>

      <Button onClick={onNext} size="lg" fullWidth className="max-w-xs">
        Get Started
      </Button>
    </div>
  );
}
