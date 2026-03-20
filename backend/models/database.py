"""SQLAlchemy models for NyayaAI."""
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime,
    ForeignKey, Text, JSON, create_engine
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.ext.asyncio import AsyncAttrs, create_async_engine, async_sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./nyayaai.db")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(AsyncAttrs, DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    college = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("CaseSession", back_populates="user")
    scores = relationship("PerformanceScore", back_populates="user")
    badges = relationship("Badge", back_populates="user")

    def __repr__(self):
        return f"<User {self.email}>"


class CaseSession(Base):
    __tablename__ = "case_sessions"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    case_type = Column(String, nullable=False)
    difficulty = Column(String, nullable=False)
    court_level = Column(String, nullable=False, default="Sessions Court")
    role = Column(String, nullable=False, default="defence")
    case_data = Column(JSON, nullable=True)
    legal_framework = Column(String, default="BNS_BNSS_BSA")
    status = Column(String, default="active")  # active | concluded
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sessions")
    arguments = relationship("CourtArgument", back_populates="session")
    bench_queries = relationship("BenchQuery", back_populates="session")
    score = relationship("PerformanceScore", back_populates="session", uselist=False)

    def __repr__(self):
        return f"<CaseSession {self.id} {self.case_type}>"


class CourtArgument(Base):
    __tablename__ = "court_arguments"
    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("case_sessions.id"), nullable=False)
    speaker = Column(String, nullable=False)  # student | judge | opposing | system
    content = Column(Text, nullable=False)
    argument_type = Column(String, nullable=True)  # argue | rebuttal | motion | cite | examine
    bench_query_triggered = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    session = relationship("CaseSession", back_populates="arguments")

    def __repr__(self):
        return f"<CourtArgument {self.speaker} @ {self.timestamp}>"


class BenchQuery(Base):
    __tablename__ = "bench_queries"
    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("case_sessions.id"), nullable=False)
    argument_id = Column(String, ForeignKey("court_arguments.id"), nullable=True)
    query_text = Column(Text, nullable=False)
    query_type = Column(String, nullable=False)  # logical_inconsistency | missing_evidence | procedural_violation
    student_response = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)

    session = relationship("CaseSession", back_populates="bench_queries")

    def __repr__(self):
        return f"<BenchQuery {self.query_type} resolved={self.resolved_at is not None}>"


class EvidenceItem(Base):
    __tablename__ = "evidence_items"
    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("case_sessions.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=True)
    evidence_type = Column(String, nullable=False)  # fir | forensic | witness | cctv | medical | cdr
    admissibility = Column(String, default="admissible")  # admissible | contested | privileged
    admissibility_score = Column(Float, default=1.0)

    def __repr__(self):
        return f"<EvidenceItem {self.title}>"


class PerformanceScore(Base):
    __tablename__ = "performance_scores"
    id = Column(String, primary_key=True)
    session_id = Column(String, ForeignKey("case_sessions.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    legal_accuracy = Column(Float, default=0)
    argument_structure = Column(Float, default=0)
    evidence_usage = Column(Float, default=0)
    procedural_compliance = Column(Float, default=0)
    articulation = Column(Float, default=0)
    overall_score = Column(Float, default=0)
    grade = Column(String, nullable=True)
    verdict = Column(String, nullable=True)
    feedback = Column(JSON, nullable=True)
    citation_links = Column(JSON, nullable=True)
    bench_queries_faced = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("CaseSession", back_populates="score")
    user = relationship("User", back_populates="scores")

    def __repr__(self):
        return f"<PerformanceScore {self.overall_score} grade={self.grade}>"


class Badge(Base):
    __tablename__ = "badges"
    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    badge_name = Column(String, nullable=False)
    badge_description = Column(String, nullable=True)
    earned_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="badges")

    def __repr__(self):
        return f"<Badge {self.badge_name}>"


async def init_db():
    """Create all tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """Dependency for FastAPI routes."""
    async with AsyncSessionLocal() as session:
        yield session
