import type { UserProfile, StudyPlan, DaySchedule, StudySession, MissedSession } from '../types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SUBJECT_COLORS = [
  '#6C47FF', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#96CEB4', '#F4A261', '#DDA0DD', '#98D8C8',
];

const TIME_BLOCKS: Record<UserProfile['preferredTime'], { start: number; end: number }> = {
  morning:   { start: 7,  end: 12 },
  afternoon: { start: 13, end: 18 },
  evening:   { start: 18, end: 23 },
};

// ─── Priority ──────────────────────────────────────────────────────────────────
export function computePriority(examDate: string | undefined): number {
  if (!examDate) return 1;
  const exam = new Date(examDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = Math.max(0, Math.ceil((exam.getTime() - today.getTime()) / 86400000));
  if (daysLeft <= 3)  return 5;
  if (daysLeft <= 7)  return 4;
  if (daysLeft <= 14) return 3;
  if (daysLeft <= 21) return 2;
  return 1;
}

export function daysUntilExam(examDate: string | undefined): number | null {
  if (!examDate) return null;
  const exam = new Date(examDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((exam.getTime() - today.getTime()) / 86400000));
}

export function nextExam(
  subjectDetails: UserProfile['subjectDetails']
): { subject: string; examDate: string; daysLeft: number } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = subjectDetails
    .filter((s) => s.examDate)
    .map((s) => ({
      subject: s.name,
      examDate: s.examDate!,
      daysLeft: Math.max(0, Math.ceil((new Date(s.examDate!).getTime() - today.getTime()) / 86400000)),
    }))
    .filter((s) => s.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return upcoming[0] ?? null;
}

// ─── Local schedule generator ─────────────────────────────────────────────────
export function generateLocalPlan(profile: UserProfile): StudyPlan {
  const { subjectDetails, subjects, preferredTime, dailyGoalHours } = profile;

  // Assign colors
  const colorMap: Record<string, string> = {};
  subjects.forEach((s, i) => { colorMap[s] = SUBJECT_COLORS[i % SUBJECT_COLORS.length]; });

  // Compute weights based on priority
  const weights: Record<string, number> = {};
  subjects.forEach((name) => {
    const detail = subjectDetails.find((d) => d.name === name);
    weights[name] = computePriority(detail?.examDate);
  });
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

  const block = TIME_BLOCKS[preferredTime];
  const sessionDurationHours = 1.5;
  const maxSessionsPerDay = Math.floor((block.end - block.start) / sessionDurationHours);
  const sessionsPerDay = Math.min(maxSessionsPerDay, Math.ceil(dailyGoalHours / sessionDurationHours));

  // Distribute subjects across the week proportionally
  const weeklySessionsTotal = sessionsPerDay * 7;
  const sessionsPerSubject: Record<string, number> = {};
  subjects.forEach((name) => {
    sessionsPerSubject[name] = Math.max(1, Math.round((weights[name] / totalWeight) * weeklySessionsTotal));
  });

  // Build flat list of sessions to fill
  const queue: string[] = [];
  for (const [name, count] of Object.entries(sessionsPerSubject)) {
    for (let i = 0; i < count; i++) queue.push(name);
  }
  // Shuffle slightly — distribute evenly
  const shuffled = distributeEvenly(queue, subjects);

  const weeklySchedule: DaySchedule[] = DAYS.map((day, dayIdx) => {
    const daySessions: StudySession[] = [];
    const daySubjects = shuffled.filter((_, i) => i % 7 === dayIdx).slice(0, sessionsPerDay);

    daySubjects.forEach((subject, si) => {
      const startHour = block.start + si * sessionDurationHours;
      const endHour = startHour + sessionDurationHours;
      const detail = subjectDetails.find((d) => d.name === subject);
      const chapter = detail?.examDate
        ? `Exam prep — ${formatDateShort(detail.examDate)}`
        : `Chapter ${dayIdx * sessionsPerDay + si + 1}`;

      daySessions.push({
        id: `${day}-${si}`,
        subject,
        chapter,
        startTime: formatHourMin(startHour),
        endTime: formatHourMin(endHour),
        color: colorMap[subject] ?? '#6C47FF',
      });
    });

    return { day, sessions: daySessions };
  });

  const insights = buildInsights(profile, weights);

  return {
    weeklySchedule,
    insights,
    subjectProgress: subjects.map((s) => ({ subject: s, percentDone: 0 })),
    generatedAt: new Date().toISOString(),
  };
}

function distributeEvenly(queue: string[], subjects: string[]): string[] {
  const result: string[] = [];
  const counts: Record<string, number> = {};
  subjects.forEach((s) => { counts[s] = queue.filter((q) => q === s).length; });
  // Interleave: always pick the subject with most remaining
  const remaining = { ...counts };
  let total = Object.values(remaining).reduce((a, b) => a + b, 0);
  while (total > 0) {
    const next = Object.entries(remaining).sort((a, b) => b[1] - a[1])[0];
    if (!next || next[1] === 0) break;
    result.push(next[0]);
    remaining[next[0]]--;
    total--;
  }
  return result;
}

function buildInsights(profile: UserProfile, weights: Record<string, number>): { type: 'tip' | 'warning' | 'achievement'; title: string; body: string }[] {
  const insights: { type: 'tip' | 'warning' | 'achievement'; title: string; body: string }[] = [];
  const topSubject = Object.entries(weights).sort((a, b) => b[1] - a[1])[0];

  if (topSubject && weights[topSubject[0]] >= 4) {
    const detail = profile.subjectDetails.find((d) => d.name === topSubject[0]);
    const days = daysUntilExam(detail?.examDate);
    insights.push({
      type: 'warning',
      title: `${topSubject[0]} exam is close`,
      body: days !== null ? `Only ${days} days left. More sessions have been prioritized.` : 'This subject has top priority in your schedule.',
    });
  }

  insights.push({
    type: 'tip',
    title: `${profile.preferredTime.charAt(0).toUpperCase() + profile.preferredTime.slice(1)} sessions scheduled`,
    body: `Your schedule is optimized for ${profile.preferredTime} study blocks to match your peak focus time.`,
  });

  if (profile.dailyGoalHours >= 4) {
    insights.push({
      type: 'tip',
      title: 'Take breaks every 90 minutes',
      body: 'The Pomodoro technique works well with your study load. Short breaks improve retention.',
    });
  }

  return insights;
}

// ─── Missed session detection ─────────────────────────────────────────────────
export function detectMissedSessions(
  plan: StudyPlan,
  completedSessionIds: Set<string>
): MissedSession[] {
  const missed: MissedSession[] = [];
  const now = new Date();
  const todayDay = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1]; // Mon=0
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const todayIdx = DAYS.indexOf(todayDay);

  plan.weeklySchedule.forEach((daySchedule, dayIdx) => {
    daySchedule.sessions.forEach((session) => {
      if (completedSessionIds.has(session.id)) return;
      // Session is in the past if it's an earlier day, or today and end time passed
      const isPastDay = dayIdx < todayIdx;
      const isToday = dayIdx === todayIdx;
      const endMins = timeToMinutes(session.endTime);
      if (isPastDay || (isToday && endMins < currentMinutes - 30)) {
        missed.push({
          sessionId: session.id,
          originalDay: daySchedule.day,
          subject: session.subject,
          startTime: session.startTime,
          endTime: session.endTime,
          color: session.color,
        });
      }
    });
  });

  return missed;
}

export function rescheduleMissedSessions(
  plan: StudyPlan,
  missed: MissedSession[]
): StudyPlan {
  if (missed.length === 0) return plan;

  const updated = JSON.parse(JSON.stringify(plan)) as StudyPlan;
  const now = new Date();
  const todayIdx = DAYS.indexOf(DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1]);

  // Find available slots from tomorrow onwards
  const candidateDays = DAYS.slice(todayIdx + 1);

  missed.forEach((ms) => {
    for (const day of candidateDays) {
      const daySchedule = updated.weeklySchedule.find((d) => d.day === day)!;
      // Find last session end time on that day
      const lastEnd = daySchedule.sessions.length > 0
        ? Math.max(...daySchedule.sessions.map((s) => timeToMinutes(s.endTime)))
        : 8 * 60;
      const newStart = lastEnd + 15;
      const duration = timeToMinutes(ms.endTime) - timeToMinutes(ms.startTime);
      const newEnd = newStart + duration;
      if (newEnd <= 23 * 60) {
        daySchedule.sessions.push({
          id: `${ms.sessionId}_rescheduled`,
          subject: ms.subject,
          chapter: 'Rescheduled session',
          startTime: minutesToTime(newStart),
          endTime: minutesToTime(newEnd),
          color: ms.color,
          rescheduled: true,
          originalDay: ms.originalDay,
        });
        break;
      }
    }
  });

  return updated;
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatHourMin(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
