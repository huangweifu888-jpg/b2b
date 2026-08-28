"""Gated service for tenant-scoped 7/30/90 day implementation programs."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
import json
import secrets

from core.tenant_context import TenantContext
from models.factory_implementation import FactoryImplementationProgram
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


IMPLEMENTATION_STAGES = ("day-7", "day-30", "day-90", "completed")
IMPLEMENTATION_STATUSES = {"active", "blocked", "completed"}
GOLDEN_FLOWS = {"revenue", "manufacturing", "asset-renewal", "global-compliance", "intelligent-action"}
STAGE_ARTIFACTS: dict[str, tuple[str, ...]] = {
    "day-7": ("readiness-score", "project-roles", "data-inventory", "connector-inventory", "permission-matrix", "risk-register", "thirty-day-goal"),
    "day-30": ("end-to-end-demo", "role-training", "issue-closure", "pilot-report", "runtime-monitoring", "rollback-drill"),
    "day-90": ("value-proof", "metric-definition", "customer-confirmation", "expansion-plan", "renewal-recommendation", "next-owner"),
}
ALLOWED_ARTIFACTS = {key for keys in STAGE_ARTIFACTS.values() for key in keys}


def _json_dict(value: str | None) -> dict[str, str]:
    try:
        parsed = json.loads(value or "{}")
    except (TypeError, ValueError):
        return {}
    if not isinstance(parsed, dict):
        return {}
    return {str(key): str(item) for key, item in parsed.items() if str(item).strip()}


def _json_list(value: str | None) -> list[str]:
    try:
        parsed = json.loads(value or "[]")
    except (TypeError, ValueError):
        return []
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


def _clean_list(values: Iterable[str]) -> list[str]:
    result: list[str] = []
    for raw in values:
        value = str(raw).strip()
        if value and value not in result:
            result.append(value[:500])
        if len(result) >= 30:
            break
    return result


def serialize_program(item: FactoryImplementationProgram) -> dict[str, object]:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "tenant_id": item.tenant_id,
        "client_id": item.client_id,
        "plan_id": item.plan_id,
        "title": item.title,
        "golden_flow": item.golden_flow,
        "baseline_summary": item.baseline_summary,
        "target_outcome": item.target_outcome,
        "current_stage": item.current_stage,
        "status": item.status,
        "artifacts": _json_dict(item.artifacts_json),
        "required_artifacts": list(STAGE_ARTIFACTS.get(item.current_stage, ())),
        "blockers": _json_list(item.blockers_json),
        "next_action": item.next_action,
        "revision": item.revision,
        "updated_by": item.updated_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


class FactoryImplementationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, *, project_id: int) -> list[dict[str, object]]:
        items = (await self.db.execute(select(FactoryImplementationProgram).where(FactoryImplementationProgram.project_id == project_id).order_by(FactoryImplementationProgram.created_at.desc()))).scalars().all()
        return [serialize_program(item) for item in items]

    async def create(self, *, project_id: int, context: TenantContext, actor: str, title: str, golden_flow: str, baseline_summary: str, target_outcome: str) -> dict[str, object]:
        active = await self.db.scalar(select(FactoryImplementationProgram.id).where(FactoryImplementationProgram.project_id == project_id, FactoryImplementationProgram.status != "completed"))
        if active:
            raise ValueError("This tenant plan already has an active implementation program")
        clean_title = title.strip()[:255]
        clean_baseline = baseline_summary.strip()[:4000]
        clean_target = target_outcome.strip()[:4000]
        if not clean_title or not clean_baseline or not clean_target:
            raise ValueError("Title, baseline and target outcome are required")
        if golden_flow not in GOLDEN_FLOWS:
            raise ValueError("Unsupported golden flow")
        item = FactoryImplementationProgram(
            id=f"implementation-{secrets.token_urlsafe(18)}",
            project_id=project_id,
            agent_path=context.agent_path,
            tenant_id=context.tenant_id,
            client_id=context.client_id,
            plan_id=context.plan_id or f"plan-{project_id}",
            title=clean_title,
            golden_flow=golden_flow,
            baseline_summary=clean_baseline,
            target_outcome=clean_target,
            next_action="完成7天就绪清单并提交全部准备证据。",
            updated_by=actor,
        )
        self.db.add(item)
        await self.db.flush()
        return serialize_program(item)

    async def update(self, program_id: str, *, project_id: int, expected_revision: int, actor: str, artifacts: Mapping[str, str] | None = None, blockers: Iterable[str] | None = None, next_action: str | None = None, status: str | None = None) -> dict[str, object]:
        item = await self._get(program_id, project_id=project_id)
        if item.revision != expected_revision:
            raise ValueError("Implementation program changed; refresh before saving")
        if item.status == "completed":
            raise ValueError("Completed implementation programs are read-only")
        if status is not None:
            if status not in {"active", "blocked"}:
                raise ValueError("Only active or blocked may be set before completion")
            item.status = status
        if artifacts is not None:
            unknown = set(artifacts) - ALLOWED_ARTIFACTS
            if unknown:
                raise ValueError(f"Unsupported implementation artifact: {sorted(unknown)[0]}")
            merged = _json_dict(item.artifacts_json)
            for key, raw in artifacts.items():
                value = str(raw).strip()
                if value:
                    merged[key] = value[:4000]
                else:
                    merged.pop(key, None)
            item.artifacts_json = json.dumps(merged, ensure_ascii=False, separators=(",", ":"))
        if blockers is not None:
            cleaned = _clean_list(blockers)
            item.blockers_json = json.dumps(cleaned, ensure_ascii=False, separators=(",", ":"))
            if cleaned and status is None:
                item.status = "blocked"
            elif not cleaned and status is None and item.status == "blocked":
                item.status = "active"
        if next_action is not None:
            clean_action = next_action.strip()
            if not clean_action:
                raise ValueError("Next action is required")
            item.next_action = clean_action[:2000]
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_program(item)

    async def advance(self, program_id: str, *, project_id: int, expected_revision: int, actor: str) -> dict[str, object]:
        item = await self._get(program_id, project_id=project_id)
        if item.revision != expected_revision:
            raise ValueError("Implementation program changed; refresh before advancing")
        if item.status == "completed" or item.current_stage == "completed":
            raise ValueError("Implementation program is already complete")
        blockers = _json_list(item.blockers_json)
        if blockers:
            raise ValueError("Resolve all implementation blockers before advancing")
        artifacts = _json_dict(item.artifacts_json)
        missing = [key for key in STAGE_ARTIFACTS[item.current_stage] if not artifacts.get(key)]
        if missing:
            raise ValueError(f"Stage evidence is incomplete; missing {', '.join(missing)}")
        current_index = IMPLEMENTATION_STAGES.index(item.current_stage)
        item.current_stage = IMPLEMENTATION_STAGES[current_index + 1]
        item.status = "completed" if item.current_stage == "completed" else "active"
        next_actions = {
            "day-30": "使用受控真实样本完成黄金链、培训、监控和回退演练。",
            "day-90": "完成价值对比、客户确认、扩展与续费建议。",
            "completed": "实施周期已完成；按客户确认进入运营和下一轮价值复盘。",
        }
        item.next_action = next_actions[item.current_stage]
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_program(item)

    async def _get(self, program_id: str, *, project_id: int) -> FactoryImplementationProgram:
        item = await self.db.scalar(select(FactoryImplementationProgram).where(FactoryImplementationProgram.id == program_id, FactoryImplementationProgram.project_id == project_id))
        if not item:
            raise KeyError("Implementation program not found in this tenant plan")
        return item
