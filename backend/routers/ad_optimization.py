import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.ad_optimization import AdOptimizationService
from services.ad_optimization_suggestions import Ad_optimization_suggestionsService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/ad-optimization", tags=["ad-optimization"])


class GenerateSuggestionsRequest(BaseModel):
    platform_name: str
    account_id: str
    account_name: str
    spend: str
    clicks: str
    conversions: int
    roas: str
    campaigns: int


class SuggestionItem(BaseModel):
    type: str
    content: str
    priority: str


class GenerateSuggestionsResponse(BaseModel):
    suggestions: List[SuggestionItem]


@router.post("/generate-suggestions", response_model=GenerateSuggestionsResponse)
async def generate_suggestions(
    data: GenerateSuggestionsRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate AI-powered optimization suggestions for an ad account"""
    try:
        service = AdOptimizationService()
        result = await service.generate_suggestions(data.model_dump())

        # Parse the AI response
        try:
            # Try to extract JSON from the response
            content = result.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content
                content = content.rsplit("```", 1)[0]
            if content.startswith("json"):
                content = content[4:].strip()
            suggestions_data = json.loads(content)
        except (json.JSONDecodeError, IndexError):
            # Fallback suggestions if AI response is not valid JSON
            suggestions_data = [
                {"type": "budget", "content": "建议将表现最佳的广告活动预算提升20%，同时降低低转化活动的预算分配。", "priority": "high"},
                {"type": "keyword", "content": "建议添加更多长尾关键词以降低CPC，同时排除无效搜索词。", "priority": "medium"},
                {"type": "copy", "content": "建议在广告标题中加入具体数字和行动号召语，提升点击率。", "priority": "medium"},
            ]

        # Save suggestions to database
        suggestions_service = Ad_optimization_suggestionsService(db)
        for item in suggestions_data:
            await suggestions_service.create(
                data={
                    "platform_name": data.platform_name,
                    "account_id": data.account_id,
                    "account_name": data.account_name,
                    "suggestion_type": item.get("type", "budget"),
                    "suggestion_content": item.get("content", ""),
                    "priority": item.get("priority", "medium"),
                    "status": "pending",
                },
                user_id=current_user.id,
            )

        suggestions = [
            SuggestionItem(
                type=item.get("type", "budget"),
                content=item.get("content", ""),
                priority=item.get("priority", "medium"),
            )
            for item in suggestions_data
        ]

        return GenerateSuggestionsResponse(suggestions=suggestions)

    except Exception as e:
        logger.error(f"Error generating suggestions: {e}")
        raise HTTPException(status_code=500, detail=f"生成优化建议失败: {str(e)}")