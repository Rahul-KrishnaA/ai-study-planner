@echo off
cd /d "%~dp0"

if not exist node_modules (
    echo Installing dependencies...
    npm install
)

echo Starting AI Study Planner...
echo Open http://localhost:5173 in your browser
npm run dev
