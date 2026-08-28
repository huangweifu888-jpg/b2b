"""Print a read-only multi-tenant hierarchy and runtime health report."""

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
from services.tenant_governance import tenant_health_report


async def check(organization_id: int | None) -> dict[str, object]:
    await db_manager.init_db()
    if not db_manager.async_session_maker:
        raise RuntimeError("Database session factory is unavailable")
    async with db_manager.async_session_maker() as db:
        result = await tenant_health_report(db, organization_id=organization_id)
    await db_manager.close_db()
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--organization-id", type=int, default=None)
    args = parser.parse_args()
    result = asyncio.run(check(args.organization_id))
    print(json.dumps(result, ensure_ascii=False))
    return 0 if result["status"] == "healthy" else 1


if __name__ == "__main__":
    raise SystemExit(main())
