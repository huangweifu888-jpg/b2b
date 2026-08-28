"""Run the local HTTP business flow: provision, signed payment, reporting, and support."""

from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
from pathlib import Path

import httpx


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

import models  # noqa: E402,F401
from core.database import Base, get_db  # noqa: E402
from dependencies.auth import get_current_user  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from models.platform import Organization  # noqa: E402
from routers.business_operations import router  # noqa: E402
from schemas.auth import UserResponse  # noqa: E402
from services.integration_security import sign_webhook  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402


async def run_flow() -> dict[str, object]:
    with tempfile.TemporaryDirectory(prefix="b2b-local-business-flow-") as directory:
        engine = create_async_engine(f"sqlite+aiosqlite:///{Path(directory, 'flow.sqlite3').as_posix()}")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        app = FastAPI()
        app.include_router(router)

        async def override_db():
            async with sessions() as session:
                yield session

        async def override_user():
            return UserResponse(id="hq-admin", email="admin@example.test", name="HQ", role="admin")

        app.dependency_overrides[get_db] = override_db
        app.dependency_overrides[get_current_user] = override_user
        previous_secret = os.environ.get("PAYMENT_WEBHOOK_SECRET")
        secret = "local-payment-webhook-secret"
        os.environ["PAYMENT_WEBHOOK_SECRET"] = secret
        try:
            async with sessions() as session:
                hq = Organization(name="HQ", code="HQ-FLOW", org_type="hq", lineage_path="", status="active")
                session.add(hq)
                await session.flush()
                agency = Organization(name="Agency", code="AGENCY-FLOW", org_type="agency", parent_id=hq.id, root_org_id=hq.id, agent_level=1, lineage_path=str(hq.id), status="active")
                session.add(agency)
                await session.commit()
                agency_id = agency.id
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://local.test") as client:
                provision = await client.post("/api/v1/business-operations/provision", json={"agency_org_id": agency_id, "client_name": "Flow Client", "client_code": "FLOW-CLIENT", "plan_name": "Flow Plan", "plan_code": "FLOW-PLAN"})
                assert provision.status_code == 201, provision.text
                provisioned = provision.json()
                payment_body = {"org_id": provisioned["client_org_id"], "project_id": provisioned["project_id"], "event_id": "evt-flow-1", "event_type": "payment_succeeded", "amount_minor": 12800, "currency": "CNY"}
                raw = json.dumps(payment_body, separators=(",", ":")).encode("utf-8")
                payment = await client.post("/api/v1/business-operations/payment-callback", content=raw, headers={"content-type": "application/json", "X-Payment-Signature": sign_webhook(raw, secret)})
                assert payment.status_code == 200, payment.text
                duplicate = await client.post("/api/v1/business-operations/payment-callback", content=raw, headers={"content-type": "application/json", "X-Payment-Signature": sign_webhook(raw, secret)})
                assert duplicate.status_code == 200 and duplicate.json()["created"] is False, duplicate.text
                ticket = await client.post("/api/v1/business-operations/tickets", json={"org_id": provisioned["client_org_id"], "project_id": provisioned["project_id"], "subject": "Local flow verification", "severity": "sev2"})
                assert ticket.status_code == 201, ticket.text
                ledger = await client.get("/api/v1/business-operations/ledger", params={"org_id": provisioned["client_org_id"]})
                analytics = await client.get("/api/v1/business-operations/analytics", params={"org_id": provisioned["client_org_id"]})
                tickets = await client.get("/api/v1/business-operations/tickets", params={"org_id": provisioned["client_org_id"]})
                assert ledger.status_code == analytics.status_code == tickets.status_code == 200
                assert len(ledger.json()["items"]) == 1 and analytics.json()["metrics"]["net_revenue_minor"] == 12800 and len(tickets.json()["items"]) == 1
                return {"status": "passed", "client_org_id": provisioned["client_org_id"], "project_id": provisioned["project_id"], "ledger_entries": len(ledger.json()["items"]), "net_revenue_minor": analytics.json()["metrics"]["net_revenue_minor"], "support_tickets": len(tickets.json()["items"]), "duplicate_payment_created": duplicate.json()["created"]}
        finally:
            if previous_secret is None:
                os.environ.pop("PAYMENT_WEBHOOK_SECRET", None)
            else:
                os.environ["PAYMENT_WEBHOOK_SECRET"] = previous_secret
            await engine.dispose()


def main() -> int:
    print(json.dumps(asyncio.run(run_flow()), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
