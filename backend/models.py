import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserData(Base):
    __tablename__ = "user_data"

    user_id = Column(String, primary_key=True)
    profile_json = Column(Text, nullable=True)
    plan_json = Column(Text, nullable=True)
    sessions_json = Column(Text, default="[]")
    settings_json = Column(Text, nullable=True)
    streak = Column(Integer, default=0)
    last_session_date = Column(String, nullable=True)
