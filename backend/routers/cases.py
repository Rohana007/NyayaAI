"""Cases router — case generation and law mappings."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.database import get_db, CaseSession, EvidenceItem, PerformanceScore
from ..models.schemas import CaseGenerateRequest, CaseResponse, LawMapping
from ..services.llm_service import LLMService
from ..services.rag_service import IndianLawRAG
from ..services.case_engine import CaseEngine
from .auth import verify_token

router = APIRouter(prefix="/cases", tags=["cases"])

llm = LLMService()
rag = IndianLawRAG()
engine = CaseEngine(llm, rag)

LAW_MAPPINGS = [
    {"old_law": "IPC Section 302", "new_law": "BNS Section 103", "title": "Murder"},
    {"old_law": "IPC Section 304", "new_law": "BNS Section 105", "title": "Culpable Homicide"},
    {"old_law": "IPC Section 375/376", "new_law": "BNS Section 63/64", "title": "Rape"},
    {"old_law": "IPC Section 378/379", "new_law": "BNS Section 303/304", "title": "Theft"},
    {"old_law": "IPC Section 415/420", "new_law": "BNS Section 316/318", "title": "Cheating"},
    {"old_law": "IPC Section 498A", "new_law": "BNS Section 85/86", "title": "Cruelty by Husband"},
    {"old_law": "IPC Section 503/506", "new_law": "BNS Section 351/352", "title": "Criminal Intimidation"},
    {"old_law": "IPC Section 441/447", "new_law": "BNS Section 329/333", "title": "Criminal Trespass"},
    {"old_law": "IPC Section 124A", "new_law": "BNS Section 150", "title": "Sedition"},
    {"old_law": "CrPC Section 154", "new_law": "BNSS Section 173", "title": "FIR"},
    {"old_law": "CrPC Section 161", "new_law": "BNSS Section 180", "title": "Police Examination"},
    {"old_law": "CrPC Section 164", "new_law": "BNSS Section 183", "title": "Magistrate Statement"},
    {"old_law": "CrPC Section 173", "new_law": "BNSS Section 193", "title": "Police Report"},
    {"old_law": "CrPC Section 436-450", "new_law": "BNSS Section 355-374", "title": "Bail Provisions"},
    {"old_law": "IEA Section 45", "new_law": "BSA Section 39", "title": "Expert Opinion"},
    {"old_law": "IEA Section 65B", "new_law": "BSA Section 63", "title": "Electronic Records"},
    {"old_law": "IEA Section 101", "new_law": "BSA Section 104", "title": "Burden of Proof"},
]


@router.post("/generate", response_model=CaseResponse)
async def generate_case(req: CaseGenerateRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Generate a new BNS/BNSS/BSA-compliant case and create a session."""
    # Extract user_id from JWT if present
    user_id = "anonymous"
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        try:
            user_id = verify_token(auth_header[7:])
        except Exception:
            pass

    try:
        case_data = await engine.generate_enriched_case(
            req.case_type, req.difficulty, req.court_level,
            req.complexity, req.custom_notes or ""
        )
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        raise HTTPException(status_code=500, detail=f"Case generation failed: {str(e)}\n{tb[-500:]}")

    session_id = str(uuid.uuid4())
    session = CaseSession(
        id=session_id,
        user_id=user_id,
        case_type=req.case_type,
        difficulty=req.difficulty,
        court_level=req.court_level,
        role=req.role,
        case_data=case_data,
        legal_framework="BNS_BNSS_BSA",
        status="active"
    )
    db.add(session)

    # Store evidence items
    for ev in case_data.get("evidence_items", []):
        item = EvidenceItem(
            id=str(uuid.uuid4()),
            session_id=session_id,
            title=ev.get("title", ""),
            content=ev.get("content", ""),
            evidence_type=ev.get("type", "document"),
            admissibility=ev.get("admissibility", "admissible"),
            admissibility_score=1.0 if ev.get("admissibility") == "admissible" else 0.5
        )
        db.add(item)

    await db.commit()

    return CaseResponse(
        session_id=session_id,
        difficulty=req.difficulty,
        role=req.role,
        legal_framework="BNS/BNSS/BSA",
        evidence_items=case_data.get("evidence_items", []),
        case_title=case_data.get("case_title", "Untitled Case"),
        case_type=case_data.get("case_type", req.case_type),
        court=case_data.get("court", req.court_level),
        year=case_data.get("year", "2025"),
        background=case_data.get("background", ""),
        charges=case_data.get("charges", []),
        facts=case_data.get("facts", []),
        prosecution_brief=case_data.get("prosecution_brief", ""),
        defense_brief=case_data.get("defense_brief", ""),
        key_witnesses=case_data.get("key_witnesses", []),
        legal_sections=case_data.get("legal_sections", []),
        estimated_duration=case_data.get("estimated_duration", "45 minutes"),
        learning_objectives=case_data.get("learning_objectives", []),
    )


@router.get("/law-mappings")
async def get_law_mappings():
    """Return IPC→BNS, CrPC→BNSS, IEA→BSA mapping table."""
    return {"mappings": LAW_MAPPINGS, "legal_framework": "BNS/BNSS/BSA"}


@router.get("/session/{session_id}")
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CaseSession).where(CaseSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": session.id, "case_data": session.case_data,
            "status": session.status, "legal_framework": session.legal_framework}


@router.get("/history/{user_id}")
async def get_session_history(user_id: str, db: AsyncSession = Depends(get_db)):
    """Return recent sessions with scores for a user."""
    sessions_result = await db.execute(
        select(CaseSession)
        .where(CaseSession.user_id == user_id)
        .order_by(CaseSession.created_at.desc())
        .limit(10)
    )
    sessions = sessions_result.scalars().all()

    # Fetch scores for each session
    history = []
    for s in sessions:
        score_result = await db.execute(
            select(PerformanceScore).where(PerformanceScore.session_id == s.id)
        )
        perf = score_result.scalar_one_or_none()
        history.append({
            "session_id": s.id,
            "case_title": s.case_data.get("case_title", "Untitled") if s.case_data else "Untitled",
            "case_type": s.case_type,
            "role": s.role,
            "difficulty": s.difficulty,
            "status": s.status,
            "score": perf.overall_score if perf else None,
            "grade": perf.grade if perf else None,
            "verdict": perf.verdict if perf else None,
            "bench_queries": perf.bench_queries_faced if perf else 0,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })
    return {"sessions": history}
