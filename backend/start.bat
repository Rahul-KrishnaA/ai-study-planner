@echo off
cd /d "%~dp0"

:: Create venv if it doesn't exist
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ERROR: Python not found. Please install Python 3.11+ and add it to PATH.
        pause
        exit /b 1
    )
)

:: Install / sync dependencies into venv
echo Installing dependencies...
venv\Scripts\pip install -r requirements.txt --quiet

echo.
echo Starting backend on http://127.0.0.1:8000
echo Press Ctrl+C to stop.
echo.

:: Run uvicorn inside the venv
venv\Scripts\uvicorn main:app --reload --host 127.0.0.1 --port 8000
