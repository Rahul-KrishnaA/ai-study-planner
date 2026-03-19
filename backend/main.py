import json
import re
import uuid
from typing import Optional

import httpx
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

# ─── App setup ────────────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Study Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


class LMGeneratePlanRequest(BaseModel):
    profile: dict
    lm_studio_url: str = "http://127.0.0.1:1240"


class LMGenerateInsightsRequest(BaseModel):
    profile: dict
    sessions: list
    lm_studio_url: str = "http://127.0.0.1:1240"


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


@app.put("/users/me/streak")
def update_streak(
    req: StreakRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_or_create_user_data(current_user.id, db)
    data.streak = req.streak
    data.last_session_date = req.last_session_date
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
        db.commit()
    return {"ok": True}


# ─── LM Studio proxy ──────────────────────────────────────────────────────────
@app.post("/lm/generate-plan")
async def lm_generate_plan(
    req: LMGeneratePlanRequest,
    current_user: User = Depends(get_current_user),
):
    profile = req.profile
    base_url = req.lm_studio_url.rstrip("/")

    subject_list = ", ".join(
        f"{d['name']} (exam: {d['examDate']})" if d.get("examDate") else d["name"]
        for d in profile.get("subjectDetails", [])
    ) or ", ".join(profile.get("subjects", []))

    system_prompt = (
        'You are an expert study planner AI. Generate a prioritized weekly study schedule in JSON format only. '
        'Subjects with closer exam dates must receive more sessions. No explanation, no markdown, just valid JSON:\n'
        '{\n'
        '  "weeklySchedule": [{"day":"Monday","sessions":[{"id":"mon-0","subject":"string","chapter":"string","startTime":"HH:MM","endTime":"HH:MM","color":"#hex"}]}],\n'
        '  "insights": [{"type":"tip","title":"string","body":"string"}],\n'
        '  "subjectProgress": [{"subject":"string","percentDone":0}],\n'
        '  "generatedAt": "ISO string"\n'
        '}'
    )

    user_prompt = (
        f"Create a weekly study plan for {profile.get('name')} studying {profile.get('studyField')}.\n"
        f"Subjects with deadlines: {subject_list}.\n"
        f"Preferred time: {profile.get('preferredTime')}. Daily goal: {profile.get('dailyGoalHours')}h.\n"
        f"Institution: {profile.get('institution', 'not specified')}. Semester: {profile.get('semester', 'not specified')}.\n"
        "Colors to use per subject: #6C47FF, #FF6B6B, #4ECDC4, #45B7D1, #96CEB4, #F4A261, #DDA0DD.\n"
        "Include all 7 days. Prioritize subjects with closer exams. Generate 2-3 insights. Return ONLY the JSON."
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{base_url}/v1/chat/completions",
                json={
                    "model": "local-model",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 4096,
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]

        json_match = re.search(r"\{[\s\S]*\}", content)
        if not json_match:
            raise ValueError("No JSON in response")

        plan = json.loads(json_match.group())
        if not plan.get("weeklySchedule"):
            raise ValueError("Invalid plan structure")
        return plan

    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LM Studio unavailable: {e}")


@app.post("/lm/generate-insights")
async def lm_generate_insights(
    req: LMGenerateInsightsRequest,
    current_user: User = Depends(get_current_user),
):
    profile = req.profile
    sessions = req.sessions
    base_url = req.lm_studio_url.rstrip("/")

    total_hours = sum(s.get("duration", 0) for s in sessions) / 60
    subject_map: dict[str, float] = {}
    for s in sessions:
        subject_map[s["subject"]] = subject_map.get(s["subject"], 0) + s.get("duration", 0)

    system_prompt = (
        "You are a study analytics AI. Generate 3 actionable insights as JSON array only:\n"
        '[{"type":"tip","title":"string","body":"string"}]'
    )
    user_prompt = (
        f"Student: {profile.get('name')}, studying {profile.get('studyField')}.\n"
        f"Total hours: {total_hours:.1f}. By subject: {', '.join(f'{s}: {(m/60):.1f}h' for s, m in subject_map.items())}.\n"
        f"Preferred time: {profile.get('preferredTime')}. Daily goal: {profile.get('dailyGoalHours')}h.\n"
        "Return ONLY the JSON array."
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"{base_url}/v1/chat/completions",
                json={
                    "model": "local-model",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1024,
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"]

        json_match = re.search(r"\[[\s\S]*\]", content)
        if not json_match:
            raise ValueError("No JSON array")
        return json.loads(json_match.group())

    except Exception as e:
        raise HTTPException(status_code=503, detail=f"LM Studio unavailable: {e}")


@app.get("/health")
def health():
    return {"status": "ok"}
