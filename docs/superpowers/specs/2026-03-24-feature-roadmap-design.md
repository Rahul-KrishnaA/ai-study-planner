# AI Study Planner — Feature Roadmap Design Spec

**Date:** 2026-03-24
**Target audience:** University/college students preparing for exams
**App type:** Solo personal productivity tool (no social features)
**AI strategy:** AI as a helper — Gemini used sparingly (free tier limits), most features are non-AI

---

## Current State

The app already has: authentication, onboarding, AI-powered study plan generation (Gemini API + local fallback), weekly timetable, subject management, session tracking with timer, analytics/stats, dark mode, browser notifications, PWA (service worker + manifest + icons), day streaks, missed session auto-rescheduling, and exam date countdowns.

---

## Cross-Cutting: Database Migration Strategy

All phases add new JSON columns to the `user_data` table. Since SQLAlchemy only auto-creates missing tables (not columns), use this strategy:

- **For development:** Drop and recreate the `user_data` table (acceptable since this is a dev/personal project).
- **For production deployments:** Add `ALTER TABLE user_data ADD COLUMN <col> TEXT DEFAULT '[]'` statements in a migration script (`backend/migrate.py`) that runs on startup before table creation. Each phase documents which columns it adds.
- **Backend API contract:** Every new column must be added to: (1) the SQLAlchemy model in `models.py`, (2) the `GET /users/me/data` response in `main.py`, and (3) the `UserDataResponse` interface in `frontend/src/services/api.ts`. This is called out per-phase below.

## Cross-Cutting: Stable Subject IDs

Before Phase 1 begins, add a stable `id` (UUID) field to `SubjectDetail`. All new features (notes, flashcards, topics) will key by `subjectId` instead of `subjectName`, preventing data orphaning when a subject is renamed. Existing subjects get an auto-generated ID on first load (migration in AppContext).

---

## Phase 1: Study Tools (Core Workflow)

Features students will use every day. Heaviest phase — adds 3 new feature areas + new pages/routes.

**Backend changes required:** Add `notes_json` and `flashcards_json` columns to `user_data`. Update `GET /users/me/data` response and corresponding frontend API types.

### 1a. Pomodoro Timer

Enhance the existing session timer with proper Pomodoro technique.

- **Work/break cycles:** 25min work / 5min break (configurable in Settings)
- **Long break:** 15min after every 4 completed cycles
- **Visual countdown ring** with animated progress + audio alert on completion
- **Integration:** Start a Pomodoro for a scheduled session from the timetable
- **State persistence:** Timer state survives page navigation (store in context/localStorage)

**Session logging behavior:**
- A Pomodoro session is logged as a **single** `TrackedSession` when the user **completes or stops the entire Pomodoro block** (not per-cycle). The `pomodoroCount` field records how many cycles were completed.
- If the Pomodoro was started for a scheduled session, `plannedSessionId` is set and `completed` is `true` — this marks the planned session as done in missed-session detection.
- Pomodoro auto-logging does NOT create additional sessions alongside manual completion — it IS the completion mechanism. The existing manual "complete" button is replaced by the Pomodoro flow when Pomodoro mode is active.

**XP interaction (Phase 3):** XP is awarded per completed Pomodoro cycle (not per TrackedSession), tracked via `pomodoroCount`. Session-based XP (10 XP per 30 min) uses `duration` and does NOT double-count with Pomodoro XP. The XP system checks `pomodoroCount > 0` and uses Pomodoro XP formula instead of duration-based formula.

**Data model changes:**
- `AppSettings` gains: `pomodoroWorkMinutes` (default 25), `pomodoroBreakMinutes` (default 5), `pomodoroLongBreakMinutes` (default 15), `pomodorosBeforeLongBreak` (default 4)
- `TrackedSession` gains: `pomodoroCount` (number of completed cycles, 0 if not a Pomodoro session)

### 1b. Quick Notes

Simple per-subject note-taking.

- **Markdown-supported** text notes tied to a subject via `subjectId`
- **Access points:** Subject detail page, during an active session
- **Search/filter** notes by subject
- **CRUD:** Create, read, update, delete notes
- **Rename-safe:** Notes reference `subjectId` (stable UUID), not `subjectName`

**Data model changes:**
- New backend column: `notes_json` in `user_data` table (default `'[]'`)
- Note structure: `{ id: string, subjectId: string, title: string, content: string (markdown), createdAt: string, updatedAt: string }`

**UI:** New "Notes" tab within Subjects page. Floating "Add Note" button during active sessions.

### 1c. Flashcards

Create and review flashcards with spaced repetition.

- **Card creation:** Front (question) / Back (answer), organized by subject via `subjectId`
- **Review mode:** Flip animation, swipe or button to rate
- **Spaced repetition (SM-2 variant):**
  - **Again:** Reset interval to 0 (review again in same session). Set `easeFactor = max(1.3, easeFactor - 0.2)`
  - **Hard:** Set interval to 1 day. Set `easeFactor = max(1.3, easeFactor - 0.15)`
  - **Easy:** Set interval to `max(interval * easeFactor, 3)` days, capped at 30 days. Set `easeFactor = easeFactor + 0.15`
  - Initial `easeFactor`: 2.5. Initial `interval`: 0.
  - A card is "mastered" when `interval >= 21` days.
- **Review stats:** Cards due today, total mastered, total cards per subject
- **Navigation:** Flashcards are a **sub-page of Subjects** (route: `/subjects/flashcards` or `/subjects/flashcards/:subjectId`), NOT a new bottom nav item. This keeps the bottom nav at 5 items and avoids cramping on mobile. Accessible via a "Flashcards" button on the Subjects page.

**Data model changes:**
- New backend column: `flashcards_json` in `user_data` table (default `'[]'`)
- Flashcard structure: `{ id: string, subjectId: string, front: string, back: string, nextReviewDate: string (ISO), interval: number (days), easeFactor: number, createdAt: string }`

**UI:** Sub-page under Subjects with subject filter tabs, "Review Due" button, and card creation modal. Back button returns to Subjects list.

---

## Phase 2: Enhanced Planning & Organization

Better tools for managing what you're studying.

**Backend changes required:** No new columns (topics stored inside existing `profile_json` as part of `SubjectDetail`). Update `POST /lm/generate-plan` to accept topic data in the profile payload.

### 2a. Topic/Chapter Tracking

Break subjects into granular pieces.

- **Add topics/chapters** under each subject (e.g., "Physics -> Thermodynamics, Optics, Mechanics")
- **Status per topic:** "not started / in progress / completed"
- **Subject progress** now driven by topic completion percentage (instead of time-based estimation)
- **Session linking:** Study sessions can be linked to a specific topic
- **AI-aware plan generation:** When regenerating a plan, the frontend passes topic completion data as part of the profile to `POST /lm/generate-plan`. The backend Gemini prompt is updated to include: "The following topics are incomplete and should be prioritized: [list]". This requires modifying the existing endpoint's prompt template, NOT adding a new endpoint.

**Data model changes:**
- `SubjectDetail` gains: `topics: Topic[]`
- Topic structure: `{ id: string, name: string, status: 'not_started' | 'in_progress' | 'completed' }`
- `StudySession` gains: `topicId: string | null` (optional)
- `TrackedSession` gains: `topicName: string | null` (optional)

**UI:** Expandable topic list within each subject card on SubjectsPage. Topic selector dropdown when starting a session.

### 2b. Calendar View

Monthly calendar alongside the existing weekly timetable.

- **Monthly grid** showing study sessions as colored dots/blocks per day
- **Click a day** to see that day's detailed schedule
- **Heatmap effect:** Darker background = more study hours that day
- **Navigation:** Month prev/next arrows, "Today" button
- **Patterns at a glance:** Helps students see gaps and busy periods

**Date-mapping rule:** The weekly `StudyPlan` is a repeating template (keyed by day-of-week). The calendar view maps it to actual dates as follows:
- **Past dates:** Show data from `TrackedSession[]` (actual study history, keyed by `date` field)
- **Future dates:** Project the weekly template onto calendar dates by matching day-of-week names
- **Today:** Show both planned (from template) and completed (from tracked sessions)
- This means the calendar is a hybrid view: historical actuals + future projections from the repeating plan.

**UI:** Toggle on TimetablePage — "Week | Month" switch at the top.

**No new data model changes** — renders from existing `StudyPlan.weeklySchedule` (projected) and `TrackedSession[]` (historical).

### 2c. Export Study Plan

Let students share or print their plan.

- **PDF export:** Weekly timetable as a formatted PDF (using `html2canvas` + `jsPDF`)
- **Image export:** Timetable as PNG for sharing on WhatsApp/Instagram
- **JSON backup:** Export/import full plan data for backup/restore

**UI:** Export button on TimetablePage toolbar and in Settings.

**Dependencies:** `jspdf` and `html2canvas` npm packages.

---

## Phase 3: Gamification & Engagement

Make studying addictive (in a good way).

**Backend changes required:** Add `achievements_json` column, and add `weekly_goal_hours`, `streak_freezes`, `best_streak`, `xp`, `level` fields to `user_data`. Update `GET /users/me/data` and `PUT /users/me/streak` to include freeze logic.

### 3a. Achievements & Badges

Milestone-based rewards system.

- **Predefined achievements:**
  - "First Steps" — Complete first session *(no dependency)*
  - "Week Warrior" — 7-day streak *(no dependency)*
  - "Night Owl" — Study past 10pm *(no dependency)*
  - "Century" — 100 total hours studied *(no dependency)*
  - "Flash Master" — Review 100 flashcards *(requires Phase 1c)*
  - "Pomodoro Pro" — Complete 50 pomodoros *(requires Phase 1a)*
  - "Exam Ready" — Complete all topics for a subject *(requires Phase 2a — this achievement is registered in Phase 3 but only activatable after Phase 2a is implemented; check is skipped if topics feature is absent)*
  - "Consistent" — Hit weekly goal 4 weeks in a row *(requires Phase 3b)*
  - ~15-20 total achievements
- **Badge icons:** Simple SVG/emoji badges on a dedicated Achievements page
- **Toast notification** when an achievement unlocks
- **Progress tracking:** "5/7 days for streak badge" shown on achievement card
- **Graceful degradation:** Achievements that depend on unimplemented features show as "Coming Soon" with a lock icon

**Data model changes:**
- New backend column: `achievements_json` in `user_data` (default `'[]'`)
- Achievement structure: `{ id: string, unlockedAt: string | null, progress: number, target: number }`

**UI:** New Achievements page (accessible from HomePage card or Settings). Achievement toast component.

### 3b. Enhanced Streaks & Goals

Build on the existing streak system.

- **Weekly study goal:** Hours target (configurable in Settings) with progress ring on HomePage
- **Streak freeze:** Earn 1 freeze per 7-day streak, use it to protect a missed day (max 2 stored)
- **Best streak record** displayed alongside current streak
- **Weekly summary:** "You studied 12hrs this week, 3hrs more than last week!" — shown on Monday

**Streak freeze implementation:**
- `streak_freezes` stored in `user_data` alongside `streak` and `best_streak`
- On app load, when `AppContext` detects a missed day (gap > 1 day since `lastSessionDate`):
  1. Check `streak_freezes > 0`
  2. If yes: decrement `streak_freezes`, keep streak intact, persist via `PUT /users/me/streak` (updated to accept `{ streak, lastSessionDate, streakFreezes, bestStreak }`)
  3. If no: reset streak to 0 as currently implemented
- Freeze earned: when streak reaches a multiple of 7, award 1 freeze (capped at 2)

**Data model changes:**
- `user_data` gains: `weekly_goal_hours` (default 10), `streak_freezes` (default 0), `best_streak` (default 0)
- `PUT /users/me/streak` request body extended with `streakFreezes` and `bestStreak` fields

### 3c. XP & Levels

Light gamification layer — no leaderboards (solo app).

- **Earn XP for:**
  - Completing a session (non-Pomodoro): 10 XP per 30 min (based on `duration`)
  - Completing a Pomodoro session: 15 XP per completed cycle (based on `pomodoroCount`; session duration XP is NOT awarded — one or the other, never both)
  - Reviewing flashcards: 2 XP per card reviewed
  - Hitting daily goal: 25 XP bonus
  - Completing a topic: 50 XP
- **Level thresholds:** Level 1->2 at 100 XP, scaling curve (each level requires `floor(100 * 1.5^(level-1))` XP)
- **Level badge** on HomePage next to user name
- **Max level:** 50 (gives long-term goal)

**XP award logic:** Centralized in a `awardXP(amount)` function in AppContext. Called from: `addSession` (checks `pomodoroCount` to decide formula), flashcard review completion, topic status change to 'completed', and daily goal check. Each trigger calls `awardXP` exactly once — no stacking.

**Data model changes:**
- `user_data` gains: `xp` (default 0), `level` (default 1)

---

## Phase 4: PWA Enhancements & UX Polish

Make it feel like a native app.

**Backend changes required:** None for 4a/4b/4d. Phase 4c MVP uses client-side scheduling only; full push (VAPID) is a future enhancement beyond this spec.

### 4a. Offline Mode Improvements

The app already caches assets via service worker, but needs better offline data handling.

- **Offline action queue:** API calls made while offline are queued in localStorage and replayed when connectivity returns
- **Offline indicator:** Banner at top of screen when offline ("You're offline — changes will sync when you reconnect")
- **Graceful degradation:** All pages render from cached localStorage data; API failures are silent with retry queue

**Idempotency handling:**
- `PUT` endpoints (settings, profile, plan, streak) are naturally idempotent — safe to replay
- `POST /users/me/sessions` (append-only): The server must deduplicate by `TrackedSession.id`. Add a check in the backend endpoint: if a session with the same `id` already exists in `sessions_json`, skip the append. This makes replay safe.
- Queue replay: Process in FIFO order. On success, remove from queue. On failure (non-network error like 401), discard the item and notify the user.

**Implementation:**
- Wrap the API client (`api.ts`) with an offline-aware layer
- Use `navigator.onLine` + `online`/`offline` events
- Queue structure: `{ id: string, endpoint: string, method: string, body: object, timestamp: string }[]` in localStorage key `sp_offline_queue`

### 4b. PWA Install Experience

Custom install prompt and onboarding.

- **Intercept `beforeinstallprompt`** event for custom install banner
- **Show install banner** on first 3 visits, respect dismissal after that (track in localStorage)
- **Post-install welcome:** Tips for standalone mode ("You can now access Study Planner from your home screen!")

**UI:** Dismissable banner component at top of HomePage.

### 4c. Enhanced Notifications (Client-Side)

Improve the existing notification system without requiring a push server.

- **Session reminders via service worker:** Use `self.registration.showNotification()` in the service worker for more reliable display when app is backgrounded (but still running)
- **Same-day scheduling only:** Schedule notifications for today's remaining sessions on each app load. This is reliable and avoids the long-horizon timer problem.
- **Exam countdown alerts:** Triggered on app load — if an exam is 3 days or 1 day away, show a notification immediately. NOT scheduled via long timers.
- **Full push notifications (VAPID + backend):** Deferred to a future enhancement beyond this spec. Would require backend push endpoint, VAPID key generation, and subscription management.

**Note:** This is an incremental improvement over the current browser Notification API. The biggest win is exam countdown alerts on app load and more reliable same-day reminders.

### 4d. UX Polish

Small improvements that compound.

- **Swipe gestures:** On timetable, swipe left/right between days (using touch events)
- **Pull-to-refresh:** On mobile, pull down to refresh data from backend
- **Skeleton loading screens:** Replace spinners with content-shaped skeleton placeholders
- **Haptic feedback:** Vibration on timer completion and achievement unlock (`navigator.vibrate()`)
- **Page transitions:** Smooth fade/slide transitions between routes (CSS transitions or `framer-motion`)
- **Micro-animations:** Button press feedback, card hover effects, progress bar animations

---

## Phase 5: Nice-to-Haves

Finishing touches that round out the experience.

### 5a. Study Session Journal

Reflect after each session.

- **Post-session prompt:** "How did it go?" appears after completing/stopping a session
- **Rate difficulty:** 1-5 scale
- **Short note:** Free text reflection
- **Timeline view:** Journal entries visible in Stats page as a scrollable timeline
- **Insights:** Helps students identify what topics are hardest

**Data model changes:**
- `TrackedSession` gains: `difficulty: number | null`, `reflection: string | null`

**UI:** Modal after session completion. Timeline tab on StatsPage.

### 5b. Focus Mode

Distraction-free study environment.

- **Full-screen mode:** Only timer, current subject, and topic visible
- **Ambient sounds:** Rain, lo-fi beats, white noise, library ambience (small audio files hosted in public/)
- **Minimal UI:** Navigation and other elements hidden
- **Exit:** Long-press back button or swipe down

**UI:** "Focus" button on the active session timer. Dedicated full-screen overlay component.

**Dependencies:** 4-5 small audio loops (~500KB each, OGG format for compression).

### 5c. Data & Progress Reports

Shareable progress summaries.

- **Weekly/monthly PDF report:** Hours per subject, completion rates, streak, achievements
- **"Semester in Review"** summary generated at the end of exam period
- **Reuses** PDF export approach from Phase 2c (`jsPDF` + `html2canvas`)

**UI:** "Generate Report" button on StatsPage.

### 5d. Smart Suggestions (Light AI)

Minimal Gemini usage for targeted, high-value tips.

- **Skip detection:** "You've been skipping Physics — want to redistribute your plan?" (rule-based trigger detects 3+ missed sessions for a subject, Gemini formats a friendly nudge)
- **Pre-exam boost:** 3 days before an exam, suggest an intensified schedule for that subject (local scheduling logic, Gemini formats the suggestion text)
- **Fallback:** If API unavailable, show generic rule-based suggestions

**Rate limiting implementation:**
- Store `lastGeminiSuggestionTimestamp` in `user_data` (persisted via `PUT /users/me/settings` or a new field in `settings_json`)
- On app load, check if `Date.now() - lastGeminiSuggestionTimestamp > 3.5 days` (≈2 calls per week)
- If within cooldown: use cached last suggestion or show rule-based fallback
- If cooldown expired AND a trigger condition is met: make the API call and update timestamp
- Backend `/lm/generate-insights` already exists — reuse it with adjusted prompt

**UI:** Suggestion cards on HomePage (similar to existing AI insight card).

---

## Phase Dependency Summary

```
Phase 1 (Study Tools)         — independent, start here
  └─ Prerequisite: Add stable subject IDs (cross-cutting)

Phase 2 (Planning)            — 2a builds on Phase 1 session tracking
  └─ 2a modifies POST /lm/generate-plan prompt

Phase 3 (Gamification)        — depends on Phase 1 (Pomodoro XP, flashcard achievements)
  └─ "Exam Ready" achievement also depends on Phase 2a (gracefully hidden if 2a absent)
  └─ Phase 3b/3c depend on Phase 1a for Pomodoro-related features

Phase 4 (PWA/Polish)          — independent of feature phases, can overlap with Phase 3
  └─ 4a requires backend change for session deduplication

Phase 5 (Nice-to-Haves)       — depends on Phase 1-3 features existing
  └─ 5d requires rate-limit timestamp in settings
```

## Technical Notes

- **All new data** stored as JSON columns in the existing `user_data` table (keeps schema simple). See "Database Migration Strategy" above for how columns are added.
- **Frontend state** managed through the existing `AppContext` pattern — new state slices added as needed
- **Backend endpoint changes by phase:**
  - Phase 1: Add `notes_json`, `flashcards_json` columns. Update `GET /users/me/data`.
  - Phase 2: Update `POST /lm/generate-plan` prompt to accept topics.
  - Phase 3: Add `achievements_json` column + `weekly_goal_hours`, `streak_freezes`, `best_streak`, `xp`, `level` fields. Update `PUT /users/me/streak`.
  - Phase 4: Add session dedup check to `POST /users/me/sessions`.
  - Phase 5: Add `lastGeminiSuggestionTimestamp` to `settings_json`.
- **PWA changes** (Phase 4) require modifications to `vite.config.ts` PWA config
- **Package additions:** `jspdf`, `html2canvas` (Phase 2), optionally `framer-motion` (Phase 4d)
