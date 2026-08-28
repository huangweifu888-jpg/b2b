import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.ad_optimization_suggestions import Ad_optimization_suggestionsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ad-suggestions", tags=["ad-suggestions"])


class UpdateStatusRequest(BaseModel):
    suggestion_id: int
    status: str  # "applied" or "dismissed"


class SuggestionRecord(BaseModel):
    id: int
    platform_name: str
    account_id: str
    account_name: str
    suggestion_type: str
    suggestion_content: str
    priority: str
    status: str
    created_at: Optional[str] = None


class SuggestionListResponse(BaseModel):
    items: List[SuggestionRecord]
    total: int


@router.post("/update-status")
async def update_suggestion_status(
    data: UpdateStatusRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the status of an optimization suggestion"""
    try:
        service = Ad_optimization_suggestionsService(db)
        result = await service.update(
            obj_id=data.suggestion_id,
            update_data={"status": data.status},
            user_id=current_user.id,
        )
        if not result:
            raise HTTPException(status_code=404, detail="建议记录未找到")
        return {"success": True, "status": data.status}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating suggestion status: {e}")
        raise HTTPException(status_code=500, detail=f"更新状态失败: {str(e)}")


@router.get("/history")
async def get_suggestion_history(
    account_id: str,
    platform_name: str,
    skip: int = 0,
    limit: int = 20,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get historical suggestions for an account"""
    try:
        service = Ad_optimization_suggestionsService(db)
        result = await service.get_list(
            skip=skip,
            limit=limit,
            user_id=current_user.id,
            query_dict={"account_id": account_id, "platform_name": platform_name},
            sort="-id",
        )
        items = []
        for item in result.get("items", []):
            items.append(SuggestionRecord(
                id=item.id,
                platform_name=item.platform_name,
                account_id=item.account_id,
                account_name=item.account_name or "",
                suggestion_type=item.suggestion_type,
                suggestion_content=item.suggestion_content,
                priority=item.priority or "medium",
                status=item.status or "pending",
                created_at=str(item.created_at) if item.created_at else None,
            ))
        return SuggestionListResponse(items=items, total=result.get("total", 0))
    except Exception as e:
        logger.error(f"Error fetching suggestion history: {e}")
        raise HTTPException(status_code=500, detail=f"获取历史建议失败: {str(e)}")