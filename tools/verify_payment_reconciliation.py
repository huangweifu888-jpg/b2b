"""Exercise signed payment reconciliation and duplicate-event protection."""

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
from services.integration_security import sign_webhook  # noqa: E402
from services.payment_reconciliation import PaymentEvent, reconcile_payment_event  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402


async def verify() -> None:
    with tempfile.TemporaryDirectory(prefix="b2b-payment-") as directory:
        engine = create_async_engine(f"sqlite+aiosqlite:///{Path(directory, 'payment.sqlite3').as_posix()}")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        try:
            async with async_sessionmaker(engine, expire_on_commit=False)() as session:
                org = Organization(name="Payment tenant", code="PAYMENT-T", org_type="client", lineage_path="")
                session.add(org)
                await session.flush()
                raw, secret = b'{"event":"payment_succeeded"}', "payment-webhook-secret"
                event = PaymentEvent(event_id="evt-payment-1", event_type="payment_succeeded", amount_minor=10000, currency="CNY")
                entry, created = await reconcile_payment_event(session, org_id=org.id, event=event, raw_payload=raw, signature=sign_webhook(raw, secret), signing_secret=secret)
                same, duplicate_created = await reconcile_payment_event(session, org_id=org.id, event=event, raw_payload=raw, signature=sign_webhook(raw, secret), signing_secret=secret)
                assert created and not duplicate_created and entry.id == same.id and entry.amount_minor == 10000
        finally:
            await engine.dispose()


def main() -> int:
    asyncio.run(verify())
    print("Payment reconciliation: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
