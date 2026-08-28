import asyncio
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from services.factory_crm import FactoryCrmService

def context(): return build_tenant_context(agent_path="org/a", tenant_id="tenant-a", client_id="client-a", plan_id="plan-7")

def test_crm_requires_independent_account_verification_and_evidenced_stage_transitions():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            service=FactoryCrmService(db)
            account=await service.create_account(project_id=7,context=context(),actor="author",account_reference="ACCOUNT-001",account_name="Factory Buyer",market="overseas")
            with pytest.raises(ValueError,match="independent"): await service.verify_account(account["id"],project_id=7,expected_revision=1,actor="author",reference="VERIFY-1",note="Independent verification evidence")
            account=await service.verify_account(account["id"],project_id=7,expected_revision=1,actor="reviewer",reference="VERIFY-1",note="Independent verification evidence")
            opportunity=await service.create_opportunity(project_id=7,context=context(),actor="sales",account_id=account["id"],opportunity_key="OPP-001",title="Factory line upgrade",currency="USD",amount_cents=250000,owner_team="sales")
            with pytest.raises(ValueError,match="stage changed"): await service.advance_opportunity(opportunity["id"],project_id=7,expected_revision=1,actor="sales",stage="won",reference="CLOSE-1",note="Signed purchase order received")
            opportunity=await service.advance_opportunity(opportunity["id"],project_id=7,expected_revision=1,actor="sales",stage="proposal",reference="PROPOSAL-1",note="Approved technical and commercial proposal")
            opportunity=await service.advance_opportunity(opportunity["id"],project_id=7,expected_revision=2,actor="sales",stage="won",reference="CLOSE-1",note="Signed purchase order received")
            assert opportunity["stage"]=="won" and opportunity["close_reference"]=="CLOSE-1"
            workspace=await service.workspace(7)
            assert workspace["contract"]["raw_personal_contacts_stored"] is False
            assert {x["event_type"] for x in workspace["evidence"]}=={"account-created","account-verified","opportunity-created","opportunity-proposal","opportunity-won"}
        await engine.dispose()
    asyncio.run(scenario())
