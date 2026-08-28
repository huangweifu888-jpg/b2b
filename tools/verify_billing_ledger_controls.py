"""Exercise append-only ledger persistence and chain validation in SQLite."""

from __future__ import annotations

import asyncio
import sys
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import models  # noqa: E402,F401
from core.database import Base  # noqa: E402
from models.platform import BillingLedgerEntry, Organization  # noqa: E402
from services.billing_ledger import append_entry, validate_chain  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402


async def verify() -> None:
    with tempfile.TemporaryDirectory(prefix="b2b-ledger-") as directory:
        engine = create_async_engine(f"sqlite+aiosqlite:///{Path(directory, 'ledger.sqlite3').as_posix()}")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                org = Organization(name="Ledger tenant", code="LEDGER-T", org_type="client", lineage_path="")
                session.add(org)
                await session.flush()
                await append_entry(session, org_id=org.id, project_id=None, entry_type="credit", amount_minor=10000, currency="CNY", external_event_id="pay-1", metadata={"provider": "sandbox"})
                await append_entry(session, org_id=org.id, project_id=None, entry_type="debit", amount_minor=-1500, currency="CNY", external_event_id="invoice-1", metadata={"invoice": "sandbox"})
                await session.commit()
                entries = (await session.execute(select(BillingLedgerEntry).where(BillingLedgerEntry.org_id == org.id))).scalars().all()
                assert len(entries) == 2 and validate_chain(entries)
                entries[1].amount_minor = -1400
                assert not validate_chain(entries)
        finally:
            await engine.dispose()


def main() -> int:
    asyncio.run(verify())
    print("Billing ledger controls: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
