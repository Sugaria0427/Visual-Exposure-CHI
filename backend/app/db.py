import os
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    event,
)
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import declarative_base, relationship

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DEFAULT_DB_PATH = DATA_DIR / "study_production.db"

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite+aiosqlite:///{DEFAULT_DB_PATH.as_posix()}",
)

# Configure engine with WAL mode for SQLite to handle concurrency
connect_args = {}
if "sqlite" in DATABASE_URL:
    connect_args = {"check_same_thread": False}

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args=connect_args,
    pool_pre_ping=True,
)

# Enable SQLite WAL and foreign keys
if "sqlite" in DATABASE_URL:
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")
        cursor.execute("PRAGMA synchronous=NORMAL;")
        cursor.execute("PRAGMA foreign_keys=ON;")
        cursor.close()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


class StudySessionModel(Base):
    __tablename__ = "study_sessions"

    session_id = Column(String(64), primary_key=True, index=True)
    token_hash = Column(String(64), nullable=False, index=True)
    record_id = Column(String(16), nullable=False)  # A, B, C, D
    record_version = Column(String(32), nullable=False)
    record_hash = Column(String(64), nullable=False)
    condition = Column(String(16), nullable=False)  # M, S, V
    cell_id = Column(String(32), nullable=False, index=True)  # A_M, B_S, etc.
    question_set_version = Column(String(32), nullable=False)
    ui_version = Column(String(32), nullable=False)
    environment = Column(String(16), default="prod")  # dev, pilot, prod
    material_mode = Column(String(16), default="validated")  # placeholder, validated
    
    current_step = Column(String(64), default="launch_received", nullable=False)
    status = Column(String(32), default="active", nullable=False)  # active, completed, abandoned, tech_failed
    
    # Checkpoints
    initial_media_completed = Column(Boolean, default=False, nullable=False)
    q1_pre_sufficiency = Column(String(32), nullable=True)
    q1_post_sufficiency = Column(String(32), nullable=True)
    completion_code = Column(String(32), nullable=True, index=True)
    
    assigned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    responses = relationship("StudyResponseModel", back_populates="session", cascade="all, delete-orphan")
    events = relationship("StudyEventModel", back_populates="session", cascade="all, delete-orphan")


class StudyResponseModel(Base):
    __tablename__ = "study_responses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), ForeignKey("study_sessions.session_id", ondelete="CASCADE"), nullable=False, index=True)
    phase = Column(String(16), nullable=False)  # pre, post
    question_id = Column(String(32), nullable=False)  # A01, D02, Q1, Q2, etc.
    field_id = Column(String(32), nullable=True)
    question_version = Column(String(32), nullable=False)
    
    # Ground truth reference metadata
    reference_scope = Column(String(32), nullable=False)  # media_scope, record_scope
    reference_value = Column(Text, nullable=True)
    reference_state = Column(String(32), nullable=True)  # audited, declared, unknown, etc.
    
    # Participant response & metrics
    response_value = Column(Text, nullable=True)
    is_match = Column(Integer, nullable=True)  # 1, 0, or null (for subjective items)
    reasonable_unknown = Column(Integer, nullable=True)  # 1 or 0
    unsupported_certainty = Column(Integer, nullable=True)  # 1 or 0
    underclaim = Column(Integer, nullable=True)  # 1 or 0
    confidence = Column(Integer, nullable=True)
    
    # Q1/Q2 & skip metadata
    q2_asked = Column(Integer, nullable=True)  # 1 or 0
    skip_reason = Column(String(64), nullable=True)  # q1_insufficient
    
    # Response telemetry
    response_time_ms = Column(Integer, nullable=True)
    
    # Extended secondary responses (JSON serialized)
    reason_codes_json = Column(Text, nullable=True)
    requested_conditions_json = Column(Text, nullable=True)
    simulated_action = Column(String(64), nullable=True)
    action_feasibility = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    session = relationship("StudySessionModel", back_populates="responses")

    __table_args__ = (
        Index("ix_session_phase_question", "session_id", "phase", "question_id"),
    )


class StudyEventModel(Base):
    __tablename__ = "study_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), ForeignKey("study_sessions.session_id", ondelete="CASCADE"), nullable=False, index=True)
    event_seq = Column(Integer, nullable=False)
    event_type = Column(String(64), nullable=False)  # prompt_shown, media_start, seek, tab_click, etc.
    phase = Column(String(32), nullable=False)
    payload_json = Column(Text, nullable=True)
    client_timestamp = Column(DateTime, nullable=True)
    server_timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    session = relationship("StudySessionModel", back_populates="events")

    __table_args__ = (
        Index("ix_session_event_seq", "session_id", "event_seq"),
    )


class CompletionCodeModel(Base):
    __tablename__ = "completion_codes"

    code = Column(String(32), primary_key=True, index=True)
    session_id = Column(String(64), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False)
    cell_id = Column(String(32), nullable=False)
    status = Column(String(32), default="issued", nullable=False)  # issued, verified, expired, revoked
    issued_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    verified_at = Column(DateTime, nullable=True)
    verifier_notes = Column(Text, nullable=True)


async def init_db():
    """Create tables if they do not exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
