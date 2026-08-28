"""Repair derived tenant hierarchy fields from the authoritative parent graph.

This is intentionally explicit because ``lineage_path`` and root pointers are
used for tenant authorization.  It never invents missing parents or changes an
organization's type; invalid parent chains are reported and left untouched.
"""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import models  # noqa: F401
from core.database import db_manager
from models.platform import Organization
from services.tenant_governance import _expected_lineage
from sqlalchemy import select


async def reconcile(*, apply: bool) -> dict[str, object]:
    await db_manager.init_db()
    if not db_manager.async_session_maker:
        raise RuntimeError("Database session factory is unavailable")
    async with db_manager.async_session_maker() as db:
        organizations = (await db.execute(select(Organization))).scalars().all()
        by_id = {org.id: org for org in organizations}
        changed: list[dict[str, object]] = []
        invalid: list[int] = []
        for org in organizations:
            expected = _expected_lineage(org, by_id)
            if expected is None:
                invalid.append(org.id)
                continue
            expected_path = "/".join(str(item) for item in expected)
            chain = [by_id[item] for item in expected]
            hq = next((item for item in chain if item.org_type == "hq"), None)
            root_agency = next((item for item in chain if item.org_type == "agency" and item.agent_level == 1), None)
            updates = {
                "lineage_path": expected_path,
                "root_org_id": hq.id if hq else org.root_org_id,
                "root_agency_id": (org.id if org.org_type == "agency" and org.agent_level == 1 else root_agency.id if root_agency else None),
            }
            if any(getattr(org, field) != value for field, value in updates.items()):
                changed.append({"id": org.id, "type": org.org_type, "code": org.code})
                if apply:
                    for field, value in updates.items():
                        setattr(org, field, value)
        if apply:
            await db.commit()
    await db_manager.close_db()
    return {"status": "reconciled" if apply else "dry-run", "changes": changed, "invalid_organization_ids": invalid}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Persist the computed derived-field corrections")
    args = parser.parse_args()
    print(json.dumps(asyncio.run(reconcile(apply=args.apply)), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
