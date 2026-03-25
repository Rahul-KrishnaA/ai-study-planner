import json
import os
import re
import uuid
from typing import Optional

from google import genai
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth_utils import (
    create_access_token,
    decode_token,
    hash_password,
    verify_password,
)
from database import Base, engine, get_db
from models import User, UserData

from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

# ─── App setup ────────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Study Planner API")

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else []

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Gemini AI setup ─────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
gemini_client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

security = HTTPBearer()


# ─── Helpers ──────────────────────────────────────────────────────────────────
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    user_id = decode_token(credentials.credentials)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_or_create_user_data(user_id: str, db: Session) -> UserData:
    data = db.query(UserData).filter(UserData.user_id == user_id).first()
    if not data:
        data = UserData(user_id=user_id, sessions_json="[]", streak=0)
        db.add(data)
        db.commit()
        db.refresh(data)
    return data


# ─── Schemas ──────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UpdateNameRequest(BaseModel):
    name: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileRequest(BaseModel):
    profile: dict


class PlanRequest(BaseModel):
    plan: dict


class SessionRequest(BaseModel):
    session: dict


class SettingsRequest(BaseModel):
    settings: dict


class StreakRequest(BaseModel):
    streak: int
    last_session_date: Optional[str] = None


class NotesRequest(BaseModel):
    notes: list


class FlashcardsRequest(BaseModel):
    flashcards: list


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


class LMGeneratePlanRequest(BaseModel):
    profile: dict


class LMGenerateInsightsRequest(BaseModel):
    profile: dict
    sessions: list


# ─── Auth endpoints ───────────────────────────────────────────────────────────
@app.post("/auth/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()

    if not req.name.strip():
        raise HTTPException(status_code=400, detail={"field": "name", "message": "Name is required."})
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail={"field": "password", "message": "Password must be at least 6 characters."})
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail={"field": "email", "message": "An account with this email already exists."})

    user = User(
        id=str(uuid.uuid4()),
        name=req.name.strip(),
        email=email,
        password_hash=hash_password(req.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "token": create_access_token(user.id),
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at.isoformat(),
        },
    }


@app.post("/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(status_code=404, detail={"field": "email", "message": "No account found with this email."})
    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail={"field": "password", "message": "Incorrect password."})

    return {
        "token": create_access_token(user.id),
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "created_at": user.created_at.isoformat(),
        },
    }


@app.get("/auth/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "created_at": current_user.created_at.isoformat(),
    }


# ─── User endpoints ───────────────────────────────────────────────────────────
@app.put("/users/me/name")
def update_name(
    req: UpdateNameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.name = req.name.strip()
    db.commit()
    return {"ok": True}


@app.put("/users/me/password")
def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail={"field": "password", "message": "Current password is incorrect."})
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail={"field": "password", "message": "New password must be at least 6 characters."})
    current_user.password_hash = hash_password(req.new_password)
    db.commit()
    return {"ok": True}


@app.get("/users/me/data")
def get_user_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_or_create_user_data(current_user.id, db)
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


@app.put("/users/me/profile")
def save_profile(
    req: ProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_or_create_user_data(current_user.id, db)
    data.profile_json = json.dumps(req.profile)
    db.commit()
    return {"ok": True}


@app.put("/users/me/plan")
def save_plan(
    req: PlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_or_create_user_data(current_user.id, db)
    data.plan_json = json.dumps(req.plan)
    db.commit()
    return {"ok": True}


@app.post("/users/me/sessions")
def add_session(
    req: SessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_or_create_user_data(current_user.id, db)
    sessions = json.loads(data.sessions_json) if data.sessions_json else []
    sessions.append(req.session)
    data.sessions_json = json.dumps(sessions)
    db.commit()
    return {"ok": True}


@app.put("/users/me/settings")
def save_settings(
    req: SettingsRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_or_create_user_data(current_user.id, db)
    existing = json.loads(data.settings_json) if data.settings_json else {}
    existing.update(req.settings)
    data.settings_json = json.dumps(existing)
    db.commit()
    return {"ok": True}


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


@app.delete("/users/me/data")
def reset_user_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = db.query(UserData).filter(UserData.user_id == current_user.id).first()
    if data:
        data.profile_json = None
        data.plan_json = None
        data.sessions_json = "[]"
        data.settings_json = None
        data.streak = 0
        data.last_session_date = None
        data.notes_json = "[]"
        data.flashcards_json = "[]"
        data.xp = 0
        data.level = 1
        data.best_streak = 0
        data.streak_freezes = 0
        data.achievements_json = "[]"
        data.weekly_goal_hours = 10
        db.commit()
    return {"ok": True}


# ─── Gemini AI endpoints ─────────────────────────────────────────────────────
@app.post("/lm/generate-plan")
async def lm_generate_plan(
    req: LMGeneratePlanRequest,
    current_user: User = Depends(get_current_user),
):
    if not gemini_client:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")

    profile = req.profile

    subject_list = ", ".join(
        f"{d['name']} (exam: {d['examDate']})" if d.get("examDate") else d["name"]
        for d in profile.get("subjectDetails", [])
    ) or ", ".join(profile.get("subjects", []))

    # Build incomplete topics context for prompt
    incomplete_topics = []
    for detail in profile.get("subjectDetails", []):
        subject_name = detail.get("name", "")
        topics = detail.get("topics", [])
        pending = [t.get("name", "") for t in topics if t.get("status") != "completed" and t.get("name")]
        if pending:
            incomplete_topics.append(f"{subject_name}: {', '.join(pending)}")
    topics_context = (
        "\nIncomplete topics to prioritize in sessions:\n" + "\n".join(f"- {t}" for t in incomplete_topics)
        if incomplete_topics else ""
    )

    prompt = (
        f"Create a weekly study plan for {profile.get('name')} studying {profile.get('studyField')}.\n"
        f"Subjects with deadlines: {subject_list}.\n"
        f"Preferred time: {profile.get('preferredTime')}. Daily goal: {profile.get('dailyGoalHours')}h.\n"
        f"Institution: {profile.get('institution', 'not specified')}. Semester: {profile.get('semester', 'not specified')}."
        f"{topics_context}\n"
        "Colors to use per subject: #6C47FF, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #F4A261, #DDA0DD.\n"
        "Include all 7 days (Monday-Sunday). 2-3 sessions per day. Keep chapter names SHORT (max 5 words).\n"
        "Prioritize subjects with closer exams. Generate 2 insights.\n\n"
        "Return JSON with this structure:\n"
        '{"weeklySchedule":[{"day":"Monday","sessions":[{"id":"mon-0","subject":"Math","chapter":"Ch 1","startTime":"09:00","endTime":"10:00","color":"#6C47FF"}]}],'
        '"insights":[{"type":"tip","title":"short title","body":"short tip"}],'
        '"subjectProgress":[{"subject":"Math","percentDone":0}],'
        '"generatedAt":"2024-01-01T00:00:00Z"}'
    )

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "temperature": 0.7,
                "max_output_tokens": 8192,
                "response_mime_type": "application/json",
            },
        )

        plan = json.loads(response.text)
        if not plan.get("weeklySchedule"):
            raise ValueError("Invalid plan structure")
        return plan

    except Exception as e:
        print(f"[GEMINI ERROR] {e}")
        raise HTTPException(status_code=503, detail=f"Gemini API error: {e}")


@app.post("/lm/generate-insights")
async def lm_generate_insights(
    req: LMGenerateInsightsRequest,
    current_user: User = Depends(get_current_user),
):
    if not gemini_client:
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
        response = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "temperature": 0.7,
                "max_output_tokens": 1024,
                "response_mime_type": "application/json",
            },
        )

        return json.loads(response.text)

    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gemini API error: {e}")


@app.get("/lm/test")
async def lm_test(current_user: User = Depends(get_current_user)):
    if not gemini_client:
        raise HTTPException(status_code=503, detail="Gemini API key not configured")
    try:
        gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents="Say 'ok'",
            config={"max_output_tokens": 10},
        )
        return {"status": "connected", "model": "gemini-2.5-flash"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Gemini API error: {e}")


@app.get("/health")
def health():
    return {"status": "ok"}
