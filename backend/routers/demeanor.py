"""Demeanor analysis via Gemini Vision — analyzes a webcam frame for courtroom confidence."""
import base64
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ..services.llm_service import LLMService

router = APIRouter(prefix="/demeanor", tags=["demeanor"])
llm = LLMService()


class DemeanorRequest(BaseModel):
    image_b64: str          # base64-encoded JPEG frame (no data URI prefix)
    context: str = ""       # e.g. "student is cross-examining a witness"


class DemeanorResponse(BaseModel):
    demeanor: str           # confident | nervous | uncertain | unknown
    score: int              # 0-100
    stress_level: float     # 0.0-1.0
    feedback: str           # one-sentence human-readable observation
    source: str = "gemini"  # gemini | faceapi_fallback


@router.post("", response_model=DemeanorResponse)
async def analyze_demeanor(req: DemeanorRequest):
    try:
        result = await llm.analyze_demeanor_frame(req.image_b64, req.context)
        return DemeanorResponse(**result, source="gemini")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
