"""Headquarters-only deployment readiness for future social publishing.

This router intentionally exposes booleans and checklist items only.  It never
returns environment values, secret references, OAuth tokens, or platform data.
The worker stays disabled until a deployed environment supplies every required
server-side capability.
"""

from __future__ import annotations

import os

from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends
from schemas.auth import UserResponse
from services.tenant_access import require_global_platform_access


router = APIRouter(prefix="/api/v1/social-publish-delivery", tags=["social-publish-delivery"])

# This is code-owned implementation evidence, not an environment switch. It may
# become True only after an official outbound adapter and its receipt handling
# have been implemented and verified in source.
EXTERNAL_PUBLISH_CONNECTOR_IMPLEMENTED = False


def _enabled(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


def build_delivery_readiness() -> dict[str, bool | str]:
    database_configured = bool(os.getenv("DATABASE_URL", "").strip())
    callback_base_configured = bool(os.getenv("SOCIAL_OAUTH_CALLBACK_BASE_URL", "").strip())
    secrets_backend_configured = bool(os.getenv("SOCIAL_SECRETS_BACKEND", "").strip())
    worker_enabled = _enabled("SOCIAL_PUBLISH_WORKER_ENABLED")
    execution_enabled = _enabled("SOCIAL_PUBLISH_EXECUTION_ENABLED")
    connector_implemented = EXTERNAL_PUBLISH_CONNECTOR_IMPLEMENTED
    infrastructure_ready = all((database_configured, callback_base_configured, secrets_backend_configured, worker_enabled, execution_enabled))
    ready_for_external_publish = infrastructure_ready and connector_implemented
    if not connector_implemented:
        message = "基础设施开关即使齐备也不代表外部发布就绪；官方发布连接器尚未实现，系统继续保持安全阻断。"
    elif not infrastructure_ready:
        message = "官方发布连接器已登记，但基础设施条件尚未齐备，系统继续保持安全阻断。"
    else:
        message = "外部发布条件已齐备；仍须先使用沙箱账号完成端到端回执验收。"
    return {
        "database_configured": database_configured,
        "callback_base_configured": callback_base_configured,
        "secrets_backend_configured": secrets_backend_configured,
        "worker_enabled": worker_enabled,
        "execution_enabled": execution_enabled,
        "connector_implemented": connector_implemented,
        "ready_for_external_publish": ready_for_external_publish,
        "mode": "external_publish_enabled" if ready_for_external_publish else "safe_local_or_staging_mode",
        "message": message,
    }


@router.get("/readiness")
async def delivery_readiness(current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    return build_delivery_readiness()


@router.get("/checklist")
async def delivery_checklist(current_user: UserResponse = Depends(get_current_user)):
    await require_global_platform_access(current_user=current_user)
    return {
        "items": [
            {"id": "database", "title": "执行数据库迁移", "owner": "总部运维", "detail": "先部署审核与授权控制表，再启动发布队列。"},
            {"id": "https", "title": "配置 HTTPS 回调域名", "owner": "总部运维", "detail": "各平台 OAuth 回调必须使用正式 HTTPS 域名。"},
            {"id": "secrets", "title": "接入密钥库", "owner": "总部安全", "detail": "App Secret、令牌和签名密钥只由服务端密钥库管理。"},
            {"id": "apps", "title": "配置并审核平台应用", "owner": "总部运营", "detail": "按平台登记权限、回调地址和审核材料。"},
            {"id": "worker", "title": "启用发布工作进程", "owner": "总部运维", "detail": "先以沙箱渠道验证队列、重试、审计与回执，再开启生产发布。"},
        ]
    }
