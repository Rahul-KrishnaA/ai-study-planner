# AI Study Planner

A mobile-first, AI-powered study scheduling application built with React, TypeScript, and FastAPI. Generate a personalised weekly study plan, track your progress, and let the AI adapt to missed sessions automatically.

## Features

- **AI-generated study plans** via LM Studio (local LLM) with an offline fallback scheduler
- **4-step onboarding** — name, subjects, exam dates, and time preferences
- **Weekly timetable** with colour-coded subject blocks
- **Subject tracking** with per-subject progress bars
- **Analytics dashboard** with bar charts and AI insights
- **Automatic rescheduling** of missed sessions on every app load
- **Dark mode** toggle
- **Multi-user auth** with SHA-256 + salt password hashing (Web Crypto API)
- Fully offline after plan generation — all data stored in `localStorage`

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS |
| Backend | Python 3, FastAPI, SQLite |
| Routing | React Router v6 (HashRouter — required for GitHub Pages) |
| Icons | lucide-react |
| Persistence | localStorage (frontend), SQLite (backend) |

## Project Structure

```
ai-study-planner/
├── frontend/           # React + Vite + TypeScript app
│   └── src/
│       ├── components/ # Reusable UI components
│       ├── context/    # AppContext — global state & localStorage sync
│       ├── pages/      # Route-level page components
│       │   └── onboarding/
│       ├── services/   # LM Studio API client + local scheduler fallback
│       └── types/      # TypeScript interfaces & storage key helpers
├── backend/            # FastAPI + SQLite server
│   ├── main.py
│   └── requirements.txt
└── start.bat           # Launches both servers (Windows)
```

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+

### Frontend

```bash
cd frontend
npm install
npm run dev        # Vite dev server with hot reload
```

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Or launch both together on Windows:

```bat
start.bat
```

## LM Studio Integration

The app calls a locally running LM Studio instance to generate study plans.

1. Download and install [LM Studio](https://lmstudio.ai/)
2. Load any instruction-following chat model
3. Open the **Local Server** tab, enable CORS, and start the server
4. The app defaults to `http://127.0.0.1:1240` — change this in **Settings** inside the app

If LM Studio is unreachable, the app falls back to a built-in scheduler that distributes sessions by exam-date priority and preferred study window.

## Deployment

### GitHub Pages

```bash
cd frontend
# Ensure package.json has: "homepage": "https://<username>.github.io/ai-study-planner"
npm run deploy
```

### Vercel / Netlify

Connect the repository and set the **root directory** to `frontend/`. No additional configuration is required — `HashRouter` handles all client-side routing on static hosts.

## Available Scripts (frontend)

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Type-check (tsc) then bundle for production |
| `npm run lint` | ESLint with zero-warnings policy |
| `npm run preview` | Preview the production build locally |
| `npm run deploy` | Build and publish to GitHub Pages |

