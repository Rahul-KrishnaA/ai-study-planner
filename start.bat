@echo off
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo Starting backend...
start "Backend" powershell -NoExit -NoProfile -ExecutionPolicy Bypass -Command ^
  "Set-Location '%BACKEND%'; if (-not (Test-Path venv)) { python -m venv venv }; venv\Scripts\pip install -r requirements.txt --quiet; Write-Host 'Backend running on http://0.0.0.0:8000'; venv\Scripts\uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo Starting frontend...
cd /d "%FRONTEND%"
if not exist node_modules (
    echo Installing frontend dependencies...
    npm install
)
echo Open http://localhost:5173 in your browser
npm run dev
