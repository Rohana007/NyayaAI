"""Courtroom router — arguments, objections, witness, bench queries."""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.database import get_db, CaseSession, CourtArgument, BenchQuery
from ..models.schemas import (
    ArgumentRequest, ArgumentResponse,
    CheckArgumentRequest, CheckArgumentResponse,
    BenchQueryResponseRequest, BenchQueryResponseResult,
    WitnessCallRequest, WitnessResponse,
    ObjectionRequest, ObjectionResponse,
    ConcludeRequest
)
from ..services.llm_service import LLMService
from ..services.rag_service import IndianLawRAG
from ..services.case_engine import CaseEngine
from ..services.live_monitor import LiveArgumentMonitor
from ..services.judge_engine import get_engine, remove_engine, MAX_ROUNDS

router = APIRouter(prefix="/courtroom", tags=["courtroom"])

llm = LLMService()
rag = IndianLawRAG()
case_engine = CaseEngine(llm, rag)
monitor = LiveArgumentMonitor(llm, rag)

# In-memory partial text tracker per session
_last_partial: dict[str, str] = {}


def _get_archetype(session: CaseSession) -> str:
    """Extract judge archetype from case_data, default to Pragmatist."""
    if session.case_data and isinstance(session.case_data, dict):
        return session.case_data.get("judge_archetype", "Pragmatist")
    return "Pragmatist"


async def _get_session_or_404(session_id: str, db: AsyncSession) -> CaseSession:
    result = await db.execute(select(CaseSession).where(CaseSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


async def _get_history(session_id: str, db: AsyncSession) -> list:
    result = await db.execute(
        select(CourtArgument)
        .where(CourtArgument.session_id == session_id)
        .order_by(CourtArgument.timestamp)
    )
    args = result.scalars().all()
    return [{"speaker": a.speaker, "content": a.content} for a in args]


@router.post("/argue", response_model=ArgumentResponse)
async def argue(req: ArgumentRequest, db: AsyncSession = Depends(get_db)):
    """Submit an argument and get judge + opposing counsel responses."""
    session = await _get_session_or_404(req.session_id, db)
    archetype = _get_archetype(session)
    judge_engine = get_engine(req.session_id, session.difficulty, archetype)

    # 15B: block if session already concluded (round > MAX_ROUNDS)
    if judge_engine.session_concluded:
        raise HTTPException(status_code=400, detail={
            "error": "session_concluded",
            "message": "All 5 rounds are complete. The session has concluded."
        })

    if judge_engine.has_pending_query():
        raise HTTPException(status_code=400, detail={
            "error": "bench_query_pending",
            "message": "Please respond to the Judge's question before proceeding."
        })

    history = await _get_history(req.session_id, db)
    current_round = judge_engine.round
    current_phase = judge_engine.phase

    # Save student argument
    arg_id = str(uuid.uuid4())
    student_arg = CourtArgument(
        id=arg_id, session_id=req.session_id,
        speaker="student", content=req.content,
        argument_type=req.argument_type
    )
    db.add(student_arg)

    # Run judge + opposing counsel in parallel for speed
    import asyncio as _asyncio
    judge_task = _asyncio.create_task(
        case_engine.get_grounded_judge_response(
            session.case_data, history, req.content,
            session.role, session.difficulty,
            round_number=current_round,
            judge_archetype=archetype
        )
    )
    opp_task = _asyncio.create_task(
        llm.get_opposing_counsel_response(
            session.case_data, history, req.content, session.role,
            rag.search_relevant_laws(req.content, 3),
            round_number=current_round,
            argument_type=req.argument_type
        )
    )

    # Fallback defaults
    judge_data = {
        "judge_response": "Counsel, the Court has noted your submission. Please proceed.",
        "cited_laws": [], "proceeding": "continue", "bench_query": None
    }
    opp_response = "My Lord, the opposing counsel's argument lacks sufficient legal grounding under BNS provisions."

    try:
        judge_data = await judge_task
    except Exception as e:
        print(f"[WARN] Judge response failed: {e}")

    try:
        opp_response = await opp_task
    except Exception as e:
        print(f"[WARN] Opposing counsel response failed: {e}")

    # Run tactical choices + case predictor in parallel
    import asyncio as _asyncio2
    judge_resp_text = judge_data.get("judge_response", "")
    tactical_task = _asyncio2.create_task(
        llm.generate_tactical_choices(
            session.case_data, history, req.content, session.role,
            judge_resp_text, round_number=current_round
        )
    )
    predictor_task = _asyncio2.create_task(
        llm.predict_case_outcome(
            session.case_data, history, req.content, session.role, judge_resp_text
        )
    )

    tactical_choices = None
    case_predictor = None
    try:
        tactical_choices = await tactical_task
    except Exception as e:
        print(f"[WARN] Tactical choices failed: {e}")
    try:
        case_predictor = await predictor_task
    except Exception as e:
        print(f"[WARN] Case predictor failed: {e}")

    auto_objection = None
    import random
    # 15D: objection probability scales with aggression level
    obj_threshold = 0.10 + (judge_engine.aggression_level - 1) * 0.06  # 0.10 → 0.34
    if random.random() < obj_threshold and req.argument_type not in ("motion", "cite"):
        obj_types = ["Hearsay", "Relevance", "Speculation", "Leading Question"]
        auto_obj_type = random.choice(obj_types)
        try:
            obj_result = await llm.rule_on_objection(
                auto_obj_type, req.content, session.case_data, session.difficulty
            )
            auto_objection = {
                "type": auto_obj_type,
                "ruling": obj_result.get("ruling", "Overruled"),
                "reasoning": obj_result.get("judge_reasoning", ""),
            }
        except Exception:
            pass

    # Save judge response
    db.add(CourtArgument(
        id=str(uuid.uuid4()), session_id=req.session_id,
        speaker="judge", content=judge_data.get("judge_response", ""),
        bench_query_triggered=bool(judge_data.get("bench_query", {}) and
                                    judge_data["bench_query"].get("triggered"))
    ))

    # Save opposing response
    db.add(CourtArgument(
        id=str(uuid.uuid4()), session_id=req.session_id,
        speaker="opposing", content=opp_response
    ))

    # Handle bench query from judge response
    bench_query_payload = None
    bq = judge_data.get("bench_query")
    if bq and bq.get("triggered"):
        bq_id = str(uuid.uuid4())
        db.add(BenchQuery(
            id=bq_id, session_id=req.session_id, argument_id=arg_id,
            query_text=bq.get("query", ""), query_type=bq.get("reason", "logical_inconsistency")
        ))
        judge_engine.set_pending_query({"id": bq_id, "text": bq.get("query", "")})
        bench_query_payload = {"triggered": True, "query": bq.get("query"), "query_id": bq_id}

    # 15B: advance round AFTER processing
    judge_engine.advance_round()
    await db.commit()

    scores_update = _compute_score_delta(req.content, req.argument_type, case_predictor)

    return ArgumentResponse(
        argument_id=arg_id,
        opposing_response=opp_response,
        judge_response=judge_data.get("judge_response"),
        objection=auto_objection,
        ruling=judge_data.get("ruling"),
        bench_query=bench_query_payload,
        cited_laws=judge_data.get("cited_laws", []),
        scores_update=scores_update,
        proceeding=judge_data.get("proceeding", "continue"),
        tactical_choices=tactical_choices,
        case_predictor=case_predictor,
    )


@router.get("/opening-cards/{session_id}")
async def get_opening_cards(session_id: str, db: AsyncSession = Depends(get_db)):
    """15E: Return tactical cards before the first argument (round 1 opening)."""
    session = await _get_session_or_404(session_id, db)
    try:
        cards = await llm.generate_opening_tactical_choices(session.case_data, session.role)
        return cards
    except Exception as e:
        print(f"[WARN] Opening cards failed: {e}")
        # Phase-appropriate fallback
        return {
            "decision_prompt": "You are about to deliver your opening statement. Choose your approach:",
            "choices": [
                {"id": "A", "label": "Lead with the strongest BNS section", "hint": "Anchor your opening in statute — establishes legal authority immediately", "type": "aggressive"},
                {"id": "B", "label": "Challenge the prosecution's evidence first", "hint": "Attack admissibility under BSA before they build their case", "type": "defensive"},
                {"id": "C", "label": "Invoke procedural rights under BNSS", "hint": "Establish procedural compliance — protects your position throughout", "type": "procedural"},
            ]
        }


@router.post("/check-argument", response_model=CheckArgumentResponse)
async def check_argument(req: CheckArgumentRequest, db: AsyncSession = Depends(get_db)):
    """Agentic judge — scan in-progress argument for bench query trigger."""
    session = await _get_session_or_404(req.session_id, db)
    archetype = _get_archetype(session)
    judge_engine = get_engine(req.session_id, session.difficulty, archetype)

    if not judge_engine.is_agentic or not judge_engine.can_interrupt():
        return CheckArgumentResponse(interrupt=False)

    last_text = _last_partial.get(req.session_id, "")
    result = await monitor.check_argument(
        req.session_id, req.partial_text,
        session.case_data, req.current_phase, last_text
    )
    _last_partial[req.session_id] = req.partial_text

    if result.get("interrupt"):
        bq_id = str(uuid.uuid4())
        db.add(BenchQuery(
            id=bq_id, session_id=req.session_id,
            query_text=result.get("bench_query", ""),
            query_type=result.get("query_type", "logical_inconsistency")
        ))
        judge_engine.set_pending_query({"id": bq_id, "text": result.get("bench_query", "")})
        await db.commit()
        return CheckArgumentResponse(
            interrupt=True,
            bench_query=result.get("bench_query"),
            query_id=bq_id,
            query_type=result.get("query_type"),
            input_locked=True
        )
    return CheckArgumentResponse(interrupt=False)


@router.post("/respond-bench-query", response_model=BenchQueryResponseResult)
async def respond_bench_query(req: BenchQueryResponseRequest, db: AsyncSession = Depends(get_db)):
    """Student responds to judge's bench query."""
    result = await db.execute(select(BenchQuery).where(BenchQuery.id == req.query_id))
    bq = result.scalar_one_or_none()
    if not bq:
        raise HTTPException(status_code=404, detail="Bench query not found")

    ack = await monitor.resolve_bench_query(bq.query_text, req.response_text, {})
    bq.student_response = req.response_text
    bq.resolved_at = datetime.utcnow()

    # Find judge engine and clear pending query
    session_result = await db.execute(select(CaseSession).where(CaseSession.id == bq.session_id))
    session = session_result.scalar_one_or_none()
    if session:
        judge_engine = get_engine(bq.session_id, session.difficulty)
        judge_engine.clear_pending_query()

    await db.commit()
    return BenchQueryResponseResult(
        judge_acknowledgment=ack["judge_acknowledgment"],
        can_continue=ack["can_continue"],
        input_unlocked=True
    )


@router.post("/witness", response_model=WitnessResponse)
async def examine_witness(req: WitnessCallRequest, db: AsyncSession = Depends(get_db)):
    """Examine a witness — AI plays the witness in character."""
    session = await _get_session_or_404(req.session_id, db)
    case_data = session.case_data or {}

    # Find witness info from case data
    witness_info = {}
    for w in case_data.get("key_witnesses", []):
        if w.get("name", "").lower() == req.witness_name.lower():
            witness_info = w
            break

    result = await llm.get_witness_response(
        req.witness_name, witness_info, req.examination_type,
        req.examination_type, case_data
    )

    # Save to transcript
    db.add(CourtArgument(
        id=str(uuid.uuid4()), session_id=req.session_id,
        speaker="witness",
        content=f"[{req.witness_name}]: {result.get('answer', '')}",
        argument_type="examine"
    ))
    await db.commit()

    return WitnessResponse(
        witness_name=req.witness_name,
        answer=result.get("answer", ""),
        demeanor=result.get("demeanor", "calm"),
        can_be_impeached=result.get("impeachment_possible", False)
    )


@router.post("/objection", response_model=ObjectionResponse)
async def raise_objection(req: ObjectionRequest, db: AsyncSession = Depends(get_db)):
    """Raise an objection — judge rules on it."""
    session = await _get_session_or_404(req.session_id, db)
    archetype = _get_archetype(session)
    judge_engine = get_engine(req.session_id, session.difficulty, archetype)

    result = await llm.rule_on_objection(
        req.objection_type, req.context or "",
        session.case_data, session.difficulty
    )

    judge_engine.record_objection(req.objection_type, result.get("ruling", "Overruled"))

    db.add(CourtArgument(
        id=str(uuid.uuid4()), session_id=req.session_id,
        speaker="system",
        content=f"Objection ({req.objection_type}): {result.get('ruling')} — {result.get('judge_reasoning','')}"
    ))
    await db.commit()

    return ObjectionResponse(
        objection_type=req.objection_type,
        ruling=result.get("ruling", "Overruled"),
        judge_reasoning=result.get("judge_reasoning", ""),
        bsa_section=result.get("bsa_section"),
        score_impact=result.get("score_impact", 0)
    )


@router.post("/conclude")
async def conclude_session(req: ConcludeRequest, db: AsyncSession = Depends(get_db)):
    """Conclude the session and mark it for evaluation."""
    session = await _get_session_or_404(req.session_id, db)
    session.status = "concluded"
    remove_engine(req.session_id)
    await db.commit()
    return {"session_id": req.session_id, "status": "concluded",
            "legal_framework": "BNS/BNSS/BSA",
            "message": "Session concluded. Request evaluation at /api/v1/evaluation/generate"}


@router.get("/hint/{session_id}")
async def get_hint(session_id: str, db: AsyncSession = Depends(get_db)):
    """Easy mode hint — suggest next argument."""
    session = await _get_session_or_404(session_id, db)
    if session.difficulty != "easy":
        raise HTTPException(status_code=403, detail="Hints only available in Easy mode")
    history = await _get_history(session_id, db)
    hint = await llm.suggest_argument(session.case_data, history, session.role)
    return {"hint": hint}


@router.get("/suggest-arguments/{session_id}")
async def suggest_arguments(session_id: str, mode: str = "argue", db: AsyncSession = Depends(get_db)):
    """Return 3 ready-to-use argument options for the student (any difficulty)."""
    session = await _get_session_or_404(session_id, db)
    history = await _get_history(session_id, db)
    options = await llm.suggest_argument_options(session.case_data, history, session.role, mode)
    return {"options": options}


def _compute_score_delta(content: str, arg_type: str, case_predictor: dict | None = None) -> dict:
    """Score delta based on content quality + LLM predictor signal."""
    import re
    bns_refs = len(re.findall(r'BNS|BNSS|BSA', content, re.IGNORECASE))
    word_count = len(content.split())

    # Base deltas from heuristics
    base = {
        "logic":   4 if word_count > 60 else 2,
        "clarity": min(word_count // 20, 6),
        "proc":    5 if arg_type in ("motion", "cite") else 2,
        "cite":    min(bns_refs * 4, 14),
        "reb":     7 if arg_type == "rebuttal" else 2,
    }

    # Boost/penalise using LLM predictor momentum if available
    if case_predictor:
        momentum = case_predictor.get("momentum", "stable")
        prob = case_predictor.get("win_probability", 50)
        if momentum == "rising" or prob >= 60:
            # Good argument — boost all scores
            base = {k: v + 4 for k, v in base.items()}
        elif momentum == "declining" or prob <= 35:
            # Weak argument — reduce deltas
            base = {k: max(0, v - 2) for k, v in base.items()}

    return base


class ClosingArgumentRequest(BaseModel if False else object):
    pass

from pydantic import BaseModel as _BM

class ClosingRequest(_BM):
    session_id: str
    closing_text: str

class DemoRequest(_BM):
    case_type: str = "murder"

@router.post("/closing")
async def submit_closing(req: ClosingRequest, db: AsyncSession = Depends(get_db)):
    """Student submits closing argument — get opposing closing + dramatic verdict."""
    session = await _get_session_or_404(req.session_id, db)
    history = await _get_history(req.session_id, db)

    try:
        result = await llm.generate_closing_argument(
            session.case_data, history, session.role, req.closing_text
        )
    except Exception as e:
        # Fallback verdict if Gemini fails
        opp_role = "prosecution" if session.role == "defence" else "defence"
        result = {
            "opposing_closing": f"My Lord, the {opp_role} respectfully submits that the evidence presented clearly supports our position under BNS and BNSS provisions.",
            "judge_verdict_speech": "Having carefully considered all arguments presented by both sides, this Court delivers its judgment based on the evidence and applicable provisions of BNS, BNSS, and BSA.",
            "verdict": "Acquitted",
            "verdict_reasoning": "The Court finds that the prosecution has not established guilt beyond reasonable doubt under the applicable BNS provisions.",
            "key_finding": "Insufficient evidence to meet the standard of proof required under BSA.",
            "sentence_or_order": "The accused is acquitted and discharged forthwith.",
            "grade": "B",
            "overall_score": 70,
        }

    # Save to transcript
    db.add(CourtArgument(
        id=str(uuid.uuid4()), session_id=req.session_id,
        speaker="student", content=f"[CLOSING] {req.closing_text}", argument_type="closing"
    ))
    db.add(CourtArgument(
        id=str(uuid.uuid4()), session_id=req.session_id,
        speaker="opposing", content=f"[CLOSING] {result.get('opposing_closing','')}", argument_type="closing"
    ))
    db.add(CourtArgument(
        id=str(uuid.uuid4()), session_id=req.session_id,
        speaker="judge", content=f"[VERDICT] {result.get('judge_verdict_speech','')}", argument_type="verdict"
    ))
    session.status = "concluded"
    await db.commit()
    return result

FALLBACK_DEMO = {
    "murder": {
        "case_title": "State v. Arjun Sharma",
        "case_summary": "Murder trial under BNS Section 103 — disputed CCTV evidence and eyewitness testimony.",
        "turns": [
            {"speaker": "system", "text": "Sessions Court, Delhi. The matter of State v. Arjun Sharma is called for hearing.", "delay": 0},
            {"speaker": "judge", "text": "This court is now in session. The accused stands charged under BNS Section 103. Defence counsel, you may proceed with your opening statement.", "delay": 1500},
            {"speaker": "prosecution", "text": "My Lord, the prosecution will establish beyond reasonable doubt that the accused committed murder under BNS Section 103, supported by CCTV footage and eyewitness testimony admissible under BSA Section 63.", "delay": 3500},
            {"speaker": "defence", "text": "My Lord, the defence submits that the CCTV footage lacks the mandatory certificate under BSA Section 63(4), rendering it inadmissible. The eyewitness account is contradicted by the post-mortem timeline.", "delay": 6000},
            {"speaker": "objection", "text": "Objection: Hearsay", "ruling": "Sustained", "delay": 9000},
            {"speaker": "judge", "text": "Counsel, before you proceed — you have challenged the electronic evidence. Can you cite the specific provision under BSA that mandates certification for CCTV footage?", "delay": 11500},
            {"speaker": "defence", "text": "Certainly, My Lord. BSA Section 63(4) requires a certificate from a responsible official confirming the integrity of electronic records. Without it, the footage cannot be admitted as primary evidence.", "delay": 14000},
            {"speaker": "prosecution", "text": "My Lord, the prosecution relies on the eyewitness under BNSS Section 193. The witness placed the accused at the scene at 11:47 PM, consistent with the time of death established by the post-mortem report.", "delay": 17000},
            {"speaker": "defence", "text": "My Lord, in closing — the prosecution has failed to produce a certified copy of the CCTV footage as required by BSA Section 63. Without this primary evidence, the case rests solely on a single eyewitness. We submit the accused must be acquitted.", "delay": 20000},
            {"speaker": "verdict", "text": "Having considered the arguments on both sides, this Court finds that the electronic evidence is inadmissible for want of certification under BSA Section 63(4). The remaining evidence is insufficient to establish guilt beyond reasonable doubt.", "verdict": "Acquitted", "delay": 23000},
        ]
    },
    "theft": {
        "case_title": "State v. Ravi Kumar",
        "case_summary": "Theft trial under BNS Section 303 — disputed recovery and chain of custody.",
        "turns": [
            {"speaker": "system", "text": "Sessions Court, Mumbai. State v. Ravi Kumar — theft under BNS Section 303.", "delay": 0},
            {"speaker": "judge", "text": "Court is in session. The accused is charged under BNS Section 303. Prosecution, proceed.", "delay": 1500},
            {"speaker": "prosecution", "text": "My Lord, the accused was found in possession of stolen goods within 48 hours of the offence. Under BNS Section 303, recent possession raises a presumption of guilt.", "delay": 3500},
            {"speaker": "defence", "text": "My Lord, the recovery was made without a proper search warrant as required under BNSS Section 185. The chain of custody is broken — the seized items were not sealed at the time of recovery.", "delay": 6000},
            {"speaker": "objection", "text": "Objection: Relevance", "ruling": "Overruled", "delay": 9000},
            {"speaker": "judge", "text": "Counsel, the chain of custody argument is significant. Can you demonstrate how the break in custody affects admissibility under BSA?", "delay": 11000},
            {"speaker": "defence", "text": "My Lord, BSA Section 65 requires that physical evidence be properly sealed and documented. An unsealed recovery creates reasonable doubt as to whether these are the same items found on the accused.", "delay": 13500},
            {"speaker": "verdict", "text": "The Court finds the recovery procedure violated BNSS Section 185 and the chain of custody is compromised under BSA Section 65. Benefit of doubt is extended to the accused.", "verdict": "Acquitted", "delay": 17000},
        ]
    },
}

@router.get("/demo-script")
async def get_demo_script(case_type: str = "murder"):
    """Generate a pre-scripted demo session for auto-play presentation."""
    try:
        result = await llm.generate_demo_script(case_type)
        # Validate the result has required fields
        if not result.get("turns") or not isinstance(result["turns"], list):
            raise ValueError("Invalid script structure")
        return result
    except Exception as e:
        # Return a hardcoded fallback so demo mode never crashes
        fallback_key = case_type if case_type in FALLBACK_DEMO else "murder"
        return FALLBACK_DEMO[fallback_key]
