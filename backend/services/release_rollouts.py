"""Staged release control-plane state machine; deployment remains an external operator action."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from models.platform import ReleaseRollout, ReleaseRolloutStage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


STAGES = (
    ("hq", "总部内部", 1),
    ("test_agency", "测试代理", 2),
    ("test_client_plan", "测试客户计划", 3),
    ("full_rollout", "全量发布", 4),
)


class ReleaseRolloutService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, payload: dict[str, Any]) -> dict[str, Any]:
        existing = await self.db.scalar(
            select(ReleaseRollout).where(
                ReleaseRollout.version == payload["version"], ReleaseRollout.deployment_id == payload["deployment_id"]
            )
        )
        if existing:
            raise ValueError("A rollout already exists for this version and deployment")
        rollout = ReleaseRollout(
            version=payload["version"], release_role=payload["release_role"], deployment_id=payload["deployment_id"],
            manifest_sha256=payload["manifest_sha256"], change_summary=payload.get("change_summary"), status="draft",
            current_stage="hq", created_by=payload.get("created_by"),
        )
        self.db.add(rollout)
        await self.db.flush()
        for key, label, sequence in STAGES:
            self.db.add(ReleaseRolloutStage(rollout_id=rollout.id, stage_key=key, stage_label=label, sequence=sequence, status="ready" if sequence == 1 else "pending"))
        await self.db.commit()
        return await self.get(rollout.id)

    async def list(self, *, limit: int = 100) -> list[dict[str, Any]]:
        rollouts = (await self.db.execute(select(ReleaseRollout).order_by(ReleaseRollout.created_at.desc()).limit(limit))).scalars().all()
        return [await self._serialize(rollout) for rollout in rollouts]

    async def get(self, rollout_id: int) -> dict[str, Any]:
        rollout = await self.db.scalar(select(ReleaseRollout).where(ReleaseRollout.id == rollout_id))
        if not rollout:
            raise KeyError(f"Release rollout {rollout_id} not found")
        return await self._serialize(rollout)

    async def act(self, rollout_id: int, *, stage_key: str, action: str, note: str | None, actor: str) -> dict[str, Any]:
        rollout = await self.db.scalar(select(ReleaseRollout).where(ReleaseRollout.id == rollout_id))
        if not rollout:
            raise KeyError(f"Release rollout {rollout_id} not found")
        if rollout.status == "rolled_back":
            raise ValueError("A rolled-back rollout cannot advance")
        stages = await self._stages(rollout.id)
        stage = next((item for item in stages if item.stage_key == stage_key), None)
        if not stage:
            raise KeyError(f"Release stage {stage_key} not found")
        now = datetime.now(timezone.utc)
        if action == "start":
            if stage.status != "ready":
                raise ValueError("Only a ready stage can start")
            if stage.sequence > 1 and stages[stage.sequence - 2].status != "approved":
                raise ValueError("The previous rollout stage must be approved first")
            stage.status, rollout.status, rollout.current_stage = "running", "in_progress", stage_key
        elif action == "approve":
            if stage.status != "running":
                raise ValueError("Only a running stage can be approved")
            if rollout.created_by and rollout.created_by == actor:
                raise ValueError("The rollout creator cannot approve their own stage")
            if not (note or "").strip():
                raise ValueError("Approval evidence is required before advancing a rollout stage")
            stage.status = "approved"
            next_stage = next((item for item in stages if item.sequence == stage.sequence + 1), None)
            if next_stage:
                next_stage.status = "ready"
                rollout.current_stage = next_stage.stage_key
            else:
                rollout.status, rollout.current_stage = "completed", None
        elif action == "fail":
            if stage.status not in {"ready", "running"}:
                raise ValueError("Only a ready or running stage can fail")
            if not (note or "").strip():
                raise ValueError("Failure evidence is required before pausing a rollout")
            stage.status, rollout.status, rollout.current_stage = "failed", "paused", stage_key
        else:
            raise ValueError("Unsupported rollout action")
        stage.note, stage.acted_by, stage.acted_at = note, actor, now
        await self.db.commit()
        return await self.get(rollout.id)

    async def rollback(self, rollout_id: int, *, reason: str, actor: str) -> dict[str, Any]:
        rollout = await self.db.scalar(select(ReleaseRollout).where(ReleaseRollout.id == rollout_id))
        if not rollout:
            raise KeyError(f"Release rollout {rollout_id} not found")
        if not reason.strip():
            raise ValueError("Rollback reason is required")
        rollout.status, rollout.rollback_reason, rollout.current_stage = "rolled_back", reason.strip(), None
        await self.db.commit()
        return await self.get(rollout.id)

    async def _stages(self, rollout_id: int) -> list[ReleaseRolloutStage]:
        return (await self.db.execute(select(ReleaseRolloutStage).where(ReleaseRolloutStage.rollout_id == rollout_id).order_by(ReleaseRolloutStage.sequence))).scalars().all()

    async def _serialize(self, rollout: ReleaseRollout) -> dict[str, Any]:
        stages = await self._stages(rollout.id)
        return {
            "id": rollout.id, "version": rollout.version, "release_role": rollout.release_role,
            "deployment_id": rollout.deployment_id, "manifest_sha256": rollout.manifest_sha256,
            "change_summary": rollout.change_summary, "status": rollout.status, "current_stage": rollout.current_stage,
            "rollback_reason": rollout.rollback_reason, "created_at": rollout.created_at,
            "stages": [{"stage_key": item.stage_key, "stage_label": item.stage_label, "sequence": item.sequence, "status": item.status, "note": item.note, "acted_at": item.acted_at} for item in stages],
        }
