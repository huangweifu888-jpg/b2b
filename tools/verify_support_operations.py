"""Exercise support ticket SLA creation in an isolated database."""

from __future__ import annotations

import asyncio
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import models  # noqa: E402,F401
from core.database import Base  # noqa: E402
from models.platform import Organization  # noqa: E402
from services.support_operations import create_ticket  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402


async def verify() -> None:
    with tempfile.TemporaryDirectory(prefix="b2b-support-") as directory:
        engine = create_async_engine(f"sqlite+aiosqlite:///{Path(directory, 'support.sqlite3').as_posix()}")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                org = Organization(name="Support tenant", code="SUPPORT-T", org_type="client", lineage_path="")
                session.add(org)
                await session.flush()
                ticket = await create_ticket(session, org_id=org.id, project_id=None, subject="Service unavailable", severity="sev1")
                assert ticket.ticket_key.startswith("SUP-") and ticket.next_update_due_at > ticket.first_response_due_at
        finally:
            await engine.dispose()


def main() -> int:
    asyncio.run(verify())
    print("Support operations: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
