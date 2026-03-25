# Phase 2: Enhanced Planning & Organization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add topic/chapter tracking per subject, a monthly calendar view on the timetable page, and study plan export (PDF, image, JSON).

**Architecture:** Three independent sub-features. Topic tracking modifies `SubjectDetail` in the profile (no new backend column needed — stored in existing `profile_json`). Calendar view is a pure rendering component using existing `StudyPlan` + `TrackedSession` data. Export installs `jspdf`+`html2canvas` and adds an export button to the timetable. **Tasks 0, 1, and 2 are shared prerequisites** and must run first in order before any sub-feature track.

**Tech Stack:** React 18 + TypeScript 5 + Vite 5, Tailwind CSS, FastAPI backend (Python), `jspdf` + `html2canvas` (new deps for export)

---

## File Map

**Created:**
- `src/components/CalendarView.tsx` — Monthly calendar grid (week/month toggle lives on TimetablePage)
- `src/components/TopicList.tsx` — CRUD list of topics within a subject card
- `src/components/ExportMenu.tsx` — Export dropdown with PDF / Image / JSON options

**Modified:**
- `src/types/index.ts` — Add `Topic` type; extend `SubjectDetail`, `StudySession`, `TrackedSession`
- `src/pages/SubjectsPage.tsx` — Render `TopicList` inside expanded subject card; wire topic-driven progress
- `src/pages/TimetablePage.tsx` — Add Week/Month view toggle; render `CalendarView`; add export button
- `src/pages/HomePage.tsx` — Add topic selector dropdown when starting a session
- `src/context/AppContext.tsx` — Add `addTopic`, `updateTopic`, `removeTopic` CRUD helpers
- `backend/main.py` — Update `POST /lm/generate-plan` prompt to list incomplete topics
- `frontend/package.json` — Add `jspdf`, `html2canvas`

---

## Task 0: Install Export Dependencies

**Files:**
- Modify: `frontend/package.json` (via npm install)

- [ ] From `frontend/` directory, install packages:

```bash
npm install jspdf html2canvas
```

- [ ] Verify packages appear in `package.json` dependencies, then commit:

```bash
git add package.json package-lock.json
git commit -m "chore: add jspdf and html2canvas for plan export"
```

---

## Task 1: Extend Types for Topic Tracking

**Files:**
- Modify: `src/types/index.ts`

- [ ] Add the `Topic` interface and extend `SubjectDetail`, `StudySession`, `TrackedSession`:

```typescript
// After SubjectDetail interface, add:
export interface Topic {
  id: string;
  name: string;
  status: 'not_started' | 'in_progress' | 'completed';
}
```

```typescript
// SubjectDetail — add topics field:
export interface SubjectDetail {
  id: string;
  name: string;
  examDate?: string;
  hoursPerWeek?: number;
  color?: string;
  topics?: Topic[];  // ← add this
}
```

```typescript
// StudySession — add topicId field:
export interface StudySession {
  id: string;
  subject: string;
  chapter: string;
  startTime: string;
  endTime: string;
  color: string;
  rescheduled?: boolean;
  originalDay?: string;
  topicId?: string;  // ← add this
}
```

```typescript
// TrackedSession — add topicName field:
export interface TrackedSession {
  id: string;
  date: string;
  subject: string;
  duration: number;
  completed: boolean;
  plannedSessionId?: string;
  pomodoroCount?: number;
  topicName?: string;  // ← add this
}
```

- [ ] Run build to verify no TS errors:

```bash
cd frontend && npm run build
```

- [ ] Commit:

```bash
git add src/types/index.ts
git commit -m "feat: add Topic type and extend SubjectDetail/TrackedSession for topic tracking"
```

---

## Task 2: Topic CRUD in AppContext

**Files:**
- Modify: `src/context/AppContext.tsx`

- [ ] Add topic helper methods to `AppContextValue` interface (after `deleteNote`):

```typescript
addTopic: (subjectId: string, topic: Topic) => void;
updateTopic: (subjectId: string, topicId: string, updates: Partial<Topic>) => void;
removeTopic: (subjectId: string, topicId: string) => void;
```

- [ ] Add the import for `Topic` at the top (it's already exported from `../types`):

```typescript
import type { UserProfile, StudyPlan, TrackedSession, AppSettings, MissedSession, Topic } from '../types';
```

- [ ] Implement the three topic methods after `dismissMissed`:

```typescript
const addTopic = useCallback((subjectId: string, topic: Topic) => {
  setProfileState((prev) => {
    if (!prev) return prev;
    const updated = {
      ...prev,
      subjectDetails: prev.subjectDetails.map((d) =>
        d.id === subjectId ? { ...d, topics: [...(d.topics ?? []), topic] } : d
      ),
    };
    apiSaveProfile(updated).catch(console.error);
    return updated;
  });
}, []);

const updateTopic = useCallback((subjectId: string, topicId: string, updates: Partial<Topic>) => {
  setProfileState((prev) => {
    if (!prev) return prev;
    const updated = {
      ...prev,
      subjectDetails: prev.subjectDetails.map((d) =>
        d.id === subjectId
          ? { ...d, topics: (d.topics ?? []).map((t) => (t.id === topicId ? { ...t, ...updates } : t)) }
          : d
      ),
    };
    apiSaveProfile(updated).catch(console.error);
    return updated;
  });
}, []);

const removeTopic = useCallback((subjectId: string, topicId: string) => {
  setProfileState((prev) => {
    if (!prev) return prev;
    const updated = {
      ...prev,
      subjectDetails: prev.subjectDetails.map((d) =>
        d.id === subjectId ? { ...d, topics: (d.topics ?? []).filter((t) => t.id !== topicId) } : d
      ),
    };
    apiSaveProfile(updated).catch(console.error);
    return updated;
  });
}, []);
```

- [ ] Add all three to the Provider `value` object.

- [ ] Run build:

```bash
npm run build
```

- [ ] Commit:

```bash
git add src/context/AppContext.tsx
git commit -m "feat: add topic CRUD helpers (addTopic, updateTopic, removeTopic) to AppContext"
```

---

## Task 3: TopicList Component

**Files:**
- Create: `src/components/TopicList.tsx`

- [ ] Create the component:

```tsx
import { useState } from 'react';
import { Plus, X, Circle, Clock, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Topic } from '../types';

const STATUS_ICONS = {
  not_started: <Circle size={14} className="text-gray-400" />,
  in_progress: <Clock size={14} className="text-yellow-500" />,
  completed: <CheckCircle2 size={14} className="text-green-500" />,
};

const STATUS_CYCLE: Record<Topic['status'], Topic['status']> = {
  not_started: 'in_progress',
  in_progress: 'completed',
  completed: 'not_started',
};

interface TopicListProps {
  subjectId: string;
}

export function TopicList({ subjectId }: TopicListProps) {
  const { profile, addTopic, updateTopic, removeTopic } = useApp();
  const [newTopicName, setNewTopicName] = useState('');
  const [adding, setAdding] = useState(false);

  const detail = profile?.subjectDetails.find((d) => d.id === subjectId);
  const topics = detail?.topics ?? [];

  function handleAdd() {
    const name = newTopicName.trim();
    if (!name) return;
    addTopic(subjectId, { id: crypto.randomUUID(), name, status: 'not_started' });
    setNewTopicName('');
    setAdding(false);
  }

  function cycleStatus(topic: Topic) {
    updateTopic(subjectId, topic.id, { status: STATUS_CYCLE[topic.status] });
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Topics</span>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1 text-xs text-primary font-semibold"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {adding && (
        <div className="flex gap-2 mb-2">
          <input
            autoFocus
            className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Topic name"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
          />
          <button onClick={handleAdd} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white font-semibold">
            Add
          </button>
        </div>
      )}

      {topics.length === 0 && !adding && (
        <p className="text-xs text-gray-400 italic">No topics yet — add chapters or units.</p>
      )}

      <div className="flex flex-col gap-1">
        {topics.map((topic) => (
          <div key={topic.id} className="flex items-center gap-2 py-1 group">
            <button onClick={() => cycleStatus(topic)} className="flex-shrink-0">
              {STATUS_ICONS[topic.status]}
            </button>
            <span className={`flex-1 text-sm ${topic.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
              {topic.name}
            </span>
            <button
              onClick={() => removeTopic(subjectId, topic.id)}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] Run build:

```bash
npm run build
```

- [ ] Commit:

```bash
git add src/components/TopicList.tsx
git commit -m "feat: add TopicList component with status cycling (not_started → in_progress → completed)"
```

---

## Task 4: Wire TopicList into SubjectsPage + Topic-Driven Progress

**Files:**
- Modify: `src/pages/SubjectsPage.tsx`

- [ ] Add `TopicList` import:

```typescript
import { TopicList } from '../components/TopicList';
```

- [ ] In the expanded subject section (after `NotesList`), add:

```tsx
{/* Topics */}
<TopicList subjectId={detail?.id ?? ''} />
```

- [ ] Update subject progress calculation so that when a subject has topics, progress = completed topics / total topics. Find where `updateSubjectProgress` is called manually (the range slider) and add topic-driven auto-progress above the slider. Add this computed value just before the progress slider block:

```tsx
{/* Auto-compute progress from topics when topics exist */}
{(() => {
  const topicList = detail?.topics ?? [];
  if (topicList.length > 0) {
    const completedCount = topicList.filter((t) => t.status === 'completed').length;
    const auto = Math.round((completedCount / topicList.length) * 100);
    if (auto !== sp.percentDone) updateSubjectProgress(sp.subject, auto);
  }
  return null;
})()}
```

  > Note: Place this above the `<div>` that contains the progress slider — it's a side-effect render trick. This works because `updateSubjectProgress` is a no-op if the value is unchanged (it still calls the API, so consider using `useEffect` if the API calls become noisy). A simpler approach: compute `displayPercent` locally and only call `updateSubjectProgress` on slider change when topics list is empty.

  **Revised approach** — compute display value locally, respect manual slider only when no topics:

  Replace the progress slider block:

  ```tsx
  {/* Progress slider */}
  <div>
    <div className="flex justify-between mb-1">
      <span className="text-xs text-gray-500">Progress</span>
      <span className="text-xs font-semibold" style={{ color }}>{sp.percentDone}%</span>
    </div>
    <input
      type="range"
      min={0} max={100}
      value={sp.percentDone}
      onChange={(e) => updateSubjectProgress(sp.subject, Number(e.target.value))}
      className="w-full cursor-pointer"
      style={{ accentColor: color }}
    />
  </div>
  ```

  With:

  ```tsx
  {/* Progress */}
  {(() => {
    const topicList = detail?.topics ?? [];
    const topicDriven = topicList.length > 0;
    const autoPercent = topicDriven
      ? Math.round((topicList.filter((t) => t.status === 'completed').length / topicList.length) * 100)
      : sp.percentDone;

    return (
      <div>
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-500">
            Progress {topicDriven ? '(from topics)' : ''}
          </span>
          <span className="text-xs font-semibold" style={{ color }}>{autoPercent}%</span>
        </div>
        {topicDriven ? (
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${autoPercent}%`, backgroundColor: color }}
            />
          </div>
        ) : (
          <input
            type="range"
            min={0} max={100}
            value={sp.percentDone}
            onChange={(e) => updateSubjectProgress(sp.subject, Number(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: color }}
          />
        )}
      </div>
    );
  })()}
  ```

  Also add a `useEffect` in the component body to sync topic-driven progress to the plan. **Important:** do NOT include `plan` or `updateSubjectProgress` in the deps array — `updateSubjectProgress` calls `setPlanState` which changes `plan`, which would cause an infinite loop. Only react to `profile` changes:

  ```tsx
  // Sync topic-driven progress when profile topics change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!profile || !plan) return;
    profile.subjectDetails.forEach((d) => {
      const topicList = d.topics ?? [];
      if (topicList.length === 0) return;
      const auto = Math.round((topicList.filter((t) => t.status === 'completed').length / topicList.length) * 100);
      const current = plan.subjectProgress.find((sp) => sp.subject === d.name)?.percentDone ?? 0;
      if (auto !== current) updateSubjectProgress(d.name, auto);
    });
  }, [profile]); // intentionally omit plan/updateSubjectProgress to avoid infinite loop
  ```

  Add `useEffect` to the imports at the top.

- [ ] Run build:

```bash
npm run build
```

- [ ] Run lint:

```bash
npm run lint
```

- [ ] Commit:

```bash
git add src/pages/SubjectsPage.tsx
git commit -m "feat: integrate TopicList into SubjectsPage with topic-driven progress sync"
```

---

## Task 5: Topic Selector When Starting Session (HomePage)

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] Read the current `startSession` button area in `HomePage.tsx` (line ~64+). The "Start Session" button currently pops up a session from `todaySchedule` directly. We need a topic dropdown to appear before starting.

- [ ] Extend the `activeSession` state type to include `topicName` (find it at line 35-39 of `HomePage.tsx`):

```tsx
const [activeSession, setActiveSession] = useState<{
  subject: string;
  chapter: string;
  plannedSessionId?: string;
  topicName?: string;  // ← add this
} | null>(null);
```

- [ ] Add state for topic selection:

```tsx
const [selectedTopicId, setSelectedTopicId] = useState<string | undefined>(undefined);
```

- [ ] When rendering the "Start Session" button for a planned session, look up the subject's topics and add a `<select>` dropdown if topics exist. Find the section that renders `nextSession` and its Start button. Wrap the button with topic selection:

```tsx
{nextSession && !activeSession && (
  <div className="mt-3 flex flex-col gap-2">
    {/* Topic picker */}
    {(() => {
      const detail = profile.subjectDetails.find((d) => d.name === nextSession.subject);
      const topics = detail?.topics?.filter((t) => t.status !== 'completed') ?? [];
      return topics.length > 0 ? (
        <select
          className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary"
          value={selectedTopicId ?? ''}
          onChange={(e) => setSelectedTopicId(e.target.value || undefined)}
        >
          <option value="">Select topic (optional)</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      ) : null;
    })()}
    <Button
      onClick={() => {
        const topicName = selectedTopicId
          ? profile.subjectDetails.find((d) => d.name === nextSession.subject)?.topics?.find((t) => t.id === selectedTopicId)?.name
          : undefined;
        setActiveSession({
          subject: nextSession.subject,
          chapter: topicName ?? nextSession.chapter,
          plannedSessionId: nextSession.id,
          topicName,
        });
      }}
      className="flex items-center gap-2"
    >
      <Play size={16} /> Start Session
    </Button>
  </div>
)}
```

  > Replace the existing manual `setActiveSession({...})` call (inside the old `startSession` function) with the inline `onClick` above. Remove the old `startSession` helper if it's no longer needed.

- [ ] Update the `<PomodoroTimer>` JSX in `HomePage.tsx` to pass `topicName` from `activeSession`:

```tsx
<PomodoroTimer
  subject={activeSession.subject}
  chapter={activeSession.chapter}
  plannedSessionId={activeSession.plannedSessionId}
  topicName={activeSession.topicName}  {/* ← add this */}
  onComplete={handlePomodoroComplete}
  onCancel={handlePomodoroCancel}
  onAddNote={...}
/>

- [ ] Also pass `topicName` to `TrackedSession` in `PomodoroTimer.tsx`'s `handleStop`. Open `src/components/PomodoroTimer.tsx` and add `topicName?: string` to `PomodoroTimerProps`:

```tsx
interface PomodoroTimerProps {
  subject: string;
  chapter: string;
  plannedSessionId?: string;
  topicName?: string;  // ← add
  onComplete: () => void;
  onCancel: () => void;
  onAddNote?: () => void;
}
```

  And in `handleStop`, include it in `TrackedSession`:

```tsx
const tracked: TrackedSession = {
  id: crypto.randomUUID(),
  date: new Date().toISOString().split('T')[0],
  subject,
  duration,
  completed: true,
  plannedSessionId,
  pomodoroCount: finalPomodoros,
  topicName,  // ← add
};
```

- [ ] Run build:

```bash
npm run build
```

- [ ] Run lint:

```bash
npm run lint
```

- [ ] Commit:

```bash
git add src/pages/HomePage.tsx src/components/PomodoroTimer.tsx
git commit -m "feat: add topic selector on HomePage when starting a session"
```

---

## Task 6: Update Backend Plan Generation Prompt with Topics

**Files:**
- Modify: `backend/main.py`

- [ ] Read the `POST /lm/generate-plan` endpoint in `main.py` to find the prompt template. Search for `generate-plan` or the Gemini prompt string.

- [ ] After extracting `profile` from the request, build an incomplete topics string and inject it into the prompt. Find the prompt string and add a topics section. The profile dict contains `subjectDetails` with `topics` arrays. Add this logic before the prompt construction:

```python
# Build incomplete topics summary for prompt context
incomplete_topics = []
for detail in profile.get("subjectDetails", []):
    subject_name = detail.get("name", "")
    topics = detail.get("topics", [])
    pending = [t["name"] for t in topics if t.get("status") != "completed"]
    if pending:
        incomplete_topics.append(f"{subject_name}: {', '.join(pending)}")

topics_context = ""
if incomplete_topics:
    topics_context = "\n\nIncomplete topics to prioritize:\n" + "\n".join(f"- {t}" for t in incomplete_topics)
```

  Then append `{topics_context}` to the prompt string before sending to Gemini.

- [ ] Run the backend to verify it starts cleanly:

```bash
cd backend && uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

  Check for no startup errors, then Ctrl+C.

- [ ] Commit:

```bash
git add backend/main.py
git commit -m "feat: inject incomplete topic context into Gemini plan generation prompt"
```

---

## Task 7: CalendarView Component

**Files:**
- Create: `src/components/CalendarView.tsx`

- [ ] Create the calendar component. It receives `plan` (for projected future sessions) and `sessions` (for historical tracked sessions). It renders a monthly grid with colored dots per day:

```tsx
import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { StudyPlan, TrackedSession } from '../types';

interface CalendarViewProps {
  plan: StudyPlan;
  sessions: TrackedSession[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Maps JS getDay() index to plan day names
const JS_DAY_TO_PLAN: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

export function CalendarView({ plan, sessions }: CalendarViewProps) {
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  function isoDate(day: number) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function sessionsForDay(day: number) {
    const iso = isoDate(day);
    const date = new Date(year, month, day);
    const isPast = iso < today;
    const isFuture = iso > today;

    if (isPast || iso === today) {
      // Show tracked sessions (actual history)
      return sessions.filter((s) => s.date === iso);
    }
    if (isFuture) {
      // Project weekly template
      const dayName = JS_DAY_TO_PLAN[date.getDay()];
      const planned = plan.weeklySchedule.find((d) => d.day === dayName)?.sessions ?? [];
      return planned.map((s) => ({ subject: s.subject, duration: 0 }));
    }
    return [];
  }

  function studyHoursForDay(day: number): number {
    const iso = isoDate(day);
    return sessions.filter((s) => s.date === iso).reduce((sum, s) => sum + s.duration, 0) / 60;
  }

  function heatmapOpacity(day: number): number {
    const hours = studyHoursForDay(day);
    return Math.min(hours / 4, 1); // max at 4 hours
  }

  function getSelectedDaySessions(isoStr: string) {
    // Use T12:00:00 to avoid UTC-vs-local day shift (bare ISO dates parse as UTC midnight)
    const date = new Date(isoStr + 'T12:00:00');
    const isPastOrToday = isoStr <= today;
    if (isPastOrToday) {
      return sessions.filter((s) => s.date === isoStr);
    }
    const dayName = JS_DAY_TO_PLAN[date.getDay()];
    return plan.weeklySchedule.find((d) => d.day === dayName)?.sessions ?? [];
  }

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ChevronLeft size={16} className="text-gray-500" />
        </button>
        <span className="text-sm font-semibold text-app-dark dark:text-white">{monthLabel}</span>
        <button
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ChevronRight size={16} className="text-gray-500" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const iso = isoDate(day);
          const daySessions = sessionsForDay(day);
          const isToday = iso === today;
          const opacity = heatmapOpacity(day);
          const isSelected = selectedDay === iso;

          return (
            <button
              key={iso}
              onClick={() => setSelectedDay(isSelected ? null : iso)}
              className={`relative aspect-square rounded-lg flex flex-col items-center justify-start pt-1 transition-colors
                ${isToday ? 'ring-2 ring-primary' : ''}
                ${isSelected ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}
              `}
              style={opacity > 0 ? { backgroundColor: `rgba(108,71,255,${opacity * 0.15})` } : {}}
            >
              <span className={`text-xs font-medium leading-none ${isToday ? 'text-primary font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                {day}
              </span>
              {/* Session dots */}
              {daySessions.length > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                  {daySessions.slice(0, 3).map((_, i) => (
                    <div key={i} className="w-1 h-1 rounded-full bg-primary" />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-4 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-500 mb-2">
            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
          {(() => {
            const daySessions = getSelectedDaySessions(selectedDay);
            if (daySessions.length === 0) {
              return <p className="text-xs text-gray-400 italic">No sessions planned.</p>;
            }
            return (
              <div className="flex flex-col gap-1">
                {daySessions.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {'subject' in s ? s.subject : ''}
                      {'duration' in s && (s as TrackedSession).duration > 0
                        ? ` — ${(s as TrackedSession).duration} min`
                        : 'startTime' in s ? ` ${(s as {startTime: string}).startTime}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
```

- [ ] Run build:

```bash
npm run build
```

- [ ] Commit:

```bash
git add src/components/CalendarView.tsx
git commit -m "feat: add CalendarView component with monthly grid, heatmap, and session dots"
```

---

## Task 8: Add Week/Month Toggle to TimetablePage

**Files:**
- Modify: `src/pages/TimetablePage.tsx`

- [ ] Add view toggle state and render `CalendarView`:

```tsx
// Add imports
import { useState } from 'react';
import { CalendarView } from '../components/CalendarView';
import { useApp } from '../context/AppContext';
```

- [ ] Destructure `sessions` from `useApp()`:

```tsx
const { plan, sessions } = useApp();
```

- [ ] Add view state after component opens:

```tsx
const [view, setView] = useState<'week' | 'month'>('week');
```

- [ ] Replace the header section to include toggle buttons. After the `<h1>` tag, add:

```tsx
{/* View toggle */}
<div className="flex items-center gap-1 mt-3 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
  <button
    onClick={() => setView('week')}
    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      view === 'week'
        ? 'bg-white dark:bg-gray-900 text-primary shadow-sm'
        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
    }`}
  >
    Week
  </button>
  <button
    onClick={() => setView('month')}
    className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      view === 'month'
        ? 'bg-white dark:bg-gray-900 text-primary shadow-sm'
        : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
    }`}
  >
    Month
  </button>
</div>
```

- [ ] Wrap the existing scrollable grid in `{view === 'week' && ...}` and add month view:

```tsx
{view === 'month' && (
  <div className="px-4 py-4">
    <CalendarView plan={plan} sessions={sessions} />
  </div>
)}
```

- [ ] Remove the "Drag to reschedule (coming soon)" placeholder text.

- [ ] Run build + lint:

```bash
npm run build && npm run lint
```

- [ ] Commit:

```bash
git add src/pages/TimetablePage.tsx
git commit -m "feat: add Week/Month view toggle to TimetablePage with CalendarView"
```

---

## Task 9: ExportMenu Component

**Files:**
- Create: `src/components/ExportMenu.tsx`

- [ ] Create the export menu. It takes a `timetableRef` (for capturing the weekly grid as image/PDF) and `plan` + `profile` for JSON export:

```tsx
import { useState } from 'react';
import { Download, FileText, Image, Database } from 'lucide-react';
import type { StudyPlan, UserProfile } from '../types';

interface ExportMenuProps {
  timetableRef: React.RefObject<HTMLDivElement>;
  plan: StudyPlan;
  profile: UserProfile;
}

export function ExportMenu({ timetableRef, plan, profile }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  async function exportPDF() {
    if (!timetableRef.current) return;
    setExporting('pdf');
    setOpen(false);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(timetableRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`study-plan-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
      alert('PDF export failed. Please try again.');
    }
    setExporting(null);
  }

  async function exportImage() {
    if (!timetableRef.current) return;
    setExporting('image');
    setOpen(false);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(timetableRef.current, { scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `study-plan-${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Image export failed', err);
      alert('Image export failed. Please try again.');
    }
    setExporting(null);
  }

  function exportJSON() {
    setOpen(false);
    const data = { profile, plan, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.download = `study-plan-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!!exporting}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors disabled:opacity-50"
      >
        <Download size={16} />
        {exporting ? 'Exporting...' : 'Export'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden min-w-[160px]">
            <button
              onClick={exportPDF}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <FileText size={14} className="text-primary" /> Export PDF
            </button>
            <button
              onClick={exportImage}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Image size={14} className="text-primary" /> Export Image
            </button>
            <button
              onClick={exportJSON}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Database size={14} className="text-primary" /> JSON Backup
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] Run build:

```bash
npm run build
```

- [ ] Commit:

```bash
git add src/components/ExportMenu.tsx
git commit -m "feat: add ExportMenu component with PDF, image, and JSON export options"
```

---

## Task 10: Wire ExportMenu into TimetablePage

**Files:**
- Modify: `src/pages/TimetablePage.tsx`

- [ ] Import `ExportMenu` and `useRef` (already imported):

```tsx
import { ExportMenu } from '../components/ExportMenu';
```

- [ ] Destructure `profile` from `useApp()`:

```tsx
const { plan, sessions, profile } = useApp();
```

- [ ] Add a ref for the weekly grid container:

```tsx
const exportRef = useRef<HTMLDivElement>(null);
```

- [ ] Wrap the existing `<div className="min-w-[560px]">` content with the `exportRef`:

```tsx
<div ref={exportRef}>
  <div className="min-w-[560px]">
    {/* ... existing grid content ... */}
  </div>
</div>
```

- [ ] Add the `ExportMenu` to the header area (right side of the header flex row):

```tsx
{profile && <ExportMenu timetableRef={exportRef} plan={plan} profile={profile} />}
```

- [ ] Run build + lint:

```bash
npm run build && npm run lint
```

- [ ] Commit:

```bash
git add src/pages/TimetablePage.tsx
git commit -m "feat: add export menu to TimetablePage header"
```

---

## Task 11: JSON Import in Settings (Backup Restore)

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] Add a JSON restore button in the Settings danger zone or in a new "Data" card. Add after the AI Engine card:

```tsx
{/* Data & Backup */}
<Card className="mb-4">
  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Data & Backup</p>
  <p className="text-xs text-gray-400 mb-3">Export your plan from the Timetable page. Import a backup to restore your data.</p>
  <label className="cursor-pointer">
    <span className="inline-flex items-center gap-1.5 text-sm text-primary font-semibold">
      <Database size={14} /> Import JSON Backup
    </span>
    <input
      type="file"
      accept=".json"
      className="hidden"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (data.profile) setProfile(data.profile);
          if (data.plan) setPlan(data.plan);
          alert('Backup restored successfully!');
        } catch {
          alert('Invalid backup file.');
        }
        e.target.value = '';
      }}
    />
  </label>
</Card>
```

- [ ] Add `Database` to the lucide-react import at the top.

- [ ] Run build + lint:

```bash
npm run build && npm run lint
```

- [ ] Commit:

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: add JSON backup import to SettingsPage"
```

---

## Final Verification

- [ ] Run full build + lint one last time:

```bash
cd frontend && npm run build && npm run lint
```

- [ ] Start both servers and do a manual smoke test:
  1. Start backend: `cd backend && uvicorn main:app --reload --host 127.0.0.1 --port 8000`
  2. Start frontend: `cd frontend && npm run dev`
  3. Open app → Subjects page → expand a subject → add topics → cycle their status → verify progress bar updates
  4. Open Timetable → switch to Month view → navigate months → click a day
  5. Open Timetable → click Export → try JSON backup download
  6. Start a session from HomePage → verify topic dropdown appears if topics exist

- [ ] Final commit if any minor fixes were made:

```bash
git add -A
git commit -m "feat: Phase 2 complete — topic tracking, calendar view, plan export"
```
