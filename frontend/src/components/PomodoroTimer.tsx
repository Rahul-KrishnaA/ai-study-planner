import { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Square, SkipForward, RotateCcw } from 'lucide-react';
import { Button } from './Button';
import { useApp } from '../context/AppContext';
import type { TrackedSession } from '../types';

type TimerPhase = 'work' | 'break' | 'longBreak';

interface PomodoroTimerProps {
  subject: string;
  chapter: string;
  plannedSessionId?: string;
  topicName?: string;
  onComplete: () => void;
  onCancel: () => void;
  onAddNote?: () => void;
}

export function PomodoroTimer({ subject, chapter, plannedSessionId, topicName, onComplete, onCancel, onAddNote }: PomodoroTimerProps) {
  const { settings, addSession } = useApp();
  const {
    pomodoroWorkMinutes,
    pomodoroBreakMinutes,
    pomodoroLongBreakMinutes,
    pomodorosBeforeLongBreak,
  } = settings;

  const [phase, setPhase] = useState<TimerPhase>('work');
  const [secondsLeft, setSecondsLeft] = useState(pomodoroWorkMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedPomodoros, setCompletedPomodoros] = useState(0);
  const [totalWorkSeconds, setTotalWorkSeconds] = useState(0);

  const totalSeconds = phase === 'work'
    ? pomodoroWorkMinutes * 60
    : phase === 'break'
      ? pomodoroBreakMinutes * 60
      : pomodoroLongBreakMinutes * 60;

  const progress = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;

  // Timer tick
  useEffect(() => {
    if (!isRunning) return;
    const iv = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(iv);
          return 0;
        }
        return prev - 1;
      });
      if (phase === 'work') {
        setTotalWorkSeconds((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [isRunning, phase]);

  // Phase completion
  useEffect(() => {
    if (secondsLeft !== 0) return;
    if (!isRunning) return;

    setIsRunning(false);

    // Play audio alert
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch { /* audio not available */ }

    if (phase === 'work') {
      const newCount = completedPomodoros + 1;
      setCompletedPomodoros(newCount);

      if (newCount % pomodorosBeforeLongBreak === 0) {
        setPhase('longBreak');
        setSecondsLeft(pomodoroLongBreakMinutes * 60);
      } else {
        setPhase('break');
        setSecondsLeft(pomodoroBreakMinutes * 60);
      }
    } else {
      setPhase('work');
      setSecondsLeft(pomodoroWorkMinutes * 60);
    }
  }, [secondsLeft, isRunning, phase, completedPomodoros, pomodoroWorkMinutes, pomodoroBreakMinutes, pomodoroLongBreakMinutes, pomodorosBeforeLongBreak]);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    const duration = Math.max(1, Math.round(totalWorkSeconds / 60));
    const finalPomodoros = (phase === 'work' && (totalSeconds - secondsLeft) > totalSeconds / 2)
      ? completedPomodoros + 1
      : completedPomodoros;
    const tracked: TrackedSession = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      subject,
      duration,
      completed: true,
      plannedSessionId,
      pomodoroCount: finalPomodoros,
      topicName,
    };
    addSession(tracked);
    onComplete();
  }, [totalWorkSeconds, subject, plannedSessionId, topicName, completedPomodoros, phase, secondsLeft, totalSeconds, addSession, onComplete]);

  const handleSkip = () => {
    if (phase === 'work') {
      const newCount = completedPomodoros + 1;
      setCompletedPomodoros(newCount);
      setTotalWorkSeconds((prev) => prev + secondsLeft);
      if (newCount % pomodorosBeforeLongBreak === 0) {
        setPhase('longBreak');
        setSecondsLeft(pomodoroLongBreakMinutes * 60);
      } else {
        setPhase('break');
        setSecondsLeft(pomodoroBreakMinutes * 60);
      }
    } else {
      setPhase('work');
      setSecondsLeft(pomodoroWorkMinutes * 60);
    }
    setIsRunning(false);
  };

  const handleReset = () => {
    setPhase('work');
    setSecondsLeft(pomodoroWorkMinutes * 60);
    setIsRunning(false);
  };

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');

  const phaseLabel = phase === 'work' ? 'Focus Time' : phase === 'break' ? 'Short Break' : 'Long Break';
  const phaseColor = phase === 'work' ? 'text-primary' : 'text-green-500';
  const ringColor = phase === 'work' ? '#6C47FF' : '#22C55E';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border-2 border-primary/20 shadow-sm">
      <div className="text-center mb-4">
        <p className={`text-xs font-semibold uppercase tracking-wide ${phaseColor}`}>{phaseLabel}</p>
        <p className="text-sm font-bold text-app-dark dark:text-white mt-1">{subject}</p>
        <p className="text-xs text-gray-400">{chapter}</p>
      </div>

      <div className="flex justify-center mb-4">
        <div className="relative w-48 h-48">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-700" />
            <circle
              cx="50" cy="50" r="45" fill="none"
              stroke={ringColor} strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-mono font-bold text-app-dark dark:text-white">{mins}:{secs}</span>
            <span className="text-xs text-gray-400 mt-1">
              {completedPomodoros}/{pomodorosBeforeLongBreak} pomodoros
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={handleReset}
          className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-700"
          title="Reset"
        >
          <RotateCcw size={16} />
        </button>

        <Button
          onClick={() => setIsRunning(!isRunning)}
          className="w-14 h-14 !rounded-full flex items-center justify-center !p-0"
        >
          {isRunning ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
        </Button>

        <button
          onClick={handleSkip}
          className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-700"
          title="Skip phase"
        >
          <SkipForward size={16} />
        </button>
      </div>

      <div className="mt-4 flex justify-center gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        {onAddNote && (
          <Button variant="secondary" size="sm" onClick={onAddNote} className="flex items-center gap-1">
            Add Note
          </Button>
        )}
        <Button variant="danger" size="sm" onClick={handleStop} className="flex items-center gap-1">
          <Square size={12} fill="currentColor" /> End & Save
        </Button>
      </div>
    </div>
  );
}
