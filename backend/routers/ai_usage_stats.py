import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from models.ai_usage_records import Ai_usage_records

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ai-usage-stats", tags=["ai-usage-stats"])


@router.get("/summary")
async def get_usage_summary(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    """Get AI usage summary statistics"""
    user_id = current_user.id
    since = datetime.utcnow() - timedelta(days=days)

    # Total calls
    total_q = await db.execute(
        select(func.count(Ai_usage_records.id)).where(
            Ai_usage_records.user_id == user_id,
            Ai_usage_records.created_at >= since,
        )
    )
    total_calls = total_q.scalar() or 0

    # Total tokens
    tokens_q = await db.execute(
        select(func.coalesce(func.sum(Ai_usage_records.tokens_used), 0)).where(
            Ai_usage_records.user_id == user_id,
            Ai_usage_records.created_at >= since,
        )
    )
    total_tokens = tokens_q.scalar() or 0

    # Total cost
    cost_q = await db.execute(
        select(func.coalesce(func.sum(Ai_usage_records.cost), 0)).where(
            Ai_usage_records.user_id == user_id,
            Ai_usage_records.created_at >= since,
        )
    )
    total_cost = float(cost_q.scalar() or 0)

    # Success rate
    success_q = await db.execute(
        select(func.count(Ai_usage_records.id)).where(
            Ai_usage_records.user_id == user_id,
            Ai_usage_records.created_at >= since,
            Ai_usage_records.status == "success",
        )
    )
    success_count = success_q.scalar() or 0
    success_rate = round((success_count / total_calls * 100) if total_calls > 0 else 0, 1)

    # By category
    cat_q = await db.execute(
        select(
            Ai_usage_records.category,
            func.count(Ai_usage_records.id).label("calls"),
            func.coalesce(func.sum(Ai_usage_records.tokens_used), 0).label("tokens"),
            func.coalesce(func.sum(Ai_usage_records.cost), 0).label("cost"),
        )
        .where(
            Ai_usage_records.user_id == user_id,
            Ai_usage_records.created_at >= since,
        )
        .group_by(Ai_usage_records.category)
    )
    by_category = [
        {"category": r.category, "calls": r.calls, "tokens": int(r.tokens), "cost": float(r.cost)}
        for r in cat_q.all()
    ]

    # By model
    model_q = await db.execute(
        select(
            Ai_usage_records.model_name,
            Ai_usage_records.category,
            func.count(Ai_usage_records.id).label("calls"),
            func.coalesce(func.sum(Ai_usage_records.tokens_used), 0).label("tokens"),
            func.coalesce(func.sum(Ai_usage_records.cost), 0).label("cost"),
        )
        .where(
            Ai_usage_records.user_id == user_id,
            Ai_usage_records.created_at >= since,
        )
        .group_by(Ai_usage_records.model_name, Ai_usage_records.category)
    )
    by_model = [
        {"model": r.model_name, "category": r.category, "calls": r.calls, "tokens": int(r.tokens), "cost": float(r.cost)}
        for r in model_q.all()
    ]

    # Daily trend
    daily_q = await db.execute(
        select(
            cast(Ai_usage_records.created_at, Date).label("date"),
            func.count(Ai_usage_records.id).label("calls"),
            func.coalesce(func.sum(Ai_usage_records.tokens_used), 0).label("tokens"),
            func.coalesce(func.sum(Ai_usage_records.cost), 0).label("cost"),
        )
        .where(
            Ai_usage_records.user_id == user_id,
            Ai_usage_records.created_at >= since,
        )
        .group_by(cast(Ai_usage_records.created_at, Date))
        .order_by(cast(Ai_usage_records.created_at, Date))
    )
    daily_trend = [
        {"date": str(r.date), "calls": r.calls, "tokens": int(r.tokens), "cost": float(r.cost)}
        for r in daily_q.all()
    ]

    # By source page
    page_q = await db.execute(
        select(
            Ai_usage_records.source_page,
            func.count(Ai_usage_records.id).label("calls"),
            func.coalesce(func.sum(Ai_usage_records.cost), 0).label("cost"),
        )
        .where(
            Ai_usage_records.user_id == user_id,
            Ai_usage_records.created_at >= since,
        )
        .group_by(Ai_usage_records.source_page)
    )
    by_page = [
        {"page": r.source_page, "calls": r.calls, "cost": float(r.cost)}
        for r in page_q.all()
    ]

    return {
        "total_calls": total_calls,
        "total_tokens": total_tokens,
        "total_cost": total_cost,
        "success_rate": success_rate,
        "by_category": by_category,
        "by_model": by_model,
        "daily_trend": daily_trend,
        "by_page": by_page,
    }
