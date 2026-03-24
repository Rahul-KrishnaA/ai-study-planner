import type { UserProfile, StudyPlan } from '../types';
import { generateLocalPlan } from './scheduler';
import { apiGeneratePlan, apiGenerateInsights } from './api';

export async function generateStudyPlan(
  profile: UserProfile,
): Promise<StudyPlan> {
  try {
    return await apiGeneratePlan(profile);
  } catch (err) {
    console.warn('Gemini API unavailable, using local plan:', err);
    return generateLocalPlan(profile);
  }
}

export async function generateInsights(
  profile: UserProfile,
  sessions: { subject: string; duration: number; date: string }[],
): Promise<{ type: string; title: string; body: string }[]> {
  try {
    return await apiGenerateInsights(profile, sessions);
  } catch {
    const totalHours = sessions.reduce((sum, s) => sum + s.duration, 0) / 60;
    return [
      {
        type: 'tip',
        title: 'Keep up the momentum',
        body: `${totalHours.toFixed(1)} hours studied. Keep going to hit your ${profile.dailyGoalHours}h daily goal.`,
      },
      {
        type: 'tip',
        title: 'Balance your subjects',
        body: 'Give equal attention to all subjects for balanced progress.',
      },
      {
        type: 'tip',
        title: 'Review before sleeping',
        body: 'A 15-minute nightly review significantly strengthens memory consolidation.',
      },
    ];
  }
}
