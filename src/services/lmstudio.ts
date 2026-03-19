import type { UserProfile, StudyPlan } from '../types';
import { generateLocalPlan } from './scheduler';

function getLmStudioUrl(userId?: string): string {
  const DEFAULT = 'http://127.0.0.1:1240';
  try {
    const key = userId ? `sp_${userId}_settings` : 'sp_settings';
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.lmStudioUrl || DEFAULT;
    }
  } catch {
    // ignore
  }
  return DEFAULT;
}

export async function generateStudyPlan(profile: UserProfile, userId?: string): Promise<StudyPlan> {
  const baseUrl = getLmStudioUrl(userId);

  const subjectList = profile.subjectDetails.length > 0
    ? profile.subjectDetails.map((d) =>
        d.examDate ? `${d.name} (exam: ${d.examDate})` : d.name
      ).join(', ')
    : profile.subjects.join(', ');

  const systemPrompt = `You are an expert study planner AI. Generate a prioritized weekly study schedule in JSON format only. Subjects with closer exam dates must receive more sessions. No explanation, no markdown, just valid JSON:
{
  "weeklySchedule": [{"day":"Monday","sessions":[{"id":"mon-0","subject":"string","chapter":"string","startTime":"HH:MM","endTime":"HH:MM","color":"#hex"}]}],
  "insights": [{"type":"tip","title":"string","body":"string"}],
  "subjectProgress": [{"subject":"string","percentDone":0}],
  "generatedAt": "ISO string"
}`;

  const userPrompt = `Create a weekly study plan for ${profile.name} studying ${profile.studyField}.
Subjects with deadlines: ${subjectList}.
Preferred time: ${profile.preferredTime}. Daily goal: ${profile.dailyGoalHours}h.
Institution: ${profile.institution || 'not specified'}. Semester: ${profile.semester || 'not specified'}.
Colors to use per subject: #6C47FF, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #F4A261, #DDA0DD.
Include all 7 days. Prioritize subjects with closer exams. Generate 2-3 insights. Return ONLY the JSON.`;

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local-model',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const plan: StudyPlan = JSON.parse(jsonMatch[0]);
    if (!plan.weeklySchedule || !Array.isArray(plan.weeklySchedule)) {
      throw new Error('Invalid plan structure');
    }

    // Ensure all sessions have IDs
    plan.weeklySchedule.forEach((day, di) => {
      day.sessions.forEach((s, si) => {
        if (!s.id) s.id = `${day.day}-${di}-${si}`;
      });
    });

    if (!plan.generatedAt) plan.generatedAt = new Date().toISOString();

    return plan;
  } catch (err) {
    console.warn('LM Studio unavailable, using local plan:', err);
    return generateLocalPlan(profile);
  }
}

export async function generateInsights(
  profile: UserProfile,
  sessions: { subject: string; duration: number; date: string }[],
  userId?: string
): Promise<{ type: string; title: string; body: string }[]> {
  const baseUrl = getLmStudioUrl(userId);
  const totalHours = sessions.reduce((sum, s) => sum + s.duration, 0) / 60;
  const subjectMap: Record<string, number> = {};
  sessions.forEach((s) => { subjectMap[s.subject] = (subjectMap[s.subject] || 0) + s.duration; });

  const systemPrompt = `You are a study analytics AI. Generate 3 actionable insights as JSON array only:
[{"type":"tip","title":"string","body":"string"}]`;

  const userPrompt = `Student: ${profile.name}, studying ${profile.studyField}.
Total hours: ${totalHours.toFixed(1)}. By subject: ${Object.entries(subjectMap).map(([s, m]) => `${s}: ${(m / 60).toFixed(1)}h`).join(', ')}.
Preferred time: ${profile.preferredTime}. Daily goal: ${profile.dailyGoalHours}h.
Subjects with exams: ${profile.subjectDetails.filter((d) => d.examDate).map((d) => `${d.name} (${d.examDate})`).join(', ') || 'none'}.
Return ONLY the JSON array.`;

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'local-model',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [
      { type: 'tip', title: 'Keep up the momentum', body: `${totalHours.toFixed(1)} hours studied. Keep going to hit your ${profile.dailyGoalHours}h daily goal.` },
      { type: 'tip', title: 'Balance your subjects', body: 'Give equal attention to all subjects for balanced progress.' },
      { type: 'tip', title: 'Review before sleeping', body: 'A 15-minute nightly review significantly strengthens memory consolidation.' },
    ];
  }
}
