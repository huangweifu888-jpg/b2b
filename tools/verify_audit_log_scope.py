"""Verify audit-log reads respect tenant boundaries and redact sensitive values."""

from __future__ import annotations

import asyncio
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from models.platform import AuditLog, Membership, Organization, Project  # noqa: E402
from routers.audit_logs import list_audit_logs  # noqa: E402
from schemas.auth import UserResponse  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402


async def verify() -> None:
    with tempfile.TemporaryDirectory(prefix="b2b-audit-scope-") as directory:
        database = Path(directory) / "audit.sqlite3"
        engine = create_async_engine(f"sqlite+aiosqlite:///{database.as_posix()}")
        async with engine.begin() as connection:
            for table in (Organization.__table__, Project.__table__, Membership.__table__, AuditLog.__table__):
                await connection.run_sync(table.create, checkfirst=True)

        sessions = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with sessions() as session:
                session.add_all(
                    [
                        Organization(id=1, name="Agency", code="agency", org_type="agency", lineage_path="1"),
                        Organization(id=2, name="Client A", code="client-a", org_type="client", lineage_path="1/2"),
                        Organization(id=3, name="Client B", code="client-b", org_type="client", lineage_path="3"),
                        Project(id=10, client_org_id=2, name="Plan A", code="plan-a"),
                        Project(id=20, client_org_id=3, name="Plan B", code="plan-b"),
                        Membership(user_id="agency-user", org_id=1, project_id=None, status="active"),
                        AuditLog(
                            actor_user_id="agency-user",
                            org_id=2,
                            project_id=10,
                            action="plan_runtime_updated",
                            detail_json='{"api_token":"must-not-leak","version":"1.0.0"}',
                        ),
                        AuditLog(actor_user_id="other-user", org_id=3, project_id=20, action="plan_runtime_updated"),
                    ]
                )
                await session.commit()
                agent = UserResponse(id="agency-user", email="agent@example.invalid", role="user")
                agent_response = await list_audit_logs(
                    db=session, current_user=agent, action=None, before=None, limit=200
                )
                if len(agent_response["items"]) != 1 or agent_response["items"][0]["project_id"] != 10:
                    raise AssertionError("agency user received an audit event outside its tenant scope")
                if agent_response["items"][0]["detail"]["api_token"] != "[redacted]":
                    raise AssertionError("sensitive audit detail was returned")
                if agent_response["items"][0]["actor_ref"] == "agency-user":
                    raise AssertionError("raw actor identity was returned")

                admin = UserResponse(id="admin-user", email="admin@example.invalid", role="admin")
                admin_response = await list_audit_logs(db=session, current_user=admin, action=None, before=None, limit=200)
                if len(admin_response["items"]) != 2:
                    raise AssertionError("headquarters admin did not receive the complete audit stream")
        finally:
            await engine.dispose()


def main() -> int:
    asyncio.run(verify())
    print("Audit-log tenant scope: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
