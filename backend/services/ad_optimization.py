import logging
from typing import Dict, Any
from services.aihub import AIHubService
from schemas.aihub import GenTxtRequest, ChatMessage

logger = logging.getLogger(__name__)


class AdOptimizationService:
    """Service for generating AI-powered ad optimization suggestions"""

    def __init__(self):
        self.ai_service = AIHubService()

    async def generate_suggestions(self, account_data: Dict[str, Any]) -> str:
        """Generate optimization suggestions based on account performance data"""
        platform = account_data.get("platform_name", "Unknown")
        account_name = account_data.get("account_name", "Unknown")
        spend = account_data.get("spend", "0")
        clicks = account_data.get("clicks", "0")
        conversions = account_data.get("conversions", 0)
        roas = account_data.get("roas", "0")
        campaigns_count = account_data.get("campaigns", 0)

        prompt = f"""你是一位专业的数字广告优化专家。请根据以下广告账户数据，生成3-5条具体可操作的投放优化建议。

平台: {platform}
账户: {account_name}
本月花费: {spend}
点击数: {clicks}
转化数: {conversions}
ROAS: {roas}
活动数量: {campaigns_count}

请从以下三个维度给出建议：
1. 预算调整建议 (budget) - 如何优化预算分配
2. 关键词推荐 (keyword) - 关键词策略优化
3. 文案优化 (copy) - 广告文案改进方向

请用JSON数组格式返回，每条建议包含:
- type: "budget" | "keyword" | "copy"
- content: 具体建议内容（50-100字）
- priority: "high" | "medium" | "low"

只返回JSON数组，不要其他文字。"""

        request = GenTxtRequest(
            messages=[
                ChatMessage(role="system", content="你是一位专业的数字广告投放优化专家，擅长Google Ads、Facebook Ads等平台的投放策略优化。请只返回有效的JSON格式数据。"),
                ChatMessage(role="user", content=prompt),
            ],
            model="deepseek-v3.2",
        )

        response = await self.ai_service.gentxt(request)
        return response.content