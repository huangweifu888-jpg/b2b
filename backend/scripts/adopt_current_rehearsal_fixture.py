"""Mark only the verified local two-branch rehearsal as managed fixture data.

The guard prevents accidental adoption of a real tenant: exactly 2/4/8
agencies by level, 28 clients and 56 plans are required before any write.
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
from models.platform import Organization, Project
from scripts.reset_and_seed_multitenant_rehearsal import FIXTURE_GENERATION
from sqlalchemy import func, select


def merge_fixture(value: str | None) -> str:
    try:
        settings = json.loads(value or "{}")
    except json.JSONDecodeError:
        settings = {}
    if not isinstance(settings, dict):
        settings = {}
    settings["fixture"] = {"managed": True, "generation": FIXTURE_GENERATION}
    return json.dumps(settings, ensure_ascii=False)


async def adopt(*, apply: bool) -> dict[str, object]:
    await db_manager.init_db()
    if not db_manager.async_session_maker:
        raise RuntimeError("Database session factory is unavailable")
    async with db_manager.async_session_maker() as db:
        tenants = (await db.execute(select(Organization).where(Organization.org_type.in_(("agency", "sub_agency", "client"))))).scalars().all()
        levels = dict((await db.execute(select(Organization.agent_level, func.count()).where(Organization.org_type.in_(("agency", "sub_agency"))).group_by(Organization.agent_level))).all())
        projects = (await db.execute(select(Project))).scalars().all()
        if levels != {1: 2, 2: 4, 3: 8} or sum(org.org_type == "client" for org in tenants) != 28 or len(projects) != 56:
            raise RuntimeError("Current data is not the verified two-branch rehearsal; refusing fixture adoption")
        if any(not org.code.startswith(("D", "K")) for org in tenants) or any(not project.code.startswith("J") for project in projects):
            raise RuntimeError("Current codes are not the local rehearsal convention; refusing fixture adoption")
        if apply:
            for org in tenants:
                org.settings_json = merge_fixture(org.settings_json)
            for project in projects:
                project.settings_json = merge_fixture(project.settings_json)
            await db.commit()
    await db_manager.close_db()
    return {"status": "adopted" if apply else "dry-run", "organizations": len(tenants), "projects": len(projects), "fixture_generation": FIXTURE_GENERATION}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Persist the fixture marker after all guards pass")
    args = parser.parse_args()
    print(json.dumps(asyncio.run(adopt(apply=args.apply)), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
