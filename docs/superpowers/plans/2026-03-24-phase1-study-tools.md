# Phase 1: Study Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Pomodoro timer, quick notes, and flashcards with spaced repetition to the AI Study Planner.

**Architecture:** Extend the existing AppContext + backend JSON storage pattern. New features store data as JSON columns in `user_data`. Pomodoro replaces the existing timer on HomePage. Notes and flashcards are sub-features of Subjects (no new bottom nav items). All state flows through AppContext → API → SQLite.

**Tech Stack:** React 18, TypeScript 5, Tailwind CSS, FastAPI, SQLAlchemy, SQLite

---

## File Map

### New Files
- `frontend/src/types/notes.ts` — Note type definition
- `frontend/src/types/flashcards.ts` — Flashcard type definition
- `frontend/src/components/PomodoroTimer.tsx` — Pomodoro timer component with countdown ring
- `frontend/src/components/NoteEditor.tsx` — Note create/edit modal
- `frontend/src/components/NotesList.tsx` — Notes list with subject filter
- `frontend/src/pages/FlashcardsPage.tsx` — Flashcard CRUD + review page
- `frontend/src/components/FlashcardReview.tsx` — Card flip + spaced repetition review
- `frontend/src/services/spacedRepetition.ts` — SM-2 algorithm logic

### Modified Files
- `frontend/src/types/index.ts` — Add `id` to SubjectDetail, extend TrackedSession and AppSettings
- `frontend/src/context/AppContext.tsx` — Add notes/flashcards state, CRUD methods, Pomodoro settings
- `frontend/src/services/api.ts` — Add UserDataResponse fields, new save functions
- `frontend/src/pages/HomePage.tsx` — Replace timer with PomodoroTimer component
- `frontend/src/pages/SubjectsPage.tsx` — Add Notes tab + Flashcards link
- `frontend/src/pages/SettingsPage.tsx` — Add Pomodoro settings section
- `frontend/src/App.tsx` — Add `/subjects/flashcards` route
- `backend/models.py` — Add `notes_json`, `flashcards_json` columns
- `backend/main.py` — Update `GET /users/me/data`, `DELETE /users/me/data` for new columns

---

## Task 0: Stable Subject IDs (Cross-Cutting Prerequisite)

**Files:**
- Modify: `frontend/src/types/index.ts:30-35`
- Modify: `frontend/src/context/AppContext.tsx:56-94`

- [ ] **Step 1: Add `id` field to SubjectDetail**

In `frontend/src/types/index.ts`, change the `SubjectDetail` interface:

```typescript
export interface SubjectDetail {
  id: string;        // stable UUID
  name: string;
  examDate?: string;
  hoursPerWeek?: number;
  color?: string;
}
```

- [ ] **Step 2: Add auto-migration in AppContext**

In `frontend/src/context/AppContext.tsx`, after loading profile at line 59, add migration logic that assigns IDs to subjects missing them:

```typescript
if (data.profile) {
  // Auto-migrate: ensure all subjects have stable IDs
  const migratedProfile = {
    ...data.profile,
    subjectDetails: data.profile.subjectDetails.map((d: any) => ({
      ...d,
      id: d.id || crypto.randomUUID(),
    })),
  };
  setProfileState(migratedProfile);
  // Persist if migration happened
  if (data.profile.subjectDetails.some((d: any) => !d.id)) {
    apiSaveProfile(migratedProfile).catch(console.error);
  }
}
```

Replace the existing `if (data.profile) setProfileState(data.profile);` at line 59.

- [ ] **Step 3: Update SubjectsPage to use `id` when creating new subjects**

In `frontend/src/pages/SubjectsPage.tsx:38`, update `handleAddSubject`:

```typescript
const newDetail: SubjectDetail = { id: crypto.randomUUID(), name: trimmed, examDate: newExamDate || undefined };
```

- [ ] **Step 4: Run build to verify**

Run: `cd "D:/Prog/Project/Ai study planner modification/frontend" && npm run build`
Expected: BUILD SUCCESS (may have warnings about unused `id` field, which is fine)

- [ ] **Step 5: Commit**

```bash
cd "D:/Prog/Project/Ai study planner modification"
git add frontend/src/types/index.ts frontend/src/context/AppContext.tsx frontend/src/pages/SubjectsPage.tsx
git commit -m "feat: add stable UUID to SubjectDetail for data integrity"
```

---

## Task 1: Backend — Add notes_json and flashcards_json Columns

**Files:**
- Modify: `backend/models.py:17-26`
- Modify: `backend/main.py:216-229` (GET /users/me/data)
- Modify: `backend/main.py:297-311` (DELETE /users/me/data)

- [ ] **Step 1: Add columns to UserData model**

In `backend/models.py`, add two new columns to the `UserData` class after line 26:

```python
class UserData(Base):
    __tablename__ = "user_data"

    user_id = Column(String, primary_key=True)
    profile_json = Column(Text, nullable=True)
    plan_json = Column(Text, nullable=True)
    sessions_json = Column(Text, default="[]")
    settings_json = Column(Text, nullable=True)
    streak = Column(Integer, default=0)
    last_session_date = Column(String, nullable=True)
    notes_json = Column(Text, default="[]")
    flashcards_json = Column(Text, default="[]")
```

- [ ] **Step 2: Update GET /users/me/data endpoint**

In `backend/main.py`, update the `get_user_data` function return dict (around line 222-229):

```python
    return {
        "profile": json.loads(data.profile_json) if data.profile_json else None,
        "plan": json.loads(data.plan_json) if data.plan_json else None,
        "sessions": json.loads(data.sessions_json) if data.sessions_json else [],
        "settings": json.loads(data.settings_json) if data.settings_json else None,
        "streak": data.streak or 0,
        "last_session_date": data.last_session_date,
        "notes": json.loads(data.notes_json) if data.notes_json else [],
        "flashcards": json.loads(data.flashcards_json) if data.flashcards_json else [],
    }
```

- [ ] **Step 3: Update DELETE /users/me/data endpoint**

In `backend/main.py`, add resets for new columns in `reset_user_data` (around line 304-310):

```python
    if data:
        data.profile_json = None
        data.plan_json = None
        data.sessions_json = "[]"
        data.settings_json = None
        data.streak = 0
        data.last_session_date = None
        data.notes_json = "[]"
        data.flashcards_json = "[]"
        db.commit()
```

- [ ] **Step 4: Add save endpoints for notes and flashcards**

In `backend/main.py`, add two new endpoints after the `save_settings` endpoint (after line 281):

```python
class NotesRequest(BaseModel):
    notes: list

class FlashcardsRequest(BaseModel):
    flashcards: list

@app.put("/users/me/notes")
def save_notes(
    req: NotesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_or_create_user_data(current_user.id, db)
    data.notes_json = json.dumps(req.notes)
    db.commit()
    return {"ok": True}

@app.put("/users/me/flashcards")
def save_flashcards(
    req: FlashcardsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_or_create_user_data(current_user.id, db)
    data.flashcards_json = json.dumps(req.flashcards)
    db.commit()
    return {"ok": True}
```

- [ ] **Step 5: Delete existing database and restart to pick up schema changes**

```bash
cd "D:/Prog/Project/Ai study planner modification/backend"
rm -f study_planner.db
```

Note: This is the dev migration strategy per the spec. Existing dev data will be lost.

- [ ] **Step 6: Commit**

```bash
cd "D:/Prog/Project/Ai study planner modification"
git add backend/models.py backend/main.py
git commit -m "feat: add notes and flashcards storage to backend"
```

---

## Task 2: Frontend API & Types for Notes and Flashcards

**Files:**
- Create: `frontend/src/types/notes.ts`
- Create: `frontend/src/types/flashcards.ts`
- Modify: `frontend/src/types/index.ts:73-80` (TrackedSession)
- Modify: `frontend/src/types/index.ts:93-97` (AppSettings)
- Modify: `frontend/src/services/api.ts:115-126`

- [ ] **Step 1: Create Note type**

Create `frontend/src/types/notes.ts`:

```typescript
export interface Note {
  id: string;
  subjectId: string;
  title: string;
  content: string; // markdown
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
```

- [ ] **Step 2: Create Flashcard type**

Create `frontend/src/types/flashcards.ts`:

```typescript
export interface Flashcard {
  id: string;
  subjectId: string;
  front: string;
  back: string;
  nextReviewDate: string; // ISO date YYYY-MM-DD
  interval: number; // days
  easeFactor: number; // SM-2 ease factor, starts at 2.5
  createdAt: string; // ISO
}
```

- [ ] **Step 3: Extend TrackedSession with pomodoroCount**

In `frontend/src/types/index.ts`, update the `TrackedSession` interface:

```typescript
export interface TrackedSession {
  id: string;
  date: string;       // YYYY-MM-DD
  subject: string;
  duration: number;   // minutes
  completed: boolean;
  plannedSessionId?: string;
  pomodoroCount?: number; // completed pomodoro cycles (0 or undefined = not a pomodoro session)
}
```

- [ ] **Step 4: Extend AppSettings with Pomodoro settings**

In `frontend/src/types/index.ts`, update the `AppSettings` interface:

```typescript
export interface AppSettings {
  darkMode: boolean;
  remindersEnabled: boolean;
  reminderMinutesBefore: number;
  pomodoroWorkMinutes: number;
  pomodoroBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  pomodorosBeforeLongBreak: number;
}
```

- [ ] **Step 5: Update API service**

In `frontend/src/services/api.ts`, update `UserDataResponse` (line 115) and add new API functions:

```typescript
import type { Note } from '../types/notes';
import type { Flashcard } from '../types/flashcards';

// Update the existing interface
export interface UserDataResponse {
  profile: UserProfile | null;
  plan: StudyPlan | null;
  sessions: TrackedSession[];
  settings: AppSettings | null;
  streak: number;
  last_session_date: string | null;
  notes: Note[];
  flashcards: Flashcard[];
}

// Add after apiResetData (line 165):
export async function apiSaveNotes(notes: Note[]): Promise<void> {
  await request('/users/me/notes', {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  });
}

export async function apiSaveFlashcards(flashcards: Flashcard[]): Promise<void> {
  await request('/users/me/flashcards', {
    method: 'PUT',
    body: JSON.stringify({ flashcards }),
  });
}
```

- [ ] **Step 6: Update defaultSettings in AppContext**

In `frontend/src/context/AppContext.tsx`, update `defaultSettings` (line 32):

```typescript
const defaultSettings: AppSettings = {
  darkMode: false,
  remindersEnabled: false,
  reminderMinutesBefore: 15,
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  pomodoroLongBreakMinutes: 15,
  pomodorosBeforeLongBreak: 4,
};
```

- [ ] **Step 7: Run build to verify types compile**

Run: `cd "D:/Prog/Project/Ai study planner modification/frontend" && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 8: Commit**

```bash
cd "D:/Prog/Project/Ai study planner modification"
git add frontend/src/types/ frontend/src/services/api.ts frontend/src/context/AppContext.tsx
git commit -m "feat: add types and API functions for notes, flashcards, and Pomodoro settings"
```

---

## Task 3: AppContext — Notes and Flashcards State Management

**Files:**
- Modify: `frontend/src/context/AppContext.tsx`

- [ ] **Step 1: Add imports and state**

At the top of `AppContext.tsx`, add imports:

```typescript
import type { Note } from '../types/notes';
import type { Flashcard } from '../types/flashcards';
import { apiSaveNotes, apiSaveFlashcards } from '../services/api';
```

Add to the `AppContextValue` interface (after line 28):

```typescript
  notes: Note[];
  flashcards: Flashcard[];
  addNote: (note: Note) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  setFlashcards: (flashcards: Flashcard[]) => void;
  addFlashcard: (card: Flashcard) => void;
  updateFlashcard: (id: string, updates: Partial<Flashcard>) => void;
  deleteFlashcard: (id: string) => void;
```

- [ ] **Step 2: Add state variables**

After the existing state declarations (after line 53), add:

```typescript
const [notes, setNotesState] = useState<Note[]>([]);
const [flashcards, setFlashcardsState] = useState<Flashcard[]>([]);
```

- [ ] **Step 3: Load notes and flashcards from backend**

In the `useEffect` data loader (around line 61), after `setSessionsState`, add:

```typescript
setNotesState(data.notes ?? []);
setFlashcardsState(data.flashcards ?? []);
```

- [ ] **Step 4: Add CRUD methods**

After the existing `resetAll` callback (after line 172), add:

```typescript
const addNote = useCallback((note: Note) => {
  setNotesState((prev) => {
    const updated = [...prev, note];
    apiSaveNotes(updated).catch(console.error);
    return updated;
  });
}, []);

const updateNote = useCallback((id: string, updates: Partial<Note>) => {
  setNotesState((prev) => {
    const updated = prev.map((n) => (n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n));
    apiSaveNotes(updated).catch(console.error);
    return updated;
  });
}, []);

const deleteNote = useCallback((id: string) => {
  setNotesState((prev) => {
    const updated = prev.filter((n) => n.id !== id);
    apiSaveNotes(updated).catch(console.error);
    return updated;
  });
}, []);

const setFlashcardsCtx = useCallback((cards: Flashcard[]) => {
  setFlashcardsState(cards);
  apiSaveFlashcards(cards).catch(console.error);
}, []);

const addFlashcard = useCallback((card: Flashcard) => {
  setFlashcardsState((prev) => {
    const updated = [...prev, card];
    apiSaveFlashcards(updated).catch(console.error);
    return updated;
  });
}, []);

const updateFlashcard = useCallback((id: string, updates: Partial<Flashcard>) => {
  setFlashcardsState((prev) => {
    const updated = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
    apiSaveFlashcards(updated).catch(console.error);
    return updated;
  });
}, []);

const deleteFlashcard = useCallback((id: string) => {
  setFlashcardsState((prev) => {
    const updated = prev.filter((c) => c.id !== id);
    apiSaveFlashcards(updated).catch(console.error);
    return updated;
  });
}, []);
```

- [ ] **Step 5: Update resetAll to clear notes and flashcards**

In `resetAll` (around line 162-172), add after `setMissedSessions([])`:

```typescript
setNotesState([]);
setFlashcardsState([]);
```

- [ ] **Step 6: Add to Provider value**

Update the `<AppContext.Provider value={{...}}>` to include the new state and methods:

```typescript
notes,
flashcards,
addNote,
updateNote,
deleteNote,
setFlashcards: setFlashcardsCtx,
addFlashcard,
updateFlashcard,
deleteFlashcard,
```

- [ ] **Step 7: Run build**

Run: `cd "D:/Prog/Project/Ai study planner modification/frontend" && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 8: Commit**

```bash
cd "D:/Prog/Project/Ai study planner modification"
git add frontend/src/context/AppContext.tsx
git commit -m "feat: add notes and flashcards state management to AppContext"
```

---

## Task 4: Pomodoro Timer Component

**Files:**
- Create: `frontend/src/components/PomodoroTimer.tsx`
- Modify: `frontend/src/pages/HomePage.tsx`

- [ ] **Step 1: Create PomodoroTimer component**

Create `frontend/src/components/PomodoroTimer.tsx`:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, Square, SkipForward, RotateCcw, FileText } from 'lucide-react';
import { Button } from './Button';
import { useApp } from '../context/AppContext';
import type { TrackedSession } from '../types';

type TimerPhase = 'work' | 'break' | 'longBreak';

interface PomodoroTimerProps {
  subject: string;
  chapter: string;
  plannedSessionId?: string;
  onComplete: () => void;
  onCancel: () => void;
  onAddNote?: () => void; // optional: opens note editor during active session
}

export function PomodoroTimer({ subject, chapter, plannedSessionId, onComplete, onCancel, onAddNote }: PomodoroTimerProps) {
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
  const startTimeRef = useRef<number>(Date.now());

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
      // Break finished → back to work
      setPhase('work');
      setSecondsLeft(pomodoroWorkMinutes * 60);
    }
  }, [secondsLeft, isRunning, phase, completedPomodoros, pomodoroWorkMinutes, pomodoroBreakMinutes, pomodoroLongBreakMinutes, pomodorosBeforeLongBreak]);

  const handleStop = useCallback(() => {
    setIsRunning(false);
    const duration = Math.max(1, Math.round(totalWorkSeconds / 60));
    // Count current work cycle as completed only if more than half done
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
    };
    addSession(tracked);
    onComplete();
  }, [totalWorkSeconds, subject, plannedSessionId, completedPomodoros, phase, secondsLeft, totalSeconds, addSession, onComplete]);

  const handleSkip = () => {
    if (phase === 'work') {
      // Skip to break
      const newCount = completedPomodoros + 1;
      setCompletedPomodoros(newCount);
      setTotalWorkSeconds((prev) => prev + secondsLeft); // count remaining time
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
      {/* Subject info */}
      <div className="text-center mb-4">
        <p className={`text-xs font-semibold uppercase tracking-wide ${phaseColor}`}>{phaseLabel}</p>
        <p className="text-sm font-bold text-app-dark dark:text-white mt-1">{subject}</p>
        <p className="text-xs text-gray-400">{chapter}</p>
      </div>

      {/* Circular timer */}
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

      {/* Controls */}
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

      {/* Stop session button */}
      <div className="mt-4 flex justify-center gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        {onAddNote && (
          <Button variant="secondary" size="sm" onClick={onAddNote} className="flex items-center gap-1">
            <FileText size={12} /> Add Note
          </Button>
        )}
        <Button variant="danger" size="sm" onClick={handleStop} className="flex items-center gap-1">
          <Square size={12} fill="currentColor" /> End & Save
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate PomodoroTimer into HomePage**

Replace the existing timer logic in `frontend/src/pages/HomePage.tsx`. The key changes:

1. Add import: `import { PomodoroTimer } from '../components/PomodoroTimer';`
2. Remove the `useElapsedTimer` hook and the simple `startSession`/`stopSession` functions
3. Replace `activeSession` state with Pomodoro-aware state:

```typescript
const [activeSession, setActiveSession] = useState<{
  subject: string;
  chapter: string;
  plannedSessionId?: string;
} | null>(null);

function startSession(subject: string, chapter: string, plannedSessionId?: string) {
  setActiveSession({ subject, chapter, plannedSessionId });
}

function handlePomodoroComplete() {
  setActiveSession(null);
}

function handlePomodoroCancel() {
  setActiveSession(null);
}
```

4. Replace the active session card (lines 167-183) with:

```tsx
{activeSession && (
  <div className="mb-4">
    <PomodoroTimer
      subject={activeSession.subject}
      chapter={activeSession.chapter}
      plannedSessionId={activeSession.plannedSessionId}
      onComplete={handlePomodoroComplete}
      onCancel={handlePomodoroCancel}
      onAddNote={() => {
        // Find the subject's ID for the note editor
        const detail = profile.subjectDetails.find(d => d.name === activeSession.subject);
        if (detail) setNoteEditorSubject(detail);
      }}
    />
    {/* Note editor modal during active session */}
    {noteEditorSubject && (
      <NoteEditor
        subjectId={noteEditorSubject.id}
        subjectName={noteEditorSubject.name}
        onSave={(note) => { addNote(note); setNoteEditorSubject(null); }}
        onCancel={() => setNoteEditorSubject(null)}
      />
    )}
  </div>
)}

// Add these state/imports to HomePage:
// import { NoteEditor } from '../components/NoteEditor';
// const { addNote } = useApp();
// const [noteEditorSubject, setNoteEditorSubject] = useState<SubjectDetail | null>(null);
```

5. Update the "Start Session" button (line 209) to pass `plannedSessionId`:

```tsx
onClick={() => activeSession ? handlePomodoroCancel() : startSession(nextSession.subject, nextSession.chapter, nextSession.id)}
```

- [ ] **Step 3: Remove old elapsed timer import and hook**

Remove the `useElapsedTimer` function definition (lines 30-43) and the `elapsed` state (line 49) from `HomePage.tsx`. Remove unused imports: `Square`, `Timer` if no longer used elsewhere (check first).

- [ ] **Step 4: Run build**

Run: `cd "D:/Prog/Project/Ai study planner modification/frontend" && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
cd "D:/Prog/Project/Ai study planner modification"
git add frontend/src/components/PomodoroTimer.tsx frontend/src/pages/HomePage.tsx
git commit -m "feat: add Pomodoro timer with work/break cycles and countdown ring"
```

---

## Task 5: Pomodoro Settings in Settings Page

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add Pomodoro settings section**

In `frontend/src/pages/SettingsPage.tsx`, add a new Card after the Preferences card (after line 229), before the Danger Zone card:

```tsx
{/* Pomodoro Settings */}
<Card className="mb-4">
  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Pomodoro Timer</p>

  <div className="flex flex-col gap-4">
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-500">Work duration</span>
        <span className="text-xs font-semibold text-primary">{settings.pomodoroWorkMinutes} min</span>
      </div>
      <input
        type="range" min={15} max={60} step={5}
        value={settings.pomodoroWorkMinutes}
        onChange={(e) => updateSettings({ pomodoroWorkMinutes: Number(e.target.value) })}
        className="w-full cursor-pointer" style={{ accentColor: '#6C47FF' }}
      />
    </div>

    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-500">Short break</span>
        <span className="text-xs font-semibold text-primary">{settings.pomodoroBreakMinutes} min</span>
      </div>
      <input
        type="range" min={3} max={15} step={1}
        value={settings.pomodoroBreakMinutes}
        onChange={(e) => updateSettings({ pomodoroBreakMinutes: Number(e.target.value) })}
        className="w-full cursor-pointer" style={{ accentColor: '#6C47FF' }}
      />
    </div>

    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-500">Long break</span>
        <span className="text-xs font-semibold text-primary">{settings.pomodoroLongBreakMinutes} min</span>
      </div>
      <input
        type="range" min={10} max={30} step={5}
        value={settings.pomodoroLongBreakMinutes}
        onChange={(e) => updateSettings({ pomodoroLongBreakMinutes: Number(e.target.value) })}
        className="w-full cursor-pointer" style={{ accentColor: '#6C47FF' }}
      />
    </div>

    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-gray-500">Pomodoros before long break</span>
        <span className="text-xs font-semibold text-primary">{settings.pomodorosBeforeLongBreak}</span>
      </div>
      <input
        type="range" min={2} max={6} step={1}
        value={settings.pomodorosBeforeLongBreak}
        onChange={(e) => updateSettings({ pomodorosBeforeLongBreak: Number(e.target.value) })}
        className="w-full cursor-pointer" style={{ accentColor: '#6C47FF' }}
      />
    </div>
  </div>
</Card>
```

- [ ] **Step 2: Run build**

Run: `cd "D:/Prog/Project/Ai study planner modification/frontend" && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
cd "D:/Prog/Project/Ai study planner modification"
git add frontend/src/pages/SettingsPage.tsx
git commit -m "feat: add Pomodoro timer settings (work/break durations, cycles)"
```

---

## Task 6: Quick Notes — Editor Component

**Files:**
- Create: `frontend/src/components/NoteEditor.tsx`

- [ ] **Step 1: Create NoteEditor modal component**

Create `frontend/src/components/NoteEditor.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import type { Note } from '../types/notes';

interface NoteEditorProps {
  note?: Note | null; // null = create mode
  subjectId: string;
  subjectName: string;
  onSave: (note: Note) => void;
  onCancel: () => void;
}

export function NoteEditor({ note, subjectId, subjectName, onSave, onCancel }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
    }
  }, [note]);

  function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    const now = new Date().toISOString();
    const saved: Note = {
      id: note?.id ?? crypto.randomUUID(),
      subjectId,
      title: title.trim(),
      content: content.trim(),
      createdAt: note?.createdAt ?? now,
      updatedAt: now,
    };
    onSave(saved);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-t-3xl p-6 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-app-dark dark:text-white">
            {note ? 'Edit Note' : 'New Note'}
          </h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-primary font-semibold mb-3">{subjectName}</p>

        <input
          autoFocus
          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-app-dark dark:text-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Note title"
          value={title}
          onChange={(e) => { setTitle(e.target.value); setError(''); }}
        />

        <textarea
          className="w-full flex-1 min-h-[200px] px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-app-dark dark:text-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="Write your notes here... (Markdown supported)"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex gap-3">
          <Button variant="ghost" onClick={onCancel} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} className="flex-grow">{note ? 'Update' : 'Save Note'}</Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run build**

Run: `cd "D:/Prog/Project/Ai study planner modification/frontend" && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
cd "D:/Prog/Project/Ai study planner modification"
git add frontend/src/components/NoteEditor.tsx
git commit -m "feat: add NoteEditor modal component for creating/editing notes"
```

---

## Task 7: Quick Notes — List Component and Integration into SubjectsPage

**Files:**
- Create: `frontend/src/components/NotesList.tsx`
- Modify: `frontend/src/pages/SubjectsPage.tsx`

- [ ] **Step 1: Create NotesList component**

Create `frontend/src/components/NotesList.tsx`:

```typescript
import { useState } from 'react';
import { FileText, Plus, Trash2, Edit3 } from 'lucide-react';
import { Button } from './Button';
import { NoteEditor } from './NoteEditor';
import { useApp } from '../context/AppContext';
import type { Note } from '../types/notes';

interface NotesListProps {
  subjectId: string;
  subjectName: string;
}

export function NotesList({ subjectId, subjectName }: NotesListProps) {
  const { notes, addNote, updateNote, deleteNote } = useApp();
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const subjectNotes = notes
    .filter((n) => n.subjectId === subjectId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  function handleSave(note: Note) {
    if (editingNote) {
      updateNote(note.id, { title: note.title, content: note.content });
    } else {
      addNote(note);
    }
    setEditingNote(null);
    setShowEditor(false);
  }

  function handleEdit(note: Note) {
    setEditingNote(note);
    setShowEditor(true);
  }

  function handleDelete(id: string) {
    deleteNote(id);
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Notes ({subjectNotes.length})
        </p>
        <button
          onClick={() => { setEditingNote(null); setShowEditor(true); }}
          className="text-xs text-primary font-semibold flex items-center gap-1"
        >
          <Plus size={12} /> Add
        </button>
      </div>

      {subjectNotes.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">No notes yet. Tap "Add" to create one.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {subjectNotes.map((note) => (
            <div
              key={note.id}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <FileText size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-app-dark dark:text-white truncate">{note.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{note.content}</p>
                    <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(note)} className="p-1 text-gray-400 hover:text-primary">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => handleDelete(note.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showEditor && (
        <NoteEditor
          note={editingNote}
          subjectId={subjectId}
          subjectName={subjectName}
          onSave={handleSave}
          onCancel={() => { setShowEditor(false); setEditingNote(null); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate NotesList into SubjectsPage expanded section**

In `frontend/src/pages/SubjectsPage.tsx`, add import:

```typescript
import { NotesList } from '../components/NotesList';
```

Then inside the expanded subject section (around line 126, inside `{isExpanded && (...)}`), add `NotesList` after the progress slider div (after line 164, before the closing `</div>` of the expanded section):

```tsx
<NotesList subjectId={detail?.id ?? ''} subjectName={sp.subject} />
```

- [ ] **Step 3: Run build**

Run: `cd "D:/Prog/Project/Ai study planner modification/frontend" && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 4: Commit**

```bash
cd "D:/Prog/Project/Ai study planner modification"
git add frontend/src/components/NotesList.tsx frontend/src/pages/SubjectsPage.tsx
git commit -m "feat: add notes list with CRUD integrated into SubjectsPage"
```

---

## Task 8: Spaced Repetition Algorithm

**Files:**
- Create: `frontend/src/services/spacedRepetition.ts`

- [ ] **Step 1: Implement SM-2 variant**

Create `frontend/src/services/spacedRepetition.ts`:

```typescript
import type { Flashcard } from '../types/flashcards';

export type Rating = 'again' | 'hard' | 'easy';

/**
 * SM-2 variant for spaced repetition.
 * Returns updated interval, easeFactor, and nextReviewDate.
 */
export function rateCard(
  card: Flashcard,
  rating: Rating,
): { interval: number; easeFactor: number; nextReviewDate: string } {
  let { interval, easeFactor } = card;

  switch (rating) {
    case 'again':
      interval = 0; // review again in same session
      easeFactor = Math.max(1.3, easeFactor - 0.2);
      break;
    case 'hard':
      interval = 1;
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      break;
    case 'easy':
      interval = Math.min(30, Math.max(interval * easeFactor, 3));
      interval = Math.round(interval);
      easeFactor = easeFactor + 0.15;
      break;
  }

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);
  const nextReviewDate = nextDate.toISOString().split('T')[0];

  return { interval, easeFactor, nextReviewDate };
}

/**
 * Check if a card is due for review today.
 */
export function isDueToday(card: Flashcard): boolean {
  const today = new Date().toISOString().split('T')[0];
  return card.nextReviewDate <= today;
}

/**
 * Check if a card is mastered (interval >= 21 days).
 */
export function isMastered(card: Flashcard): boolean {
  return card.interval >= 21;
}

/**
 * Get review stats for a set of flashcards.
 */
export function getReviewStats(cards: Flashcard[]): {
  dueToday: number;
  mastered: number;
  total: number;
} {
  const today = new Date().toISOString().split('T')[0];
  return {
    dueToday: cards.filter((c) => c.nextReviewDate <= today).length,
    mastered: cards.filter((c) => c.interval >= 21).length,
    total: cards.length,
  };
}
```

- [ ] **Step 2: Run build**

Run: `cd "D:/Prog/Project/Ai study planner modification/frontend" && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
cd "D:/Prog/Project/Ai study planner modification"
git add frontend/src/services/spacedRepetition.ts
git commit -m "feat: implement SM-2 spaced repetition algorithm"
```

---

## Task 9: Flashcard Review Component

**Files:**
- Create: `frontend/src/components/FlashcardReview.tsx`

- [ ] **Step 1: Create FlashcardReview component**

Create `frontend/src/components/FlashcardReview.tsx`:

```typescript
import { useState } from 'react';
import { RotateCcw, ThumbsDown, Minus, ThumbsUp, ArrowLeft } from 'lucide-react';
import { Button } from './Button';
import { useApp } from '../context/AppContext';
import { rateCard, type Rating } from '../services/spacedRepetition';
import type { Flashcard } from '../types/flashcards';

interface FlashcardReviewProps {
  cards: Flashcard[];
  onDone: () => void;
}

export function FlashcardReview({ cards: initialCards, onDone }: FlashcardReviewProps) {
  const { updateFlashcard } = useApp();
  const [queue, setQueue] = useState<Flashcard[]>(initialCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  if (queue.length === 0 || currentIndex >= queue.length) {
    return (
      <div className="text-center py-12">
        <p className="text-4xl mb-3">🎉</p>
        <p className="text-lg font-bold text-app-dark dark:text-white mb-1">Review Complete!</p>
        <p className="text-sm text-gray-500 mb-4">{reviewed} card{reviewed !== 1 ? 's' : ''} reviewed</p>
        <Button onClick={onDone}>Back to Flashcards</Button>
      </div>
    );
  }

  const card = queue[currentIndex];

  function handleRate(rating: Rating) {
    const { interval, easeFactor, nextReviewDate } = rateCard(card, rating);
    updateFlashcard(card.id, { interval, easeFactor, nextReviewDate });
    setReviewed((r) => r + 1);
    setFlipped(false);

    if (rating === 'again') {
      // Re-queue card at end for same-session re-review
      setQueue((prev) => [...prev, { ...card, interval, easeFactor, nextReviewDate }]);
    }
    setCurrentIndex((i) => i + 1);
  }

  return (
    <div>
      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onDone} className="text-gray-400 hover:text-gray-600 flex items-center gap-1">
          <ArrowLeft size={16} /> Back
        </button>
        <p className="text-xs text-gray-400">
          {currentIndex + 1} / {cards.length}
        </p>
      </div>

      {/* Card */}
      <div
        onClick={() => setFlipped(!flipped)}
        className="min-h-[250px] bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center justify-center cursor-pointer select-none transition-all hover:border-primary/30"
      >
        <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">
          {flipped ? 'Answer' : 'Question'}
        </p>
        <p className="text-lg font-semibold text-app-dark dark:text-white text-center leading-relaxed">
          {flipped ? card.back : card.front}
        </p>
        {!flipped && (
          <p className="text-xs text-gray-300 dark:text-gray-600 mt-4 flex items-center gap-1">
            <RotateCcw size={12} /> Tap to reveal
          </p>
        )}
      </div>

      {/* Rating buttons — only show when flipped */}
      {flipped && (
        <div className="grid grid-cols-3 gap-3 mt-4">
          <button
            onClick={() => handleRate('again')}
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <ThumbsDown size={20} />
            <span className="text-xs font-semibold">Again</span>
            <span className="text-xs text-red-400">Now</span>
          </button>
          <button
            onClick={() => handleRate('hard')}
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <Minus size={20} />
            <span className="text-xs font-semibold">Hard</span>
            <span className="text-xs text-amber-400">1d</span>
          </button>
          <button
            onClick={() => handleRate('easy')}
            className="flex flex-col items-center gap-1 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
          >
            <ThumbsUp size={20} />
            <span className="text-xs font-semibold">Easy</span>
            <span className="text-xs text-green-400">{Math.round(Math.max(card.interval * card.easeFactor, 3))}d</span>
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run build**

Run: `cd "D:/Prog/Project/Ai study planner modification/frontend" && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
cd "D:/Prog/Project/Ai study planner modification"
git add frontend/src/components/FlashcardReview.tsx
git commit -m "feat: add FlashcardReview component with flip animation and SM-2 rating"
```

---

## Task 10: Flashcards Page

**Files:**
- Create: `frontend/src/pages/FlashcardsPage.tsx`
- Modify: `frontend/src/App.tsx:36-44`
- Modify: `frontend/src/pages/SubjectsPage.tsx`

- [ ] **Step 1: Create FlashcardsPage**

Create `frontend/src/pages/FlashcardsPage.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Layers } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { FlashcardReview } from '../components/FlashcardReview';
import { useApp } from '../context/AppContext';
import { isDueToday, isMastered, getReviewStats } from '../services/spacedRepetition';
import type { Flashcard } from '../types/flashcards';

export function FlashcardsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterSubjectId = searchParams.get('subject');

  const { profile, flashcards, addFlashcard, deleteFlashcard } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(filterSubjectId);

  // Create form
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [cardSubjectId, setCardSubjectId] = useState(filterSubjectId ?? profile?.subjectDetails[0]?.id ?? '');
  const [createError, setCreateError] = useState('');

  if (!profile) return null;

  const subjects = profile.subjectDetails;

  const filtered = selectedSubjectId
    ? flashcards.filter((c) => c.subjectId === selectedSubjectId)
    : flashcards;

  const stats = getReviewStats(filtered);
  const dueCards = filtered.filter(isDueToday);

  function getSubjectName(subjectId: string): string {
    return subjects.find((s) => s.id === subjectId)?.name ?? 'Unknown';
  }

  function handleCreate() {
    if (!front.trim()) { setCreateError('Question is required'); return; }
    if (!back.trim()) { setCreateError('Answer is required'); return; }

    const card: Flashcard = {
      id: crypto.randomUUID(),
      subjectId: cardSubjectId,
      front: front.trim(),
      back: back.trim(),
      nextReviewDate: new Date().toISOString().split('T')[0],
      interval: 0,
      easeFactor: 2.5,
      createdAt: new Date().toISOString(),
    };
    addFlashcard(card);
    setFront('');
    setBack('');
    setCreateError('');
    setShowCreate(false);
  }

  if (reviewMode) {
    return (
      <div className="min-h-screen bg-app-bg dark:bg-gray-950 pb-24">
        <div className="max-w-lg mx-auto px-4 pt-12">
          <FlashcardReview cards={dueCards} onDone={() => setReviewMode(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-bg dark:bg-gray-950 pb-24">
      <div className="max-w-lg mx-auto px-4 pt-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/subjects')} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <Layers size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-app-dark dark:text-white">Flashcards</h1>
          </div>
        </div>

        {/* Subject filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          <button
            onClick={() => setSelectedSubjectId(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              !selectedSubjectId ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            }`}
          >
            All
          </button>
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSubjectId(s.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selectedSubjectId === s.id ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <Card>
            <p className="text-xs text-gray-500 mb-0.5">Due Today</p>
            <p className="text-xl font-bold text-primary">{stats.dueToday}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 mb-0.5">Mastered</p>
            <p className="text-xl font-bold text-green-500">{stats.mastered}</p>
          </Card>
          <Card>
            <p className="text-xs text-gray-500 mb-0.5">Total</p>
            <p className="text-xl font-bold text-app-dark dark:text-white">{stats.total}</p>
          </Card>
        </div>

        {/* Review button */}
        {dueCards.length > 0 && (
          <Button onClick={() => setReviewMode(true)} className="w-full mb-4">
            Review {dueCards.length} Due Card{dueCards.length !== 1 ? 's' : ''}
          </Button>
        )}

        {/* Card list */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Cards ({filtered.length})
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs text-primary font-semibold flex items-center gap-1"
          >
            <Plus size={12} /> New Card
          </button>
        </div>

        {filtered.length === 0 ? (
          <Card>
            <p className="text-sm text-gray-400 text-center py-4">
              No flashcards yet. Create one to get started!
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((card) => (
              <Card key={card.id} className="group">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-bg dark:bg-primary/20 text-primary font-semibold">
                        {getSubjectName(card.subjectId)}
                      </span>
                      {isMastered(card) && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-600">
                          Mastered
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-app-dark dark:text-white truncate">{card.front}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{card.back}</p>
                  </div>
                  <button
                    onClick={() => deleteFlashcard(card.id)}
                    className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-app-dark dark:text-white mb-4">New Flashcard</h3>

            <div className="mb-3">
              <label className="text-xs text-gray-500 mb-1 block">Subject</label>
              <select
                value={cardSubjectId}
                onChange={(e) => setCardSubjectId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-app-dark dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <textarea
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-app-dark dark:text-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              placeholder="Question (front)"
              value={front}
              onChange={(e) => { setFront(e.target.value); setCreateError(''); }}
            />

            <textarea
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-app-dark dark:text-white text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              placeholder="Answer (back)"
              value={back}
              onChange={(e) => { setBack(e.target.value); setCreateError(''); }}
            />

            {createError && <p className="text-xs text-red-500 mb-3">{createError}</p>}

            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setShowCreate(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleCreate} className="flex-grow">Create Card</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add flashcards route to App.tsx**

In `frontend/src/App.tsx`, add the import:

```typescript
import { FlashcardsPage } from './pages/FlashcardsPage';
```

Add a new route inside `AuthenticatedApp` (after the `/subjects` route at line 40):

```tsx
<Route path="/subjects/flashcards" element={hasOnboarded ? <FlashcardsPage /> : <Navigate to="/onboarding" replace />} />
```

**Important:** This route must come BEFORE the `/subjects` route, or use exact matching. Place it at line 40, before the generic `/subjects` route.

- [ ] **Step 3: Add "Flashcards" button to SubjectsPage**

In `frontend/src/pages/SubjectsPage.tsx`, add import:

```typescript
import { useNavigate } from 'react-router-dom';
import { Layers } from 'lucide-react';
```

Note: `useNavigate` is not currently imported in SubjectsPage, so add it. Then add a Flashcards navigation button. Place it after the header div (after line 85), before the regenerating notice:

```tsx
{/* Flashcards quick access */}
<button
  onClick={() => navigate('/subjects/flashcards')}
  className="w-full flex items-center justify-between p-3 mb-4 rounded-xl bg-purple-bg dark:bg-primary/10 hover:bg-primary/20 transition-colors"
>
  <div className="flex items-center gap-2">
    <Layers size={16} className="text-primary" />
    <span className="text-sm font-semibold text-primary">Flashcards</span>
  </div>
  <span className="text-xs text-primary/60">{flashcards.filter(c => c.nextReviewDate <= new Date().toISOString().split('T')[0]).length} due →</span>
</button>

Additionally, inside each expanded subject section (after the NotesList component), add a per-subject flashcards link:

```tsx
<button
  onClick={() => navigate(`/subjects/flashcards?subject=${detail?.id}`)}
  className="flex items-center gap-1 text-xs text-primary font-semibold mt-2"
>
  <Layers size={12} /> View Flashcards for {sp.subject}
</button>
```
```

Also add `flashcards` to the destructured context:

```typescript
const { profile, plan, setProfile, setPlan, updateSubjectProgress, flashcards } = useApp();
```

And add `const navigate = useNavigate();` at the top of the component.

- [ ] **Step 4: Run build**

Run: `cd "D:/Prog/Project/Ai study planner modification/frontend" && npm run build`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
cd "D:/Prog/Project/Ai study planner modification"
git add frontend/src/pages/FlashcardsPage.tsx frontend/src/App.tsx frontend/src/pages/SubjectsPage.tsx
git commit -m "feat: add FlashcardsPage with create, review, and spaced repetition"
```

---

## Task 11: Final Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

```bash
cd "D:/Prog/Project/Ai study planner modification/frontend" && npm run build
```

Expected: BUILD SUCCESS with no TypeScript errors.

- [ ] **Step 2: Run lint**

```bash
cd "D:/Prog/Project/Ai study planner modification/frontend" && npm run lint
```

Expected: No errors (warnings acceptable but review them).

- [ ] **Step 3: Manual smoke test checklist**

Start both servers:
```bash
cd "D:/Prog/Project/Ai study planner modification" && start.bat
```

Verify:
- [ ] Home page loads, Pomodoro timer appears when starting a session
- [ ] Pomodoro cycles through work → break → work → long break
- [ ] Stopping a Pomodoro session saves a TrackedSession
- [ ] Settings page shows Pomodoro configuration sliders
- [ ] Subjects page shows "Flashcards" quick-access button
- [ ] Expanding a subject shows Notes section
- [ ] Can create, edit, and delete notes
- [ ] Flashcards page loads at `/subjects/flashcards`
- [ ] Can create flashcards with subject picker
- [ ] Review mode works with flip + rating
- [ ] Subject filter tabs work on flashcards page

- [ ] **Step 4: Final commit if any fixes needed**

```bash
cd "D:/Prog/Project/Ai study planner modification"
git add frontend/src/ backend/
git commit -m "fix: address build and lint issues from Phase 1 integration"
```

(Skip if no fixes needed.)
