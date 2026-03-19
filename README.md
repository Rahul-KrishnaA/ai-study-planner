# AI Study Planner

A mobile-first AI-powered study schedule app built with React + Vite + TypeScript + Tailwind CSS.

## Features

- 4-step onboarding wizard
- AI-generated weekly study schedule via LM Studio
- Weekly timetable grid
- Subject tracking with progress bars
- Analytics with bar chart + AI insights
- Dark mode
- Fully offline after plan generation (uses localStorage)

## Getting Started

```bash
npm install
npm run dev
```

## LM Studio Setup

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Load any chat model
3. Go to **Local Server** tab and start the server (default port: 1234)
4. The app will call `http://localhost:1234/v1/chat/completions`
5. If LM Studio is offline, the app falls back to a mock plan automatically

You can change the LM Studio URL in **Settings** within the app.

## Deployment

### GitHub Pages

```bash
# In package.json, update the homepage field:
# "homepage": "https://<username>.github.io/ai-study-planner"

npm run deploy
```

### Vercel / Netlify

Push to GitHub and connect your repo — auto-deploys on every push. No extra config needed (HashRouter handles client-side routing).

## Tech Stack

- React 18 + Vite 5 + TypeScript
- Tailwind CSS (purple theme: `#6C47FF`)
- React Router v6 (HashRouter for static hosting)
- lucide-react icons
- localStorage for all persistence

## Project Structure

```
src/
  components/     # Button, Card, Input, ProgressBar, SubjectAvatar, BottomNav
  context/        # AppContext (global state + localStorage sync)
  pages/
    onboarding/   # WelcomePage, UserInfoPage, SubjectsPage, PreferencesPage
    HomePage.tsx
    TimetablePage.tsx
    SubjectsPage.tsx
    StatsPage.tsx
    SettingsPage.tsx
  services/       # lmstudio.ts (AI API calls + fallback)
  types/          # TypeScript interfaces
```
