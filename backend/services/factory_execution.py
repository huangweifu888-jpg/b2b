"""Invariant-preserving service for the Factory Platform execution desk."""

from __future__ import annotations

import json
from collections.abc import Iterable

from models.factory_execution import FactoryExecutionWorkstream
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


WORKSTREAM_STATUSES = {"active", "queued", "blocked", "done"}
DEVELOPMENT_GATES = {"intake-review", "contract-freeze", "security-review", "development-acceptance", "business-acceptance", "release-readiness", "value-review"}


def _json_list(value: str | None) -> list[str]:
    try:
        parsed = json.loads(value or "[]")
    except (TypeError, ValueError):
        parsed = []
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


def _clean_list(values: Iterable[str], *, limit: int = 30) -> list[str]:
    result: list[str] = []
    for raw in values:
        value = str(raw).strip()
        if value and value not in result:
            result.append(value[:500])
        if len(result) >= limit:
            break
    return result


def serialize_workstream(item: FactoryExecutionWorkstream) -> dict[str, object]:
    return {
        "id": item.id,
        "sequence": item.sequence,
        "label": item.label,
        "status": item.status,
        "current_gate": item.current_gate,
        "owner_roles": _json_list(item.owner_roles_json),
        "deliverables": _json_list(item.deliverables_json),
        "blockers": _json_list(item.blockers_json),
        "evidence": _json_list(item.evidence_json),
        "next_action": item.next_action,
        "revision": item.revision,
        "updated_by": item.updated_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


class FactoryExecutionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self) -> list[dict[str, object]]:
        items = (await self.db.execute(select(FactoryExecutionWorkstream).order_by(FactoryExecutionWorkstream.sequence))).scalars().all()
        return [serialize_workstream(item) for item in items]

    async def update(self, workstream_id: str, *, expected_revision: int, actor: str, changes: dict[str, object]) -> dict[str, object]:
        item = await self.db.scalar(select(FactoryExecutionWorkstream).where(FactoryExecutionWorkstream.id == workstream_id))
        if not item:
            raise KeyError("Execution workstream not found")
        if item.revision != expected_revision:
            raise ValueError("Execution workstream changed; refresh before saving")

        next_status = str(changes.get("status", item.status))
        next_gate = str(changes.get("current_gate", item.current_gate))
        if next_status not in WORKSTREAM_STATUSES:
            raise ValueError("Unsupported execution status")
        if next_gate not in DEVELOPMENT_GATES:
            raise ValueError("Unsupported development gate")
        if next_status == "active":
            active_other = await self.db.scalar(select(FactoryExecutionWorkstream.id).where(FactoryExecutionWorkstream.status == "active", FactoryExecutionWorkstream.id != workstream_id))
            if active_other:
                raise ValueError("Only one execution workstream may be active")

        for field, column in (("owner_roles", "owner_roles_json"), ("deliverables", "deliverables_json"), ("blockers", "blockers_json"), ("evidence", "evidence_json")):
            if field in changes:
                value = changes[field]
                if not isinstance(value, list):
                    raise ValueError(f"{field} must be a list")
                setattr(item, column, json.dumps(_clean_list(value), ensure_ascii=False, separators=(",", ":")))
        if "next_action" in changes:
            next_action = str(changes["next_action"]).strip()
            if not next_action:
                raise ValueError("Next action is required")
            item.next_action = next_action[:2000]
        if next_status == "done" and not _json_list(item.evidence_json):
            raise ValueError("Completed workstreams require evidence")

        item.status = next_status
        item.current_gate = next_gate
        item.revision += 1
        item.updated_by = actor
        await self.db.flush()
        return serialize_workstream(item)
