"""Verify staged release sequencing and rollback records without deploying anything."""

from __future__ import annotations

import asyncio
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import models  # noqa: F401, E402
from core.database import Base  # noqa: E402
from services.release_rollouts import ReleaseRolloutService  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402


async def verify() -> None:
    with tempfile.TemporaryDirectory(prefix="b2b-release-rollout-") as directory:
        database = Path(directory) / "rollout.sqlite3"
        engine = create_async_engine(f"sqlite+aiosqlite:///{database.as_posix()}")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                service = ReleaseRolloutService(session)
                rollout = await service.create({"version": "1.0.0", "release_role": "client", "deployment_id": "pilot-a", "manifest_sha256": "a" * 64, "created_by": "admin"})
                assert rollout["stages"][0]["status"] == "ready"
                try:
                    await service.act(rollout["id"], stage_key="test_agency", action="start", note=None, actor="admin")
                    raise AssertionError("later rollout stage started before headquarters approval")
                except ValueError:
                    pass
                for stage_key in ("hq", "test_agency", "test_client_plan", "full_rollout"):
                    rollout = await service.act(rollout["id"], stage_key=stage_key, action="start", note="verified", actor="admin")
                    rollout = await service.act(rollout["id"], stage_key=stage_key, action="approve", note="approved", actor="release-reviewer")
                assert rollout["status"] == "completed"
                rolled_back = await service.rollback(rollout["id"], reason="operator rollback drill", actor="admin")
                assert rolled_back["status"] == "rolled_back"
        finally:
            await engine.dispose()


def main() -> int:
    asyncio.run(verify())
    print("Release rollout controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
