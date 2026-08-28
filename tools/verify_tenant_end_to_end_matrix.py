"""Exercise hierarchy, runtime mutation, and private-download isolation end to end."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import os
from pathlib import Path
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import models  # noqa: F401, E402
from core.database import Base  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from models.platform import ContentDownloadAsset, Membership, Organization, PlanRuntimeConfig, Project  # noqa: E402
from routers.content_downloads import _hash_file, create_private_ticket, list_assets  # noqa: E402
from routers.plan_runtime import PlanRuntimeUpdate, update_runtime_config  # noqa: E402
from schemas.auth import UserResponse  # noqa: E402
from services.tenant_access import require_project_access, visible_project_ids  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402
from starlette.requests import Request  # noqa: E402


def user(user_id: str, role: str = "user") -> UserResponse:
    return UserResponse(id=user_id, email=f"{user_id}@example.test", name=user_id, role=role)


def request() -> Request:
    return Request({"type": "http", "method": "POST", "path": "/", "headers": [], "client": ("127.0.0.1", 12345)})


async def forbidden(coroutine) -> None:
    try:
        await coroutine
    except HTTPException as exc:
        assert exc.status_code == 403, exc.detail
        return
    raise AssertionError("cross-scope request was unexpectedly allowed")


async def verify() -> None:
    with tempfile.TemporaryDirectory(prefix="b2b-tenant-e2e-") as directory:
        root = Path(directory)
        assets = root / "assets"
        assets.mkdir()
        (assets / "a1.pdf").write_bytes(b"A1 private material")
        (assets / "a2.pdf").write_bytes(b"A2 private material")
        engine = create_async_engine(f"sqlite+aiosqlite:///{(root / 'tenant-e2e.sqlite3').as_posix()}")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        original = {key: os.environ.get(key) for key in ("ENVIRONMENT", "ASSET_STORAGE_ROOT", "CONTENT_DOWNLOAD_SECRET")}
        os.environ.update({"ENVIRONMENT": "test", "ASSET_STORAGE_ROOT": str(assets), "CONTENT_DOWNLOAD_SECRET": "tenant-e2e-download-secret-0123456789-abcdefghijklmnopqrstuvwxyz"})
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            async with sessions() as db:
                hq = Organization(name="HQ", code="HQ-E2E", org_type="hq", lineage_path="")
                db.add(hq)
                await db.flush()
                agency_a = Organization(name="Agency A", code="A-E2E", org_type="agency", parent_id=hq.id, root_org_id=hq.id, lineage_path=str(hq.id))
                agency_b = Organization(name="Agency B", code="B-E2E", org_type="agency", parent_id=hq.id, root_org_id=hq.id, lineage_path=str(hq.id))
                db.add_all([agency_a, agency_b])
                await db.flush()
                sub_a = Organization(name="Sub A", code="SA-E2E", org_type="agency", parent_id=agency_a.id, root_org_id=hq.id, root_agency_id=agency_a.id, lineage_path=f"{hq.id}/{agency_a.id}")
                db.add(sub_a)
                await db.flush()
                client_a = Organization(name="Client A", code="CA-E2E", org_type="client", parent_id=sub_a.id, root_org_id=hq.id, root_agency_id=agency_a.id, lineage_path=f"{hq.id}/{agency_a.id}/{sub_a.id}")
                client_b = Organization(name="Client B", code="CB-E2E", org_type="client", parent_id=agency_b.id, root_org_id=hq.id, root_agency_id=agency_b.id, lineage_path=f"{hq.id}/{agency_b.id}")
                db.add_all([client_a, client_b])
                await db.flush()
                a1, a2, b1 = Project(client_org_id=client_a.id, name="A1", code="A1", status="active"), Project(client_org_id=client_a.id, name="A2", code="A2", status="active"), Project(client_org_id=client_b.id, name="B1", code="B1", status="active")
                db.add_all([a1, a2, b1])
                await db.flush()
                db.add_all([
                    Membership(user_id="agency-a", org_id=agency_a.id, status="active"),
                    Membership(user_id="sub-a", org_id=sub_a.id, status="active"),
                    Membership(user_id="client-a", org_id=client_a.id, status="active"),
                    Membership(user_id="plan-a1", org_id=client_a.id, project_id=a1.id, status="active"),
                    Membership(user_id="agency-b", org_id=agency_b.id, status="active"),
                ])
                for asset_id, project, storage_key in (("asset-a1", a1, "a1.pdf"), ("asset-a2", a2, "a2.pdf")):
                    path = assets / storage_key
                    db.add(ContentDownloadAsset(id=asset_id, project_id=project.id, client_org_id=client_a.id, storage_key=storage_key, display_name=storage_key, media_type="application/pdf", visibility="authenticated", enabled=True, size_bytes=path.stat().st_size, sha256=_hash_file(path), scan_status="clean", scan_detail="test", scanned_at=datetime.now(timezone.utc)))
                await db.commit()

                assert await visible_project_ids(db, current_user=user("agency-a")) == {a1.id, a2.id}
                assert await visible_project_ids(db, current_user=user("sub-a")) == {a1.id, a2.id}
                assert await visible_project_ids(db, current_user=user("client-a")) == {a1.id, a2.id}
                assert await visible_project_ids(db, current_user=user("plan-a1")) == {a1.id}
                assert await visible_project_ids(db, current_user=user("agency-b")) == {b1.id}
                assert await visible_project_ids(db, current_user=user("hq-admin", role="admin")) == {a1.id, a2.id, b1.id}
                await require_project_access(db, current_user=user("agency-a"), project_id=a2.id)
                await forbidden(require_project_access(db, current_user=user("agency-a"), project_id=b1.id))
                await forbidden(require_project_access(db, current_user=user("plan-a1"), project_id=a2.id))
                await forbidden(require_project_access(db, current_user=user("outsider"), project_id=a1.id))

                await update_runtime_config(a2.id, PlanRuntimeUpdate(deployment_id="stamp-a", database_id="client-a-db", enabled_modules=["02-content"]), request(), db, user("client-a"))
                await forbidden(update_runtime_config(a2.id, PlanRuntimeUpdate(deployment_id="illegal", database_id="illegal"), request(), db, user("plan-a1")))
                runtime = await db.scalar(select(PlanRuntimeConfig).where(PlanRuntimeConfig.project_id == a2.id))
                assert runtime and runtime.deployment_id == "stamp-a"

                assert "download_url" in await create_private_ticket("asset-a1", request(), db, user("plan-a1"))
                await create_private_ticket("asset-a2", request(), db, user("agency-a"))
                await forbidden(create_private_ticket("asset-a2", request(), db, user("plan-a1")))
                await forbidden(create_private_ticket("asset-a1", request(), db, user("agency-b")))
                assert len((await list_assets(a1.id, db, user("plan-a1")))["items"]) == 1
                await forbidden(list_assets(a1.id, db, user("agency-b")))
        finally:
            for key, value in original.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
            await engine.dispose()


def main() -> int:
    asyncio.run(verify())
    print("Tenant end-to-end authorization matrix: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
