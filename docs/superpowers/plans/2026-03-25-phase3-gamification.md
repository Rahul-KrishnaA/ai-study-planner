# Phase 3: Gamification & Engagement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add XP & levels, achievements with toast notifications, weekly study goal ring, streak freeze, and best streak tracking.

**Architecture:** Gamification state (xp, level, achievements, streakFreezes, bestStreak, weeklyGoalHours) lives in AppContext alongside existing streak state. XP is awarded via a centralized `awardXP(amount)` function in AppContext, called from `addSession`, flashcard review, and topic completion. Achievement checking runs in `addSession` and `awardXP`. Backend adds 6 new fields to `user_data` (4 integers + 1 JSON column + 1 integer for goal), requiring a DB recreation (dev project). **Tasks 0 and 1 are prerequisites** — complete them before any other task.

**Tech Stack:** React 18 + TypeScript 5, FastAPI + SQLAlchemy, SQLite

---

## File Map

**Created:**
- `src/types/achievements.ts` — Achievement type + all static achievement definitions
- `src/services/xp.ts` — XP/level math helpers (`xpForLevel`, `levelFromXP`, `calcSessionXP`, `calcFlashcardXP`)
- `src/services/achievementChecker.ts` — Pure function: given app state, returns newly unlocked achievement IDs
- `src/components/AchievementToast.tsx` — Slide-in toast notification shown when achievement unlocks
- `src/components/WeeklyGoalRing.tsx` — SVG ring showing weekly hours studied vs goal
- `src/pages/AchievementsPage.tsx` — Grid of all achievements with progress bars

**Modified:**
- `src/types/index.ts` — Add `weeklyGoalHours` to `AppSettings`
- `src/services/api.ts` — Extend `UserDataResponse`; add `apiUpdateGamification`, `apiUpdateStreakFull`
- `src/context/AppContext.tsx` — Add gamification state + `awardXP` + achievement unlock logic + streak freeze on load
- `src/pages/HomePage.tsx` — Add level badge, XP bar, weekly goal ring, streak freeze indicator
- `src/pages/SettingsPage.tsx` — Add weekly goal slider
- `src/App.tsx` — Add `/achievements` route
- `backend/models.py` — Add 5 new columns to `UserData`
- `backend/main.py` — Update streak endpoint, GET data, DELETE data; add gamification endpoint

---

## Task 0: Backend Schema — New Columns

**Files:**
- Modify: `backend/models.py`
- Modify: `backend/main.py`
- Delete: `backend/study_planner.db` (force schema recreation)

- [ ] Add 5 new columns to `UserData` in `backend/models.py`:

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
    # Phase 3 — gamification
    xp = Column(Integer, default=0)
    level = Column(Integer, default=1)
    best_streak = Column(Integer, default=0)
    streak_freezes = Column(Integer, default=0)
    achievements_json = Column(Text, default="[]")
    weekly_goal_hours = Column(Integer, default=10)
```

- [ ] Delete the existing DB file to force SQLAlchemy to recreate the schema:

```bash
del "D:\Prog\Project\Ai study planner modification\backend\study_planner.db"
```

- [ ] Add new Pydantic schemas and update endpoints in `backend/main.py`.

  **Add schemas** (after `FlashcardsRequest`):

```python
class GamificationRequest(BaseModel):
    xp: int
    level: int
    achievements: list
    weekly_goal_hours: Optional[int] = None

class StreakFullRequest(BaseModel):
    streak: int
    last_session_date: Optional[str] = None
    streak_freezes: int = 0
    best_streak: int = 0
```

  **Replace the existing `StreakRequest` usage** — keep `StreakRequest` for backward compat but add the new full endpoint. Update `PUT /users/me/streak` to use `StreakFullRequest`:

```python
@app.put("/users/me/streak")
def update_streak(
    req: StreakFullRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_or_create_user_data(current_user.id, db)
    data.streak = req.streak
    data.last_session_date = req.last_session_date
    data.streak_freezes = req.streak_freezes
    data.best_streak = req.best_streak
    db.commit()
    return {"ok": True}
```

  **Add `PUT /users/me/gamification` endpoint**:

```python
@app.put("/users/me/gamification")
def update_gamification(
    req: GamificationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_or_create_user_data(current_user.id, db)
    data.xp = req.xp
    data.level = req.level
    data.achievements_json = json.dumps(req.achievements)
    if req.weekly_goal_hours is not None:
        data.weekly_goal_hours = req.weekly_goal_hours
    db.commit()
    return {"ok": True}
```

  **Update `GET /users/me/data`** to return new fields:

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
    "xp": data.xp or 0,
    "level": data.level or 1,
    "best_streak": data.best_streak or 0,
    "streak_freezes": data.streak_freezes or 0,
    "achievements": json.loads(data.achievements_json) if data.achievements_json else [],
    "weekly_goal_hours": data.weekly_goal_hours or 10,
}
```

  **Update `DELETE /users/me/data`** to reset new fields. Find the reset endpoint and add:

```python
data.xp = 0
data.level = 1
data.best_streak = 0
data.streak_freezes = 0
data.achievements_json = "[]"
data.weekly_goal_hours = 10
```

- [ ] Verify backend starts with no errors:

```bash
cd backend && python -c "import main; print('OK')"
```

- [ ] Commit:

```bash
git add backend/models.py backend/main.py
git commit -m "feat: add gamification columns (xp, level, streak_freezes, best_streak, achievements) to backend"
```

---

## Task 1: Frontend Types & API Updates

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/services/api.ts`

- [ ] Add `weeklyGoalHours` to `AppSettings` in `src/types/index.ts`:

```typescript
export interface AppSettings {
  darkMode: boolean;
  remindersEnabled: boolean;
  reminderMinutesBefore: number;
  pomodoroWorkMinutes: number;
  pomodoroBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  pomodorosBeforeLongBreak: number;
  weeklyGoalHours: number; // ← add this
}
```

- [ ] Extend `UserDataResponse` in `src/services/api.ts`:

```typescript
export interface UserDataResponse {
  profile: UserProfile | null;
  plan: StudyPlan | null;
  sessions: TrackedSession[];
  settings: AppSettings | null;
  streak: number;
  last_session_date: string | null;
  notes: Note[];
  flashcards: Flashcard[];
  xp: number;
  level: number;
  best_streak: number;
  streak_freezes: number;
  achievements: AchievementRecord[];
  weekly_goal_hours: number;
}
```

  Add import for `AchievementRecord` at the top of `api.ts`:

```typescript
import type { AchievementRecord } from '../types/achievements';
```

- [ ] Add two new API functions at the bottom of `src/services/api.ts`:

```typescript
export async function apiUpdateGamification(
  xp: number,
  level: number,
  achievements: AchievementRecord[],
  weeklyGoalHours?: number,
): Promise<void> {
  await request('/users/me/gamification', {
    method: 'PUT',
    body: JSON.stringify({ xp, level, achievements, weekly_goal_hours: weeklyGoalHours }),
  });
}

export async function apiUpdateStreakFull(
  streak: number,
  lastSessionDate: string | null,
  streakFreezes: number,
  bestStreak: number,
): Promise<void> {
  await request('/users/me/streak', {
    method: 'PUT',
    body: JSON.stringify({
      streak,
      last_session_date: lastSessionDate,
      streak_freezes: streakFreezes,
      best_streak: bestStreak,
    }),
  });
}
```

- [ ] Run build:

```bash
cd frontend && npm run build
```

  Expected: TypeScript error about missing `AchievementRecord` type — that's OK, we'll create it in Task 2.

- [ ] Commit what compiles so far (skip if build fails due to missing type — continue to Task 2 first):

---

## Task 2: Achievement Definitions

**Files:**
- Create: `src/types/achievements.ts`

- [ ] Create the file with the `AchievementRecord` type and all static achievement definitions:

```typescript
// AchievementRecord: persisted per-user state (stored in backend)
export interface AchievementRecord {
  id: string;
  unlockedAt: string | null; // ISO timestamp or null if locked
  progress: number;          // current progress value
}

// AchievementDef: static definition (never persisted, lives in code)
export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  icon: string;        // emoji
  target: number;      // progress value needed to unlock
  category: 'sessions' | 'streaks' | 'flashcards' | 'pomodoro' | 'topics' | 'xp';
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { id: 'first_steps',    name: 'First Steps',    description: 'Complete your first study session',        icon: '🎯', target: 1,   category: 'sessions' },
  { id: 'streak_3',       name: 'On a Roll',       description: 'Study 3 days in a row',                   icon: '🔥', target: 3,   category: 'streaks' },
  { id: 'streak_7',       name: 'Week Warrior',    description: 'Maintain a 7-day streak',                 icon: '⚡', target: 7,   category: 'streaks' },
  { id: 'streak_30',      name: 'Unstoppable',     description: 'Maintain a 30-day streak',                icon: '💎', target: 30,  category: 'streaks' },
  { id: 'pomodoro_10',    name: 'Focused',         description: 'Complete 10 Pomodoro cycles',             icon: '🍅', target: 10,  category: 'pomodoro' },
  { id: 'pomodoro_50',    name: 'Pomodoro Pro',    description: 'Complete 50 Pomodoro cycles',             icon: '🏆', target: 50,  category: 'pomodoro' },
  { id: 'flash_25',       name: 'Card Shark',      description: 'Review 25 flashcards',                    icon: '🃏', target: 25,  category: 'flashcards' },
  { id: 'flash_100',      name: 'Flash Master',    description: 'Review 100 flashcards',                   icon: '🧠', target: 100, category: 'flashcards' },
  { id: 'hours_10',       name: 'Dedicated',       description: 'Study for 10 total hours',                icon: '📚', target: 10,  category: 'sessions' },
  { id: 'hours_100',      name: 'Century',         description: 'Study for 100 total hours',               icon: '💯', target: 100, category: 'sessions' },
  { id: 'topics_5',       name: 'Topic Tackler',   description: 'Complete 5 topics',                       icon: '✅', target: 5,   category: 'topics' },
  { id: 'topics_20',      name: 'Syllabus Slayer', description: 'Complete 20 topics',                      icon: '🎓', target: 20,  category: 'topics' },
  { id: 'level_5',        name: 'Rising Star',     description: 'Reach Level 5',                           icon: '⭐', target: 5,   category: 'xp' },
  { id: 'level_10',       name: 'Scholar',         description: 'Reach Level 10',                          icon: '🌟', target: 10,  category: 'xp' },
  { id: 'night_owl',      name: 'Night Owl',       description: 'Start a study session after 10 PM',       icon: '🦉', target: 1,   category: 'sessions' },
];

// Build initial records for a new user (all locked, progress 0)
export function buildInitialAchievements(): AchievementRecord[] {
  return ACHIEVEMENT_DEFS.map((def) => ({ id: def.id, unlockedAt: null, progress: 0 }));
}
```

- [ ] Run build:

```bash
npm run build
```

  Build should now pass (the missing `AchievementRecord` import in `api.ts` is satisfied).

- [ ] Commit:

```bash
git add src/types/achievements.ts src/services/api.ts src/types/index.ts
git commit -m "feat: add Achievement types, gamification API functions, weeklyGoalHours setting"
```

---

## Task 3: XP Service

**Files:**
- Create: `src/services/xp.ts`

- [ ] Create the XP math helpers:

```typescript
import type { TrackedSession } from '../types';

// XP needed to reach a given level FROM level 1
// Level 1→2: 100 XP, each level scales by 1.5x
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

// Total cumulative XP needed to be AT a given level (not to reach next)
export function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForLevel(l);
  return total;
}

// Which level does this total XP correspond to?
export function levelFromTotalXP(totalXp: number): number {
  let level = 1;
  let accumulated = 0;
  while (accumulated + xpForLevel(level) <= totalXp) {
    accumulated += xpForLevel(level);
    level++;
    if (level > 50) break; // max level
  }
  return Math.min(level, 50);
}

// XP progress within current level (0 to xpForLevel(level)-1)
export function xpProgressInLevel(totalXp: number): { current: number; needed: number } {
  const level = levelFromTotalXP(totalXp);
  const base = cumulativeXpForLevel(level);
  return { current: totalXp - base, needed: xpForLevel(level) };
}

// How much XP does completing this session award?
export function calcSessionXP(session: TrackedSession): number {
  if (session.pomodoroCount && session.pomodoroCount > 0) {
    // Pomodoro XP: 15 per cycle
    return session.pomodoroCount * 15;
  }
  // Duration XP: 10 per 30 min
  return Math.floor((session.duration / 30)) * 10;
}

// XP for reviewing N flashcards
export function calcFlashcardXP(count: number): number {
  return count * 2;
}

// XP for completing a topic
export const TOPIC_COMPLETE_XP = 50;

// XP bonus for hitting daily goal
export const DAILY_GOAL_XP = 25;
```

- [ ] Run build:

```bash
npm run build
```

- [ ] Commit:

```bash
git add src/services/xp.ts
git commit -m "feat: add XP math service (calcSessionXP, levelFromTotalXP, xpForLevel)"
```

---

## Task 4: Achievement Checker Service

**Files:**
- Create: `src/services/achievementChecker.ts`

- [ ] Create the pure checker function. It takes current state and returns the list of achievement records with updated progress and newly unlocked ones:

```typescript
import type { TrackedSession } from '../types';
import type { AchievementRecord } from '../types/achievements';
import { ACHIEVEMENT_DEFS } from '../types/achievements';

interface CheckerInput {
  sessions: TrackedSession[];
  streak: number;
  level: number;
  existing: AchievementRecord[];
  // pass counts from calling context (avoids re-computing)
  totalFlashcardsReviewed: number;
  totalTopicsCompleted: number;
  latestSessionHour?: number; // 0-23, for night owl check
}

function getProgress(id: string, input: CheckerInput): number {
  const { sessions, streak, level, totalFlashcardsReviewed, totalTopicsCompleted, latestSessionHour } = input;

  switch (id) {
    case 'first_steps':
      return sessions.filter((s) => s.completed).length;
    case 'streak_3':
    case 'streak_7':
    case 'streak_30':
      return streak;
    case 'pomodoro_10':
    case 'pomodoro_50':
      return sessions.reduce((sum, s) => sum + (s.pomodoroCount ?? 0), 0);
    case 'flash_25':
    case 'flash_100':
      return totalFlashcardsReviewed;
    case 'hours_10':
    case 'hours_100':
      return Math.floor(sessions.reduce((sum, s) => sum + s.duration, 0) / 60);
    case 'topics_5':
    case 'topics_20':
      return totalTopicsCompleted;
    case 'level_5':
    case 'level_10':
      return level;
    case 'night_owl':
      return latestSessionHour !== undefined && latestSessionHour >= 22 ? 1 : 0;
    default:
      return 0;
  }
}

// Returns updated achievement records — newly unlocked ones have unlockedAt set
export function checkAchievements(input: CheckerInput): {
  updated: AchievementRecord[];
  newlyUnlocked: string[]; // achievement IDs
} {
  const now = new Date().toISOString();
  const newlyUnlocked: string[] = [];

  const updated = ACHIEVEMENT_DEFS.map((def) => {
    const existing = input.existing.find((r) => r.id === def.id) ?? { id: def.id, unlockedAt: null, progress: 0 };
    const progress = getProgress(def.id, input);

    if (!existing.unlockedAt && progress >= def.target) {
      newlyUnlocked.push(def.id);
      return { id: def.id, unlockedAt: now, progress };
    }

    return { ...existing, progress };
  });

  return { updated, newlyUnlocked };
}
```

- [ ] Run build:

```bash
npm run build
```

- [ ] Commit:

```bash
git add src/services/achievementChecker.ts
git commit -m "feat: add achievement checker service (pure function, no side effects)"
```

---

## Task 5: Gamification State in AppContext

**Files:**
- Modify: `src/context/AppContext.tsx`

This is the largest task — adds gamification state, wires XP into `addSession`, handles streak freeze on load.

- [ ] Add imports at the top of `AppContext.tsx`:

```typescript
import type { AchievementRecord } from '../types/achievements';
import { buildInitialAchievements } from '../types/achievements';
import { calcSessionXP, calcFlashcardXP, TOPIC_COMPLETE_XP, DAILY_GOAL_XP, levelFromTotalXP } from '../services/xp';
import { checkAchievements } from '../services/achievementChecker';
import { apiUpdateGamification, apiUpdateStreakFull } from '../services/api';
```

- [ ] Add new fields to `AppContextValue` interface (after `flashcards`):

```typescript
xp: number;
level: number;
bestStreak: number;
streakFreezes: number;
achievements: AchievementRecord[];
weeklyGoalHours: number;
awardXP: (amount: number) => void;
awardFlashcardXP: (count: number) => void;
awardTopicXP: () => void;
```

- [ ] Add state variables inside `AppProvider` (after `flashcards` state):

```typescript
const [xp, setXp] = useState<number>(0);
const [level, setLevel] = useState<number>(1);
const [bestStreak, setBestStreak] = useState<number>(0);
const [streakFreezes, setStreakFreezes] = useState<number>(0);
const [achievements, setAchievements] = useState<AchievementRecord[]>([]);
const [weeklyGoalHours, setWeeklyGoalHoursState] = useState<number>(10);
// track total flashcards reviewed and topics completed for achievement checker
const [totalFlashcardsReviewed, setTotalFlashcardsReviewed] = useState<number>(0);
const [totalTopicsCompleted, setTotalTopicsCompleted] = useState<number>(0);
```

- [ ] Update `defaultSettings` to include `weeklyGoalHours`:

```typescript
const defaultSettings: AppSettings = {
  darkMode: false,
  remindersEnabled: false,
  reminderMinutesBefore: 15,
  pomodoroWorkMinutes: 25,
  pomodoroBreakMinutes: 5,
  pomodoroLongBreakMinutes: 15,
  pomodorosBeforeLongBreak: 4,
  weeklyGoalHours: 10,
};
```

- [ ] In the `apiGetUserData` `.then()` block, load the new fields. After `setLastSessionDate(lastDate);` add:

```typescript
setXp(data.xp ?? 0);
setLevel(data.level ?? 1);
setBestStreak(data.best_streak ?? 0);
setStreakFreezes(data.streak_freezes ?? 0);
setAchievements(data.achievements?.length ? data.achievements : buildInitialAchievements());
setWeeklyGoalHoursState(data.weekly_goal_hours ?? 10);

// Compute total flashcards reviewed and topics completed from sessions/profile
const flashcardReviewedCount = (data.flashcards ?? []).reduce((sum: number, c: { interval: number }) => sum + (c.interval > 0 ? 1 : 0), 0);
setTotalFlashcardsReviewed(flashcardReviewedCount);
```

- [ ] **Streak freeze logic** — update the streak calculation block. Replace the existing streak adjustment code:

```typescript
// Existing:
const adjustedStreak =
  lastDate &&
  Math.floor((Date.now() - new Date(lastDate).getTime()) / 86_400_000) > 1
    ? 0
    : rawStreak;
setStreak(adjustedStreak);
setLastSessionDate(lastDate);
```

With:

```typescript
const daysMissed = lastDate
  ? Math.floor((Date.now() - new Date(lastDate + 'T12:00:00').getTime()) / 86_400_000)
  : 0;

let adjustedStreak = rawStreak;
let adjustedFreezes = data.streak_freezes ?? 0;
const rawBest = data.best_streak ?? 0;

if (daysMissed > 1) {
  // Each missed day consumes one freeze; extra missed days reset streak
  const freezesToUse = Math.min(adjustedFreezes, daysMissed - 1);
  adjustedFreezes -= freezesToUse;
  const unprotectedDays = (daysMissed - 1) - freezesToUse;
  if (unprotectedDays > 0) adjustedStreak = 0;
}

setStreak(adjustedStreak);
setLastSessionDate(lastDate);
setStreakFreezes(adjustedFreezes);
setBestStreak(rawBest);
```

- [ ] Add a centralized `awardXP` helper and an internal `runAchievementCheck` after the `dismissMissed` callback. Place these before the Notes CRUD section:

```typescript
// Internal helper: run achievement check and persist if anything changed
const runAchievementCheck = useCallback((
  newSessions: TrackedSession[],
  newStreak: number,
  newLevel: number,
  newAchievements: AchievementRecord[],
  latestSessionHour?: number,
  newTotalFlashcards?: number,
  newTotalTopics?: number,
) => {
  const { updated, newlyUnlocked } = checkAchievements({
    sessions: newSessions,
    streak: newStreak,
    level: newLevel,
    existing: newAchievements,
    totalFlashcardsReviewed: newTotalFlashcards ?? totalFlashcardsReviewed,
    totalTopicsCompleted: newTotalTopics ?? totalTopicsCompleted,
    latestSessionHour,
  });

  if (newlyUnlocked.length > 0) {
    setAchievements(updated);
    // Achievement toast is triggered by watching for newly unlocked in component
    // We store the latest unlocked IDs in a ref-like state for HomePage to consume
    setLastUnlockedAchievements(newlyUnlocked);
    apiUpdateGamification(xp, level, updated).catch(console.error);
  } else if (updated.some((u, i) => u.progress !== newAchievements[i]?.progress)) {
    setAchievements(updated);
    apiUpdateGamification(xp, level, updated).catch(console.error);
  }
}, [totalFlashcardsReviewed, totalTopicsCompleted, xp, level]);
```

  > Note: We need a `lastUnlockedAchievements` state for the toast. Add it:

```typescript
const [lastUnlockedAchievements, setLastUnlockedAchievements] = useState<string[]>([]);
```

  Add `lastUnlockedAchievements` and a `clearUnlockedAchievements` to the context value so `HomePage` can display and clear toasts.

- [ ] Add `awardXP` callback:

```typescript
const awardXP = useCallback((amount: number) => {
  setXp((prevXp) => {
    const newXp = prevXp + amount;
    const newLevel = levelFromTotalXP(newXp);
    setLevel(newLevel);
    apiUpdateGamification(newXp, newLevel, achievements).catch(console.error);
    return newXp;
  });
}, [achievements]);

const awardFlashcardXP = useCallback((count: number) => {
  const amount = calcFlashcardXP(count);
  setTotalFlashcardsReviewed((prev) => prev + count);
  awardXP(amount);
}, [awardXP]);

const awardTopicXP = useCallback(() => {
  setTotalTopicsCompleted((prev) => prev + 1);
  awardXP(TOPIC_COMPLETE_XP);
}, [awardXP]);
```

- [ ] **Update `addSession`** to award XP and check achievements:

```typescript
const addSession = useCallback(
  (session: TrackedSession) => {
    setSessionsState((prev) => {
      const updated = [...prev, session];

      // Award XP
      const xpAmount = calcSessionXP(session);
      setXp((prevXp) => {
        const newXp = prevXp + xpAmount;
        const newLevel = levelFromTotalXP(newXp);
        setLevel(newLevel);
        apiUpdateGamification(newXp, newLevel, achievements).catch(console.error);
        return newXp;
      });

      apiAddSession(session).catch(console.error);
      return updated;
    });

    const today = new Date().toISOString().split('T')[0];
    if (lastSessionDate !== today) {
      const newStreak = lastSessionDate ? streak + 1 : 1;
      const newBest = Math.max(bestStreak, newStreak);
      // Award freeze every 7-day multiple
      const newFreezes = newStreak % 7 === 0 ? Math.min(streakFreezes + 1, 2) : streakFreezes;
      setStreak(newStreak);
      setBestStreak(newBest);
      setStreakFreezes(newFreezes);
      setLastSessionDate(today);
      apiUpdateStreakFull(newStreak, today, newFreezes, newBest).catch(console.error);
    }
  },
  [streak, lastSessionDate, bestStreak, streakFreezes, achievements],
);
```

- [ ] **Update `resetAll`** to reset gamification state:

```typescript
setXp(0);
setLevel(1);
setBestStreak(0);
setStreakFreezes(0);
setAchievements([]);
setLastUnlockedAchievements([]);
setTotalFlashcardsReviewed(0);
setTotalTopicsCompleted(0);
```

- [ ] Add all new values to the Provider `value` object:

```typescript
xp,
level,
bestStreak,
streakFreezes,
achievements,
weeklyGoalHours,
lastUnlockedAchievements,
awardXP,
awardFlashcardXP,
awardTopicXP,
clearUnlockedAchievements: () => setLastUnlockedAchievements([]),
```

- [ ] Run build + lint:

```bash
npm run build && npm run lint
```

  Fix any TypeScript errors (likely missing fields in the interface or Provider value).

- [ ] Commit:

```bash
git add src/context/AppContext.tsx
git commit -m "feat: add gamification state to AppContext (XP, levels, achievements, streak freeze)"
```

---

## Task 6: AchievementToast Component

**Files:**
- Create: `src/components/AchievementToast.tsx`

- [ ] Create an animated slide-in toast:

```tsx
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
```

- [ ] Run build:

```bash
npm run build
```

- [ ] Commit:

```bash
git add src/components/AchievementToast.tsx
git commit -m "feat: add AchievementToast slide-in notification component"
```

---

## Task 7: WeeklyGoalRing Component

**Files:**
- Create: `src/components/WeeklyGoalRing.tsx`

- [ ] Create the SVG ring component:

```tsx
interface WeeklyGoalRingProps {
  hoursStudied: number;
  goalHours: number;
}

export function WeeklyGoalRing({ hoursStudied, goalHours }: WeeklyGoalRingProps) {
  const pct = goalHours > 0 ? Math.min(hoursStudied / goalHours, 1) : 0;
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="4"
            className="text-gray-200 dark:text-gray-700" />
          <circle cx="32" cy="32" r={r} fill="none" stroke="#6C47FF" strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs font-bold text-app-dark dark:text-white leading-none">
            {hoursStudied.toFixed(1)}
          </span>
          <span className="text-xs text-gray-400 leading-none">h</span>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        / {goalHours}h goal
      </p>
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
git add src/components/WeeklyGoalRing.tsx
git commit -m "feat: add WeeklyGoalRing SVG progress component"
```

---

## Task 8: Wire Toast + Ring + Level Badge into HomePage

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] Add imports:

```tsx
import { AchievementToast } from '../components/AchievementToast';
import { WeeklyGoalRing } from '../components/WeeklyGoalRing';
import { xpProgressInLevel } from '../services/xp';
```

- [ ] Destructure new context values:

```tsx
const {
  profile, plan, streak, missedSessions, dismissMissed, addNote,
  xp, level, bestStreak, streakFreezes, weeklyGoalHours,
  lastUnlockedAchievements, clearUnlockedAchievements, sessions,
} = useApp();
```

- [ ] Add `toastQueue` state to show achievements one at a time:

```tsx
const [toastQueue, setToastQueue] = useState<string[]>([]);

// When new achievements unlock, push to queue
useEffect(() => {
  if (lastUnlockedAchievements.length > 0) {
    setToastQueue((q) => [...q, ...lastUnlockedAchievements]);
    clearUnlockedAchievements();
  }
}, [lastUnlockedAchievements, clearUnlockedAchievements]);
```

- [ ] Compute weekly stats (place before the return statement):

```tsx
const thisWeekStart = (() => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
})();
const weeklyHours = sessions
  .filter((s) => s.date >= thisWeekStart)
  .reduce((sum, s) => sum + s.duration, 0) / 60;

const { current: xpCurrent, needed: xpNeeded } = xpProgressInLevel(xp);
```

- [ ] **Update the header** to show level badge:

```tsx
{/* Header */}
<div className="flex items-center justify-between mb-6">
  <div>
    <p className="text-sm text-gray-500 dark:text-gray-400">Good {getGreeting()},</p>
    <div className="flex items-center gap-2">
      <h1 className="text-2xl font-bold text-app-dark dark:text-white">{profile.name}</h1>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary text-white">Lv {level}</span>
    </div>
    {profile.institution && (
      <p className="text-xs text-gray-400 mt-0.5">{profile.institution}{profile.semester ? ` — ${profile.semester}` : ''}</p>
    )}
  </div>
  <button
    onClick={() => navigate('/settings')}
    className="w-10 h-10 rounded-full bg-purple-bg dark:bg-gray-800 flex items-center justify-center"
  >
    <User size={18} className="text-primary" />
  </button>
</div>
```

- [ ] **Add stats row** (weekly goal ring + streak + streak freeze) after the header, before missed sessions alert:

```tsx
{/* Stats row */}
<div className="flex items-center gap-3 mb-4">
  <WeeklyGoalRing hoursStudied={weeklyHours} goalHours={weeklyGoalHours} />
  <div className="flex-1">
    {/* XP bar */}
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{xpCurrent} / {xpNeeded} XP</span>
        <button onClick={() => navigate('/achievements')} className="text-primary font-semibold">Achievements</button>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="h-2 rounded-full bg-primary transition-all duration-500"
          style={{ width: `${Math.round((xpCurrent / xpNeeded) * 100)}%` }}
        />
      </div>
    </div>
    {/* Streak */}
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1">
        <span className="text-lg">🔥</span>
        <span className="text-sm font-bold text-app-dark dark:text-white">{streak}</span>
        <span className="text-xs text-gray-400">streak</span>
      </div>
      {streakFreezes > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-base">🧊</span>
          <span className="text-xs font-semibold text-blue-400">×{streakFreezes}</span>
        </div>
      )}
      {bestStreak > streak && (
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">best: {bestStreak}</span>
        </div>
      )}
    </div>
  </div>
</div>
```

- [ ] **Add achievement toast rendering** at the top of the return (before the main div or at the end inside it):

```tsx
{/* Achievement toasts */}
{toastQueue.length > 0 && (
  <AchievementToast
    achievementId={toastQueue[0]}
    onDismiss={() => setToastQueue((q) => q.slice(1))}
  />
)}
```

- [ ] Run build + lint:

```bash
npm run build && npm run lint
```

- [ ] Commit:

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: add level badge, XP bar, weekly goal ring, streak freeze to HomePage"
```

---

## Task 9: AchievementsPage

**Files:**
- Create: `src/pages/AchievementsPage.tsx`
- Modify: `src/App.tsx`

- [ ] Create the achievements grid page:

```tsx
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
```

- [ ] Add route in `src/App.tsx`. Import `AchievementsPage` and add:

```tsx
import { AchievementsPage } from './pages/AchievementsPage';
// ...inside AuthenticatedApp Routes:
<Route path="/achievements" element={hasOnboarded ? <AchievementsPage /> : <Navigate to="/onboarding" replace />} />
```

- [ ] Run build + lint:

```bash
npm run build && npm run lint
```

- [ ] Commit:

```bash
git add src/pages/AchievementsPage.tsx src/App.tsx
git commit -m "feat: add AchievementsPage with progress grid and unlock status"
```

---

## Task 10: Weekly Goal Setting in SettingsPage

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] Destructure `weeklyGoalHours` from `useApp()`. Find the existing destructure line and add it.

- [ ] Add a weekly goal slider to the Preferences card, after the reminders section:

```tsx
{/* Weekly study goal */}
<div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
  <div className="flex justify-between mb-1">
    <span className="text-xs text-gray-500">Weekly study goal</span>
    <span className="text-xs font-semibold text-primary">{weeklyGoalHours}h</span>
  </div>
  <input
    type="range" min={1} max={40} step={1}
    value={weeklyGoalHours}
    onChange={(e) => updateSettings({ weeklyGoalHours: Number(e.target.value) })}
    className="w-full cursor-pointer"
    style={{ accentColor: '#6C47FF' }}
  />
  <div className="flex justify-between text-xs text-gray-400 mt-1">
    <span>1h</span><span>40h</span>
  </div>
</div>
```

  > Note: `updateSettings` already calls `apiSaveSettings` and updates AppContext state. Since `weeklyGoalHours` is now part of `AppSettings`, this will save to backend automatically. The `weeklyGoalHoursState` in AppContext needs to mirror this — update `AppContext.tsx` to sync `weeklyGoalHours` from `settings` rather than as a separate state. **Simpler approach:** store `weeklyGoalHours` in `AppSettings` (already added in Task 1) and remove the separate state — just read it from `settings.weeklyGoalHours`.

  **Revised approach for AppContext** — replace `weeklyGoalHoursState` and `setWeeklyGoalHoursState` with reading directly from `settings`. In the Provider value, expose `weeklyGoalHours: settings.weeklyGoalHours` instead of the separate state.

  Go back to `AppContext.tsx` and:
  1. Remove `const [weeklyGoalHours, setWeeklyGoalHoursState] = useState<number>(10);`
  2. Remove the `setWeeklyGoalHoursState(data.weekly_goal_hours ?? 10);` line in the load effect
  3. Change `weeklyGoalHours` in the Provider value to `weeklyGoalHours: settings.weeklyGoalHours`
  4. Update `defaultSettings.weeklyGoalHours` to `10` (already done in Task 5)

- [ ] Run build + lint:

```bash
npm run build && npm run lint
```

- [ ] Commit:

```bash
git add src/pages/SettingsPage.tsx src/context/AppContext.tsx
git commit -m "feat: add weekly goal slider to SettingsPage, simplify weeklyGoalHours to live in settings"
```

---

## Final Verification

- [ ] Run full build + lint:

```bash
cd frontend && npm run build && npm run lint
```

- [ ] Manual smoke test:
  1. Start backend: `cd backend && uvicorn main:app --reload --host 127.0.0.1 --port 8000`
  2. Start frontend: `cd frontend && npm run dev`
  3. Register/login (fresh DB) → complete onboarding
  4. Verify level badge, XP bar, weekly goal ring on HomePage
  5. Complete a session → XP increases, streak updates
  6. Navigate to `/achievements` → see all achievements with progress
  7. Open Settings → adjust weekly goal slider → ring updates on HomePage
  8. Verify streak freeze icon appears after a 7-day streak

- [ ] Final commit if any fixes:

```bash
git add -A
git commit -m "feat: Phase 3 complete — XP & levels, achievements, weekly goal ring, streak freeze"
```
