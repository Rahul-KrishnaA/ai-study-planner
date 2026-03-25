# Gemini API + PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace LM Studio (local LLM) with Google Gemini API (free tier) and add PWA support so the app can be installed on mobile devices.

**Architecture:** The backend already proxies LLM calls via `/lm/generate-plan` and `/lm/generate-insights`. We swap the `httpx` call from LM Studio's OpenAI-compatible endpoint to the Gemini REST API, using a server-side `GEMINI_API_KEY` env var. The frontend replaces the LM Studio URL settings with a simpler "AI Powered" indicator. For PWA, we add `vite-plugin-pwa` which auto-generates the service worker and manifest.

**Tech Stack:** Python/FastAPI, `google-generativeai` Python SDK, Vite + `vite-plugin-pwa`, React/TypeScript

---

## File Structure

### Backend Changes
- **Modify:** `backend/main.py` — Replace LM Studio proxy endpoints with Gemini API calls, add `/lm/test` health endpoint
- **Modify:** `backend/requirements.txt` — Add `google-generativeai`
- **Create:** `backend/.env.example` — Document required env vars

### Frontend Changes
- **Modify:** `frontend/vite.config.ts` — Add `vite-plugin-pwa` plugin
- **Create:** `frontend/public/icon-192.png` — PWA icon 192x192
- **Create:** `frontend/public/icon-512.png` — PWA icon 512x512
- **Modify:** `frontend/src/pages/SettingsPage.tsx` — Replace LM Studio URL section with Gemini status display
- **Modify:** `frontend/src/types/index.ts` — Remove `lmStudioUrl` from `AppSettings`
- **Modify:** `frontend/src/context/AppContext.tsx` — Remove `lmStudioUrl` default
- **Modify:** `frontend/src/services/lmstudio.ts` — Remove `lmStudioUrl` parameter passthrough
- **Modify:** `frontend/src/services/api.ts` — Remove `lm_studio_url` from API calls, make `API_BASE` configurable via env var
- **Modify:** `frontend/index.html` — Add manifest link and theme-color meta

---

### Task 1: Add Gemini SDK to Backend

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/.env.example`

- [ ] **Step 1: Add google-generativeai to requirements.txt**

Add `google-generativeai>=0.8.0` to `backend/requirements.txt`:

```
fastapi>=0.110.0
uvicorn[standard]>=0.27.0
sqlalchemy>=2.0.0
bcrypt>=4.0.0
python-jose[cryptography]>=3.3.0
python-multipart>=0.0.9
httpx>=0.27.0
google-generativeai>=0.8.0
python-dotenv>=1.0.0
```

- [ ] **Step 2: Create .env.example**

```
SECRET_KEY=change-me-in-production
GEMINI_API_KEY=your-gemini-api-key-here
```

- [ ] **Step 3: Install dependencies**

Run: `cd backend && pip install -r requirements.txt`
Expected: All packages install successfully including `google-generativeai`

- [ ] **Step 4: Commit**

```bash
git add backend/requirements.txt backend/.env.example
git commit -m "chore: add google-generativeai and python-dotenv dependencies"
```

---

### Task 2: Replace LM Studio with Gemini API in Backend

**Files:**
- Modify: `backend/main.py:1-10` (imports)
- Modify: `backend/main.py:96-112` (request schemas)
- Modify: `backend/main.py:304-418` (LM proxy endpoints)

- [ ] **Step 1: Add Gemini imports and config at top of main.py**

After the existing imports (line 10), add:

```python
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
```

After `app = FastAPI(...)` (line 25), add:

```python
# ─── Gemini AI setup ─────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
```

- [ ] **Step 2: Simplify request schemas — remove lm_studio_url**

In `LMGeneratePlanRequest` (around line 104), remove the `lm_studio_url` field:

```python
class LMGeneratePlanRequest(BaseModel):
    profile: dict
```

In `LMGenerateInsightsRequest` (around line 109), remove the `lm_studio_url` field:

```python
class LMGenerateInsightsRequest(BaseModel):
    profile: dict
    sessions: list
```

- [ ] **Step 3: Rewrite /lm/generate-plan endpoint**

Replace the entire `lm_generate_plan` function (lines 305-366) with:

```python
@app.post("/lm/generate-plan")
async def lm_generate_plan(
    req: LMGeneratePlanRequest,
    current_user: User = Depends(get_current_user),
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    profile = req.profile

    subject_list = ", ".join(
        f"{d['name']} (exam: {d['examDate']})" if d.get("examDate") else d["name"]
        for d in profile.get("subjectDetails", [])
    ) or ", ".join(profile.get("subjects", []))

    prompt = (
        f"Create a weekly study plan for {profile.get('name')} studying {profile.get('studyField')}.\n"
        f"Subjects with deadlines: {subject_list}.\n"
        f"Preferred time: {profile.get('preferredTime')}. Daily goal: {profile.get('dailyGoalHours')}h.\n"
        f"Institution: {profile.get('institution', 'not specified')}. Semester: {profile.get('semester', 'not specified')}.\n"
        "Colors to use per subject: #6C47FF, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #F4A261, #DDA0DD.\n"
        "Include all 7 days (Monday-Sunday). Prioritize subjects with closer exams. Generate 2-3 insights.\n\n"
        "Return ONLY valid JSON with this exact structure, no markdown, no explanation:\n"
        '{\n'
        '  "weeklySchedule": [{"day":"Monday","sessions":[{"id":"mon-0","subject":"string","chapter":"string","startTime":"HH:MM","endTime":"HH:MM","color":"#hex"}]}],\n'
        '  "insights": [{"type":"tip","title":"string","body":"string"}],\n'
        '  "subjectProgress": [{"subject":"string","percentDone":0}],\n'
        '  "generatedAt": "ISO string"\n'
        '}'
    )

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=4096,
            ),
        )

        content = response.text
        json_match = re.search(r"\{[\s\S]*\}", content)
        if not json_match:
            raise ValueError("No JSON in response")

        plan = json.loads(json_match.group())
        if not plan.get("weeklySchedule"):
            raise ValueError("Invalid plan structure")
        return plan

    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gemini API error: {e}")
```

- [ ] **Step 4: Rewrite /lm/generate-insights endpoint**

Replace the entire `lm_generate_insights` function (lines 369-418) with:

```python
@app.post("/lm/generate-insights")
async def lm_generate_insights(
    req: LMGenerateInsightsRequest,
    current_user: User = Depends(get_current_user),
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    profile = req.profile
    sessions = req.sessions

    total_hours = sum(s.get("duration", 0) for s in sessions) / 60
    subject_map: dict[str, float] = {}
    for s in sessions:
        subject_map[s["subject"]] = subject_map.get(s["subject"], 0) + s.get("duration", 0)

    prompt = (
        f"Student: {profile.get('name')}, studying {profile.get('studyField')}.\n"
        f"Total hours studied: {total_hours:.1f}. By subject: {', '.join(f'{s}: {(m/60):.1f}h' for s, m in subject_map.items())}.\n"
        f"Preferred time: {profile.get('preferredTime')}. Daily goal: {profile.get('dailyGoalHours')}h.\n"
        "Generate 3 actionable study insights.\n\n"
        "Return ONLY a valid JSON array, no markdown, no explanation:\n"
        '[{"type":"tip","title":"string","body":"string"}]'
    )

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=1024,
            ),
        )

        content = response.text
        json_match = re.search(r"\[[\s\S]*\]", content)
        if not json_match:
            raise ValueError("No JSON array in response")
        return json.loads(json_match.group())

    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gemini API error: {e}")
```

- [ ] **Step 5: Add a /lm/test endpoint for connectivity check**

Add after the insights endpoint:

```python
@app.get("/lm/test")
async def lm_test(current_user: User = Depends(get_current_user)):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content("Say 'ok'",
            generation_config=genai.types.GenerationConfig(max_output_tokens=10))
        return {"status": "connected", "model": "gemini-2.0-flash"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gemini API error: {e}")
```

- [ ] **Step 6: Test backend starts**

Run: `cd backend && GEMINI_API_KEY=test uvicorn main:app --reload --host 127.0.0.1 --port 8000`
Expected: Server starts without import errors. Endpoints are listed in the docs at `/docs`.

- [ ] **Step 7: Commit**

```bash
git add backend/main.py
git commit -m "feat: replace LM Studio with Gemini API for plan generation"
```

---

### Task 3: Update Frontend — Remove LM Studio URL Config

**Files:**
- Modify: `frontend/src/types/index.ts:93-98`
- Modify: `frontend/src/context/AppContext.tsx:32-37`
- Modify: `frontend/src/services/api.ts:168-187`
- Modify: `frontend/src/services/lmstudio.ts`
- Modify: `frontend/src/pages/SettingsPage.tsx`

- [ ] **Step 1: Remove lmStudioUrl from AppSettings type**

In `frontend/src/types/index.ts`, change the `AppSettings` interface:

```typescript
export interface AppSettings {
  darkMode: boolean;
  remindersEnabled: boolean;
  reminderMinutesBefore: number;
}
```

- [ ] **Step 2: Remove lmStudioUrl from default settings**

In `frontend/src/context/AppContext.tsx`, change `defaultSettings`:

```typescript
const defaultSettings: AppSettings = {
  darkMode: false,
  remindersEnabled: false,
  reminderMinutesBefore: 15,
};
```

- [ ] **Step 3: Remove lm_studio_url from API calls**

In `frontend/src/services/api.ts`, simplify the two LM functions:

```typescript
export async function apiGeneratePlan(
  profile: UserProfile,
): Promise<StudyPlan> {
  return request<StudyPlan>('/lm/generate-plan', {
    method: 'POST',
    body: JSON.stringify({ profile }),
  });
}

export async function apiGenerateInsights(
  profile: UserProfile,
  sessions: { subject: string; duration: number; date: string }[],
): Promise<{ type: string; title: string; body: string }[]> {
  return request('/lm/generate-insights', {
    method: 'POST',
    body: JSON.stringify({ profile, sessions }),
  });
}
```

Also add a new test function:

```typescript
export async function apiTestLmConnection(): Promise<{ status: string; model: string }> {
  return request('/lm/test');
}
```

- [ ] **Step 4: Simplify lmstudio.ts — remove URL parameter**

Replace `frontend/src/services/lmstudio.ts`:

```typescript
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
```

- [ ] **Step 5: Fix all callers of generateStudyPlan that pass lmStudioUrl**

Search for all calls to `generateStudyPlan` and `generateInsights` and remove the URL argument. Key locations:
- `SettingsPage.tsx` line 91: `generateStudyPlan(profile, settings.lmStudioUrl)` → `generateStudyPlan(profile)`
- Any onboarding page that calls `generateStudyPlan` with a URL param

- [ ] **Step 6: Update SettingsPage — replace LM Studio section with AI Status**

In `frontend/src/pages/SettingsPage.tsx`:

Remove state variables: `lmUrl`, `urlSaveStatus`, and function `handleSaveLmUrl`.

Replace the entire "LM Studio" Card (lines 181-206) with:

```tsx
{/* AI Engine */}
<Card className="mb-4">
  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">AI Engine</p>
  <div className="flex items-center gap-2 mb-2">
    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
    <span className="text-sm font-medium text-app-dark dark:text-white">Gemini 2.0 Flash</span>
  </div>
  <p className="text-xs text-gray-400">Powered by Google Gemini AI. Plan generation uses AI when available, with local fallback.</p>
  {profile && (
    <Button onClick={handleRegenerate} size="sm" className="mt-3" loading={regenerating} variant={regenStatus === 'success' ? 'secondary' : 'primary'}>
      {regenStatus === 'success' ? 'Plan Updated!' : regenStatus === 'error' ? 'Failed — Retry' : 'Regenerate Plan'}
    </Button>
  )}
</Card>
```

- [ ] **Step 7: Make API_BASE configurable via environment variable**

In `frontend/src/services/api.ts`, change line 3:

```typescript
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000';
```

- [ ] **Step 8: Build and fix type errors**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no TypeScript errors. Fix any remaining references to `lmStudioUrl`.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/
git commit -m "feat: replace LM Studio config with Gemini API integration"
```

---

### Task 4: Add PWA Support

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `frontend/index.html`
- Create: `frontend/public/icon-192.png`
- Create: `frontend/public/icon-512.png`

- [ ] **Step 1: Install vite-plugin-pwa**

Run: `cd frontend && npm install -D vite-plugin-pwa`

- [ ] **Step 2: Create PWA icons**

Create `frontend/public/` directory and generate simple SVG-based icons. We'll create a minimal purple "SP" icon:

Create `frontend/public/icon-192.png` and `frontend/public/icon-512.png` — use a simple canvas-generated PNG or an SVG favicon. The simplest approach: create an SVG and convert it, or use a solid purple square with "SP" text.

For now, create a simple SVG favicon at `frontend/public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#6C47FF"/>
  <text x="256" y="340" font-family="system-ui,sans-serif" font-size="260" font-weight="bold" fill="white" text-anchor="middle">SP</text>
</svg>
```

Then generate PNG icons from this SVG using a simple HTML canvas script, or use the SVG directly as the PWA icon (modern browsers support SVG icons in manifests).

- [ ] **Step 3: Configure vite-plugin-pwa in vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'AI Study Planner',
        short_name: 'StudyPlan',
        description: 'AI-powered study planner that creates personalized schedules',
        theme_color: '#6C47FF',
        background_color: '#F4F4F8',
        display: 'standalone',
        scope: '/ai-study-planner/',
        start_url: '/ai-study-planner/',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  base: '/ai-study-planner/',
})
```

- [ ] **Step 4: Update index.html with PWA meta tags**

Add to `<head>` section of `frontend/index.html`:

```html
<link rel="icon" type="image/svg+xml" href="/ai-study-planner/favicon.svg" />
<link rel="apple-touch-icon" href="/ai-study-planner/icon-192.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

- [ ] **Step 5: Generate PNG icons from SVG**

Use a quick Node script or the `sharp` library to generate PNGs from the SVG. Alternatively, manually create simple solid-color PNGs. The quickest approach:

```bash
cd frontend
npx sharp-cli -i public/favicon.svg -o public/icon-192.png resize 192 192
npx sharp-cli -i public/favicon.svg -o public/icon-512.png resize 512 512
```

If sharp-cli isn't available, create a small Node script:

```javascript
// scripts/generate-icons.js
const sharp = require('sharp');
const fs = require('fs');
const svg = fs.readFileSync('public/favicon.svg');
sharp(svg).resize(192, 192).png().toFile('public/icon-192.png');
sharp(svg).resize(512, 512).png().toFile('public/icon-512.png');
```

- [ ] **Step 6: Build and verify PWA**

Run: `cd frontend && npm run build`
Expected: Build succeeds. `dist/` should contain a `sw.js` (service worker) and `manifest.webmanifest`.

Verify: `ls frontend/dist/sw.js frontend/dist/manifest.webmanifest`

- [ ] **Step 7: Commit**

```bash
git add frontend/vite.config.ts frontend/index.html frontend/public/
git commit -m "feat: add PWA support with service worker and manifest"
```

---

### Task 5: Update CORS for Production Deployment

**Files:**
- Modify: `backend/main.py:27-33`

- [ ] **Step 1: Make CORS origins configurable**

Replace the hardcoded CORS config in `backend/main.py`:

```python
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else []

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

This keeps localhost working in dev, and allows adding production origins (like `https://yourusername.github.io`) via the `CORS_ORIGINS` env var.

- [ ] **Step 2: Update .env.example**

```
SECRET_KEY=change-me-in-production
GEMINI_API_KEY=your-gemini-api-key-here
CORS_ORIGINS=https://yourusername.github.io
```

- [ ] **Step 3: Commit**

```bash
git add backend/main.py backend/.env.example
git commit -m "feat: make CORS origins configurable for production deployment"
```

---

### Task 6: Final Build Verification

- [ ] **Step 1: Run frontend build**

Run: `cd frontend && npm run build`
Expected: Clean build with no errors.

- [ ] **Step 2: Run frontend lint**

Run: `cd frontend && npm run lint`
Expected: No warnings or errors.

- [ ] **Step 3: Verify backend starts**

Run: `cd backend && python -c "from main import app; print('OK')"`
Expected: Prints "OK" with no import errors.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build issues from Gemini + PWA migration"
```
