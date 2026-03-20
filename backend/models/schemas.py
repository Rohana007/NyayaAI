"""Pydantic schemas for NyayaAI API."""
from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime


# ── AUTH ──
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    college: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    college: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── CASES ──
class CaseGenerateRequest(BaseModel):
    case_type: str = "murder"
    court_level: str = "Sessions Court"
    complexity: str = "moderate"
    role: str = "defence"
    difficulty: str = "medium"
    custom_notes: Optional[str] = None


class LegalSection(BaseModel):
    code: str
    section: str
    title: str
    text: Optional[str] = None


class KeyWitness(BaseModel):
    name: str
    role: str
    testimony_summary: str


class CaseResponse(BaseModel):
    session_id: str
    case_title: str
    case_type: str
    legal_framework: str = "BNS/BNSS/BSA"
    difficulty: str
    role: Optional[str] = "defence"
    court: str
    year: str
    background: str
    charges: List[dict]
    facts: List[str]
    prosecution_brief: str
    defense_brief: str
    key_witnesses: List[dict]
    legal_sections: List[dict]
    evidence_items: List[dict]
    estimated_duration: Optional[str] = "45 minutes"
    learning_objectives: Optional[List[str]] = []


class LawMapping(BaseModel):
    old_law: str
    new_law: str
    title: str


# ── COURTROOM ──
class ArgumentRequest(BaseModel):
    session_id: str
    content: str
    argument_type: str = "argue"  # argue | rebuttal | motion | cite | examine
    witness_name: Optional[str] = None


class ArgumentResponse(BaseModel):
    argument_id: str
    opposing_response: str
    judge_response: Optional[str]
    objection: Optional[dict]
    ruling: Optional[str]
    bench_query: Optional[dict]
    cited_laws: List[dict]
    scores_update: dict
    proceeding: str
    tactical_choices: Optional[dict] = None   # 14A: mid-round choice cards
    case_predictor: Optional[dict] = None     # 14B: live win probability


class CheckArgumentRequest(BaseModel):
    session_id: str
    partial_text: str
    current_phase: str = "main"


class CheckArgumentResponse(BaseModel):
    interrupt: bool
    bench_query: Optional[str] = None
    query_id: Optional[str] = None
    query_type: Optional[str] = None
    input_locked: bool = False


class BenchQueryResponseRequest(BaseModel):
    query_id: str
    response_text: str


class BenchQueryResponseResult(BaseModel):
    judge_acknowledgment: str
    can_continue: bool
    input_unlocked: bool = True


class WitnessCallRequest(BaseModel):
    session_id: str
    witness_name: str
    examination_type: str = "direct"  # direct | cross | re-examination


class WitnessResponse(BaseModel):
    witness_name: str
    answer: str
    demeanor: str
    can_be_impeached: bool


class ObjectionRequest(BaseModel):
    session_id: str
    objection_type: str
    context: Optional[str] = None


class ObjectionResponse(BaseModel):
    objection_type: str
    ruling: str  # Sustained | Overruled
    judge_reasoning: str
    bsa_section: Optional[str]
    score_impact: int


class ConcludeRequest(BaseModel):
    session_id: str


# ── EVALUATION ──
class CitationLink(BaseModel):
    law: str
    section: str
    title: str
    relevant_text: str
    why_relevant: str
    replaces: Optional[str] = None


class FeedbackPoint(BaseModel):
    point: str
    citation: CitationLink


class EvaluationResponse(BaseModel):
    session_id: str
    scores: dict
    overall_score: float
    grade: str
    verdict: str
    verdict_reasoning: str
    strengths: Optional[List[Any]] = []
    weaknesses: Optional[List[Any]] = []
    missed_arguments: Optional[List[Any]] = []
    better_responses: Optional[List[dict]] = []
    feedback_points: Optional[List[Any]] = []
    bench_queries_faced: int
    next_steps: Optional[List[str]] = []
    improvement_tips: Optional[List[str]] = []
    badge: Optional[str] = None
    bias_audit: Optional[dict] = None
    legal_framework: str = "BNS/BNSS/BSA"


class SkillRadarResponse(BaseModel):
    user_id: str
    sessions_count: int
    avg_scores: dict
    bench_queries_avg: float
    improvement_trend: List[dict]


# ── LEADERBOARD ──
class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    name: str
    college: Optional[str]
    overall_score: float
    sessions_count: int
    badges_count: int
    bench_queries_avg: float


# ── EVIDENCE ──
class EvidenceResponse(BaseModel):
    id: str
    title: str
    content: Optional[str]
    evidence_type: str
    admissibility: str
    admissibility_score: float

    model_config = {"from_attributes": True}
