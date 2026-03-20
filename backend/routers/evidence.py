"""Evidence router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.database import get_db, EvidenceItem
from ..models.schemas import EvidenceResponse

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("/session/{session_id}")
async def get_evidence(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EvidenceItem).where(EvidenceItem.session_id == session_id)
    )
    items = result.scalars().all()
    return {"evidence": [EvidenceResponse.model_validate(i) for i in items]}


@router.get("/{evidence_id}")
async def get_evidence_item(evidence_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EvidenceItem).where(EvidenceItem.id == evidence_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return EvidenceResponse.model_validate(item)
