"""Leaderboard router."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from ..models.database import get_db, PerformanceScore, User, Badge

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


@router.get("/")
async def get_leaderboard(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(
            PerformanceScore.user_id,
            func.avg(PerformanceScore.overall_score).label("avg_score"),
            func.count(PerformanceScore.id).label("sessions"),
            func.avg(PerformanceScore.bench_queries_faced).label("avg_bench_queries")
        ).group_by(PerformanceScore.user_id)
        .order_by(func.avg(PerformanceScore.overall_score).desc())
        .limit(limit)
    )
    rows = result.all()

    entries = []
    for rank, row in enumerate(rows, 1):
        user_result = await db.execute(select(User).where(User.id == row.user_id))
        user = user_result.scalar_one_or_none()
        badge_result = await db.execute(
            select(func.count(Badge.id)).where(Badge.user_id == row.user_id)
        )
        badge_count = badge_result.scalar() or 0
        entries.append({
            "rank": rank,
            "user_id": row.user_id,
            "name": user.name if user else "Anonymous",
            "college": user.college if user else None,
            "overall_score": round(row.avg_score, 1),
            "sessions_count": row.sessions,
            "badges_count": badge_count,
            "bench_queries_avg": round(row.avg_bench_queries, 1)
        })
    return {"leaderboard": entries}
