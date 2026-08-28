import asyncio
import pytest
from datetime import datetime,timezone
from sqlalchemy.ext.asyncio import create_async_engine,async_sessionmaker
import models
from core.database import Base
from core.tenant_context import build_tenant_context
from models.factory_finance import FactoryFinanceDocument
from models.factory_revenue_profit import FactoryRevenueProfitRun
from services.factory_budget_attribution import FactoryBudgetAttributionService as S
def ctx():return build_tenant_context(agent_path="hq/budget",tenant_id="tenant-budget",client_id="client-budget",plan_id="plan-97")
def test_budget_allocation_requires_finance_budget_published_attribution_and_independent_controls():
 async def run():
  e=create_async_engine("sqlite+aiosqlite:///:memory:")
  async with e.begin()as c:await c.run_sync(Base.metadata.create_all)
  async with async_sessionmaker(e,expire_on_commit=False)()as db:
   c=ctx();now=datetime.now(timezone.utc)
   db.add(FactoryFinanceDocument(id="finance-budget",project_id=97,agent_path=c.agent_path,tenant_id=c.tenant_id,client_id=c.client_id,plan_id=c.plan_id,document_number="FIN-97-BUDGET",document_reference="FIN-BUDGET-97",document_type="budget",book_id="book",book_number="BOOK",period_id="period",period_number="PERIOD",document_date=now.date(),source_type="finance",counterparty_reference="marketing",currency="USD",amount="1000",settled_amount="0",description="Approved marketing budget",source_evidence_reference="finance:budget",status="approved",authored_by="finance",approval_reference="approved",approved_by="finance-approver",approved_at=now))
   db.add(FactoryRevenueProfitRun(id="run-published",project_id=97,agent_path=c.agent_path,tenant_id=c.tenant_id,client_id=c.client_id,plan_id=c.plan_id,run_number="RPR-97-1",analysis_reference="analysis-97",binding_id="binding",binding_number="BIND",policy_id="policy",policy_version_id="policy-v1",policy_version_number=1,policy_fingerprint="a"*64,model_type="linear",correlation_id="corr",account_reference="account",currency="USD",recognized_revenue="1000",governed_sales_cost="500",marketing_spend="100",contribution_margin="400",contribution_margin_percent="40",touchpoint_count=1,profit_classification="management-contribution-estimate",status="published",calculated_by="calc",calculated_at=now,verified_by="verify",verified_at=now))
   await db.flush();s=S(db);x=await s.create(project_id=97,context=c,actor="author",allocation_reference="BUDGET-97-A",finance_document_reference="FIN-BUDGET-97",attribution_run_id="run-published",channel="google",campaign_reference="search-product",proposed_amount="250")
   with pytest.raises(ValueError,match="independent"):await s.verify(x["id"],project_id=97,actor="author",expected_revision=1,reference="VERIFY")
   x=await s.verify(x["id"],project_id=97,actor="reviewer",expected_revision=1,reference="VERIFY")
   with pytest.raises(ValueError,match="independent"):await s.accept(x["id"],project_id=97,actor="reviewer",expected_revision=2,reference="ACCEPT")
   y=await s.accept(x["id"],project_id=97,actor="owner",expected_revision=2,reference="ACCEPT")
   assert y["status"]=="accepted" and (await s.workspace(97))["contract"]["external_ad_budget_changed"] is False
  await e.dispose()
 asyncio.run(run())
