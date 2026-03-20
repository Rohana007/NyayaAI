"""Evaluation router — citation-linked scoring and skill radar."""
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..models.database import get_db, CaseSession, CourtArgument, PerformanceScore, BenchQuery, Badge
from ..models.schemas import EvaluationResponse, SkillRadarResponse
from ..services.case_engine import CaseEngine
from ..services.llm_service import LLMService
from ..services.rag_service import IndianLawRAG

router = APIRouter(prefix="/evaluation", tags=["evaluation"])

llm = LLMService()
rag = IndianLawRAG()
engine = CaseEngine(llm, rag)

BADGE_RULES = {
    "First Hearing": lambda s, u: True,  # Always on first session
    "Citation Master": lambda s, u: s.get("scores", {}).get("legal_accuracy", 0) >= 85,
    "Proceduralist": lambda s, u: s.get("scores", {}).get("procedural_compliance", 0) >= 90,
    "Iron Advocate": lambda s, u: u.get("difficulty") == "hard",
}


@router.post("/generate", response_model=EvaluationResponse)
async def generate_evaluation(session_id: str, db: AsyncSession = Depends(get_db)):
    """Generate citation-linked evaluation for a concluded session."""
    result = await db.execute(select(CaseSession).where(CaseSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get full conversation
    args_result = await db.execute(
        select(CourtArgument)
        .where(CourtArgument.session_id == session_id)
        .order_by(CourtArgument.timestamp)
    )
    arguments = args_result.scalars().all()
    conversation = [{"speaker": a.speaker, "content": a.content} for a in arguments]

    # Count bench queries faced
    bq_result = await db.execute(
        select(func.count(BenchQuery.id)).where(BenchQuery.session_id == session_id)
    )
    bench_queries_faced = bq_result.scalar() or 0

    # Generate citation-linked evaluation
    try:
        eval_data = await engine.get_citation_linked_evaluation(
            session.case_data, conversation, session.role
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")

    eval_data["bench_queries_faced"] = bench_queries_faced

    # Derive improvement_tips from next_steps / feedback if not present
    if not eval_data.get("improvement_tips"):
        tips = []
        for fp in eval_data.get("feedback_points", []):
            if fp.get("type") != "strength":
                tips.append(fp.get("point", ""))
        if not tips:
            tips = eval_data.get("next_steps", [])[:3]
        eval_data["improvement_tips"] = tips[:3] or [
            "Review your BNS/BNSS/BSA citations.",
            "Work on argument structure and clarity.",
            "Practice cross-examination technique.",
        ]

    # Derive badge from score
    if not eval_data.get("badge"):
        score = eval_data.get("overall_score", 0)
        eval_data["badge"] = (
            "⚖ Distinguished Advocate" if score >= 85 else
            "📜 Competent Counsel" if score >= 65 else
            "🎓 Aspiring Jurist"
        )

    # Save to DB
    score_id = str(uuid.uuid4())
    scores = eval_data.get("scores", {})
    perf = PerformanceScore(
        id=score_id,
        session_id=session_id,
        user_id=session.user_id,
        legal_accuracy=scores.get("legal_accuracy", 0),
        argument_structure=scores.get("argument_structure", 0),
        evidence_usage=scores.get("evidence_usage", 0),
        procedural_compliance=scores.get("procedural_compliance", 0),
        articulation=scores.get("articulation", 0),
        overall_score=eval_data.get("overall_score", 0),
        grade=eval_data.get("grade"),
        verdict=eval_data.get("verdict"),
        feedback=eval_data,
        citation_links=eval_data.get("strengths", []) + eval_data.get("weaknesses", []),
        bench_queries_faced=bench_queries_faced
    )
    db.add(perf)

    # Award badges
    await _award_badges(session, eval_data, db)
    await db.commit()

    return EvaluationResponse(
        session_id=session_id,
        legal_framework="BNS/BNSS/BSA",
        bench_queries_faced=bench_queries_faced,
        **{k: v for k, v in eval_data.items() if k != "bench_queries_faced"}
    )


@router.get("/{session_id}", response_model=EvaluationResponse)
async def get_evaluation(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PerformanceScore).where(PerformanceScore.session_id == session_id)
    )
    perf = result.scalar_one_or_none()
    if not perf:
        raise HTTPException(status_code=404, detail="Evaluation not found. Generate it first.")
    data = perf.feedback or {}
    return EvaluationResponse(
        session_id=session_id,
        legal_framework="BNS/BNSS/BSA",
        bench_queries_faced=perf.bench_queries_faced,
        **{k: v for k, v in data.items() if k != "bench_queries_faced"}
    )


@router.get("/user/{user_id}/skill-radar", response_model=SkillRadarResponse)
async def get_skill_radar(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PerformanceScore).where(PerformanceScore.user_id == user_id)
    )
    scores = result.scalars().all()
    if not scores:
        return SkillRadarResponse(
            user_id=user_id, sessions_count=0,
            avg_scores={"legal_accuracy": 0, "argument_structure": 0,
                        "evidence_usage": 0, "procedural_compliance": 0, "articulation": 0},
            bench_queries_avg=0, improvement_trend=[]
        )
    n = len(scores)
    avg = {
        "legal_accuracy": sum(s.legal_accuracy for s in scores) / n,
        "argument_structure": sum(s.argument_structure for s in scores) / n,
        "evidence_usage": sum(s.evidence_usage for s in scores) / n,
        "procedural_compliance": sum(s.procedural_compliance for s in scores) / n,
        "articulation": sum(s.articulation for s in scores) / n,
    }
    bq_avg = sum(s.bench_queries_faced for s in scores) / n
    trend = [{"session": i + 1, "score": s.overall_score,
               "date": s.created_at.isoformat()} for i, s in enumerate(scores[-10:])]
    return SkillRadarResponse(
        user_id=user_id, sessions_count=n,
        avg_scores=avg, bench_queries_avg=bq_avg, improvement_trend=trend
    )


async def _award_badges(session: CaseSession, eval_data: dict, db: AsyncSession):
    """Check and award badges based on performance."""
    badges_to_award = []
    scores = eval_data.get("scores", {})

    if scores.get("legal_accuracy", 0) >= 85:
        badges_to_award.append(("Citation Master", "Cited 10+ correct BNS/BNSS/BSA sections"))
    if scores.get("procedural_compliance", 0) >= 90:
        badges_to_award.append(("Proceduralist", "Zero procedural errors in session"))
    if session.difficulty == "hard":
        badges_to_award.append(("Iron Advocate", "Completed a Hard difficulty session"))
    if session.court_level == "Supreme Court":
        badges_to_award.append(("Full Bench", "Argued before Supreme Court level"))

    for name, desc in badges_to_award:
        db.add(Badge(
            id=str(uuid.uuid4()),
            user_id=session.user_id,
            badge_name=name,
            badge_description=desc
        ))
