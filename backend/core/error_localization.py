"""Chinese user-facing text for API error responses.

The API remains free to log technical details in English, but its ``detail``
field is displayed directly by many frontend notification toasts.  Keep that
boundary Chinese so an implementation message never leaks into the product UI.
"""

from __future__ import annotations

from typing import Any


_EXACT_MESSAGES = {
    "Active plan not found": "未找到活动计划",
    "Authentication credentials were not provided": "未提供登录凭证",
    "Invalid authentication token": "登录凭证无效",
    "Admin access required": "需要管理员权限",
    "Not found": "未找到请求资源",
    "Internal Server Error": "服务器处理请求时出现异常，请稍后重试",
}


def localize_error_detail(detail: Any) -> Any:
    """Return a Chinese API detail without changing structured validation data."""
    if not isinstance(detail, str):
        return detail

    message = detail.strip()
    if not message:
        return "请求未完成，请稍后重试"
    if message in _EXACT_MESSAGES:
        return _EXACT_MESSAGES[message]
    # Respect routers that already return an operator-facing Chinese message.
    if any("\u4e00" <= char <= "\u9fff" for char in message):
        return message

    normalized = message.lower()
    if "not found" in normalized or "does not exist" in normalized:
        return "未找到所需资源"
    if "permission" in normalized or "access denied" in normalized or "forbidden" in normalized:
        return "没有执行此操作的权限"
    if "authentication" in normalized or "token" in normalized or "credential" in normalized:
        return "登录状态无效或已过期，请重新登录"
    if "already exists" in normalized or "duplicate" in normalized or "conflict" in normalized:
        return "当前数据与已有记录冲突，请刷新后重试"
    if "required" in normalized or "invalid" in normalized or "unsupported" in normalized:
        return "请求参数不正确，请检查后重试"
    if "unavailable" in normalized or "not initialized" in normalized:
        return "当前服务暂不可用，请稍后重试"
    return "请求未完成，请检查后重试"
