"""Validation and optimistic concurrency for Factory Platform contracts."""

from __future__ import annotations

import json
from collections.abc import Iterable

from models.factory_contract import FactoryCoreEventContract, FactoryCoreObjectContract
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


CATEGORY_KEYS = {"identity", "content", "trust", "recommend", "deepen", "portrait", "lead", "convert", "fulfillment", "care", "decision", "operations"}
LIFECYCLE_STATUSES = {"draft", "frozen", "deprecated"}
COMPATIBILITY_MODES = {"backward", "forward", "full", "breaking"}
REQUIRED_EVENT_FIELDS = {"eventId", "tenantId", "eventType", "occurredAt", "source", "subjectId", "version", "correlationId"}


def _json_list(value: str | None) -> list[str]:
    try:
        parsed = json.loads(value or "[]")
    except (TypeError, ValueError):
        parsed = []
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


def _clean_list(values: Iterable[str], *, limit: int = 40) -> list[str]:
    result: list[str] = []
    for raw in values:
        value = str(raw).strip()
        if value and value not in result:
            result.append(value[:120])
        if len(result) >= limit:
            break
    return result


def serialize_object(item: FactoryCoreObjectContract) -> dict[str, object]:
    return {
        "id": item.id,
        "sequence": item.sequence,
        "label": item.label,
        "system_of_record": item.system_of_record,
        "identity_rule": item.identity_rule,
        "minimum_fields": _json_list(item.minimum_fields_json),
        "lifecycle_status": item.lifecycle_status,
        "schema_version": item.schema_version,
        "revision": item.revision,
        "updated_by": item.updated_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def serialize_event(item: FactoryCoreEventContract) -> dict[str, object]:
    return {
        "id": item.id,
        "sequence": item.sequence,
        "label": item.label,
        "subject_id": item.subject_id,
        "producer": item.producer,
        "consumers": _json_list(item.consumers_json),
        "required_fields": _json_list(item.required_fields_json),
        "compatibility": item.compatibility,
        "lifecycle_status": item.lifecycle_status,
        "schema_version": item.schema_version,
        "revision": item.revision,
        "updated_by": item.updated_by,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _validate_object(item: FactoryCoreObjectContract) -> None:
    fields = set(_json_list(item.minimum_fields_json))
    if item.system_of_record not in CATEGORY_KEYS:
        raise ValueError("Object system of record must be one of the twelve platform categories")
    if not item.identity_rule.strip():
        raise ValueError("Object identity rule is required")
    if "tenantId" not in fields or not any(field.endswith("Id") and field != "tenantId" for field in fields):
        raise ValueError("Object contracts require tenantId and a stable object identifier")


async def _validate_event(db: AsyncSession, item: FactoryCoreEventContract) -> None:
    subject = await db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id == item.subject_id))
    if not subject:
        raise ValueError("Event subject must reference a registered core object")
    if item.producer not in CATEGORY_KEYS:
        raise ValueError("Event producer must be one of the twelve platform categories")
    consumers = set(_json_list(item.consumers_json))
    if not consumers or not consumers.issubset(CATEGORY_KEYS):
        raise ValueError("Event consumers must use one or more platform categories")
    if not REQUIRED_EVENT_FIELDS.issubset(set(_json_list(item.required_fields_json))):
        raise ValueError("Event envelope is missing required fields")
    if item.compatibility not in COMPATIBILITY_MODES:
        raise ValueError("Unsupported event compatibility mode")
    if item.lifecycle_status == "frozen" and subject.lifecycle_status != "frozen":
        raise ValueError("Freeze the subject object before freezing its events")


class FactoryContractService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_registry(self) -> dict[str, object]:
        objects = (await self.db.execute(select(FactoryCoreObjectContract).order_by(FactoryCoreObjectContract.sequence))).scalars().all()
        events = (await self.db.execute(select(FactoryCoreEventContract).order_by(FactoryCoreEventContract.sequence))).scalars().all()
        return {
            "objects": [serialize_object(item) for item in objects],
            "events": [serialize_event(item) for item in events],
            "required_event_fields": sorted(REQUIRED_EVENT_FIELDS),
            "summary": {
                "object_count": len(objects),
                "event_count": len(events),
                "frozen_object_count": sum(item.lifecycle_status == "frozen" for item in objects),
                "frozen_event_count": sum(item.lifecycle_status == "frozen" for item in events),
            },
        }

    async def update_object(self, object_id: str, *, expected_revision: int, actor: str, changes: dict[str, object]) -> dict[str, object]:
        item = await self.db.scalar(select(FactoryCoreObjectContract).where(FactoryCoreObjectContract.id == object_id))
        if not item:
            raise KeyError("Core object contract not found")
        self._check_revision(item.revision, expected_revision)
        self._guard_frozen_edit(item, changes)
        if "system_of_record" in changes:
            item.system_of_record = str(changes["system_of_record"])
        if "identity_rule" in changes:
            item.identity_rule = str(changes["identity_rule"]).strip()[:2000]
        if "minimum_fields" in changes:
            fields = changes["minimum_fields"]
            if not isinstance(fields, list):
                raise ValueError("minimum_fields must be a list")
            item.minimum_fields_json = json.dumps(_clean_list(fields), ensure_ascii=False, separators=(",", ":"))
        self._apply_common(item, actor=actor, changes=changes)
        _validate_object(item)
        if item.lifecycle_status == "deprecated":
            active_reference = await self.db.scalar(select(FactoryCoreEventContract.id).where(FactoryCoreEventContract.subject_id == item.id, FactoryCoreEventContract.lifecycle_status != "deprecated"))
            if active_reference:
                raise ValueError("Deprecate dependent events before deprecating their subject object")
        await self.db.flush()
        return serialize_object(item)

    async def update_event(self, event_id: str, *, expected_revision: int, actor: str, changes: dict[str, object]) -> dict[str, object]:
        item = await self.db.scalar(select(FactoryCoreEventContract).where(FactoryCoreEventContract.id == event_id))
        if not item:
            raise KeyError("Core event contract not found")
        self._check_revision(item.revision, expected_revision)
        self._guard_frozen_edit(item, changes)
        for field in ("subject_id", "producer", "compatibility"):
            if field in changes:
                setattr(item, field, str(changes[field]))
        for field, column in (("consumers", "consumers_json"), ("required_fields", "required_fields_json")):
            if field in changes:
                values = changes[field]
                if not isinstance(values, list):
                    raise ValueError(f"{field} must be a list")
                setattr(item, column, json.dumps(_clean_list(values), ensure_ascii=False, separators=(",", ":")))
        self._apply_common(item, actor=actor, changes=changes)
        await _validate_event(self.db, item)
        await self.db.flush()
        return serialize_event(item)

    async def freeze_all(self, *, actor: str) -> dict[str, object]:
        objects = (await self.db.execute(select(FactoryCoreObjectContract).order_by(FactoryCoreObjectContract.sequence))).scalars().all()
        events = (await self.db.execute(select(FactoryCoreEventContract).order_by(FactoryCoreEventContract.sequence))).scalars().all()
        if len(objects) != 22 or len(events) != 14:
            raise ValueError("Contract freeze requires exactly 22 core objects and 14 core events")
        for item in objects:
            _validate_object(item)
            if item.lifecycle_status != "frozen":
                item.lifecycle_status = "frozen"
                item.revision += 1
                item.updated_by = actor
        await self.db.flush()
        for item in events:
            item.lifecycle_status = "frozen"
            await _validate_event(self.db, item)
            if item.revision == 1 or item.updated_by != actor:
                item.revision += 1
            item.updated_by = actor
        await self.db.flush()
        return await self.list_registry()

    @staticmethod
    def _check_revision(current: int, expected: int) -> None:
        if current != expected:
            raise ValueError("Contract changed; refresh before saving")

    @staticmethod
    def _guard_frozen_edit(item: object, changes: dict[str, object]) -> None:
        immutable_changes = set(changes) - {"lifecycle_status", "schema_version"}
        current_version = int(getattr(item, "schema_version"))
        requested_version = int(changes.get("schema_version", current_version))
        if getattr(item, "lifecycle_status") == "frozen" and immutable_changes and requested_version <= current_version:
            raise ValueError("Editing a frozen contract requires a higher schema_version")

    @staticmethod
    def _apply_common(item: object, *, actor: str, changes: dict[str, object]) -> None:
        if "lifecycle_status" in changes:
            status = str(changes["lifecycle_status"])
            if status not in LIFECYCLE_STATUSES:
                raise ValueError("Unsupported contract lifecycle status")
            setattr(item, "lifecycle_status", status)
        if "schema_version" in changes:
            version = int(changes["schema_version"])
            if version < int(getattr(item, "schema_version")):
                raise ValueError("schema_version cannot decrease")
            setattr(item, "schema_version", version)
        setattr(item, "revision", int(getattr(item, "revision")) + 1)
        setattr(item, "updated_by", actor)
