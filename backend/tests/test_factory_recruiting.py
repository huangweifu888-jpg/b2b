import asyncio
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from services.factory_people import FactoryPeopleService
from services.factory_recruiting import FactoryRecruitingService


def _context(tenant="tenant-recruiting", plan="plan-58"):
    return build_tenant_context(agent_path=f"hq/{tenant}",tenant_id=tenant,client_id=f"client-{tenant}",plan_id=plan)


async def _position(db, context, project_id=58):
    people=FactoryPeopleService(db)
    org=await people.create_org_unit(project_id=project_id,context=context,actor="org-author",unit_reference="REC-HQ",unit_code="REC-HQ",unit_name="Recruiting HQ",unit_type="company",parent_unit_id=None,erp_operating_unit_id=None,country_code="CN",timezone_name="Asia/Shanghai")
    org=await people.approve_org_unit(org["id"],project_id=project_id,actor="org-approver",expected_revision=org["revision"],approval_reference="REC-ORG-APPROVAL")
    return await people.create_position(project_id=project_id,context=context,actor="position-owner",org_unit_id=org["id"],position_reference="EXPORT-ENGINEER",position_code="EXPORT-ENGINEER",position_title="Export Solution Engineer",job_family="Engineering",employment_level="L5",planned_headcount=2,weekly_capacity_hours="40",critical_role=True)


async def _open_requisition(service, context, position, project_id=58, openings=1):
    req=await service.create_requisition(project_id=project_id,context=context,actor="hiring-author",requisition_reference=f"REQ-{openings}",position_id=position["id"],opening_count=openings,employment_type="full-time",work_location="Shanghai",target_start_date=date(2027,1,15),hiring_reason="Approved capacity gap for export engineering growth.",rubric_version="RUBRIC-2026-V1",rubric={"skills":"Demonstrated technical depth","evidence":"Cited work evidence","communication":"Buyer communication","integrity":"Compliance judgment"})
    with pytest.raises(ValueError,match="independent"):
        await service.approve_requisition(req["id"],project_id=project_id,actor="hiring-author",expected_revision=req["revision"],approval_reference="SELF")
    return await service.approve_requisition(req["id"],project_id=project_id,actor="hiring-approver",expected_revision=req["revision"],approval_reference="WORKFORCE-PLAN-APPROVAL")


def test_recruiting_closes_consent_interview_offer_and_hr_handoff():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            context=_context(); position=await _position(db,context); service=FactoryRecruitingService(db)
            req=await _open_requisition(service,context,position)
            with pytest.raises(ValueError,match="explicit recruiting source"):
                await service.create_candidate(project_id=58,context=context,actor="recruiter",candidate_reference="BAD-LEAD",display_name="CRM Lead",email="lead@example.com",country_code="CN",source_type="marketing-contact",source_reference="CRM-1",consent_reference="CONSENT",privacy_notice_reference="NOTICE",retention_until=date(2027,12,31),profile_reference="PROFILE")
            candidate=await service.create_candidate(project_id=58,context=context,actor="recruiter",candidate_reference="CAN-001",display_name="Lin Candidate",email="lin.candidate@example.com",country_code="CN",source_type="candidate-direct",source_reference="CAREERS-PORTAL-001",consent_reference="CONSENT-001",privacy_notice_reference="PRIVACY-2026-V1",retention_until=date(2027,12,31),profile_reference="ATS-PROFILE-001")
            app=await service.submit_application(project_id=58,context=context,actor="candidate-intake",requisition_id=req["id"],candidate_id=candidate["id"],application_reference="APPLICATION-001",submitted_evidence_reference="PORTAL-SUBMISSION-001")
            interview=await service.schedule_interview(project_id=58,context=context,actor="scheduler",application_id=app["id"],interview_type="structured-ai-assisted",scheduled_at=datetime.now(timezone.utc)+timedelta(days=3),interviewer_reference="INTERVIEW-PANEL-001")
            completed=await service.complete_interview(interview["id"],project_id=58,actor="interview-assessor",expected_revision=interview["revision"],skills_score="92",evidence_score="88",communication_score="90",integrity_score="94",transcript_reference="TRANSCRIPT-001",citation_references=["TRANSCRIPT-001#answer-2","TRANSCRIPT-001#answer-5"],assessor_comment="Strong evidence-backed technical and buyer communication performance.",ai_assisted=True,ai_model_reference="MODEL-INTERVIEW-2026-V1")
            assert completed["assessment"]["overall_score"]=="91.00"
            assert completed["assessment"]["ai_autonomous_decision"] is False
            current=await service.list_workspace(project_id=58); app=next(x for x in current["applications"] if x["id"]==app["id"])
            with pytest.raises(ValueError,match="independent"):
                await service.decide_application(app["id"],project_id=58,actor="interview-assessor",expected_revision=app["revision"],decision="advance",decision_reason="Same assessor cannot make final decision.",decision_reference="SELF")
            app=await service.decide_application(app["id"],project_id=58,actor="hiring-committee",expected_revision=app["revision"],decision="advance",decision_reason="Human committee verified evidence and approved advancement.",decision_reference="COMMITTEE-MINUTES-001")
            offer=await service.create_offer(project_id=58,context=context,actor="offer-author",application_id=app["id"],offer_reference="OFFER-001",proposed_start_date=date(2027,2,1),compensation_band="CN-L5-BAND",offer_document_reference="OFFER-DOC-001")
            with pytest.raises(ValueError,match="independent"):
                await service.approve_offer(offer["id"],project_id=58,actor="offer-author",expected_revision=offer["revision"],approval_reference="SELF")
            offer=await service.approve_offer(offer["id"],project_id=58,actor="offer-approver",expected_revision=offer["revision"],approval_reference="OFFER-APPROVAL-001")
            offer=await service.send_offer(offer["id"],project_id=58,actor="recruiter",expected_revision=offer["revision"],delivery_reference="SIGNED-DELIVERY-001")
            offer=await service.respond_offer(offer["id"],project_id=58,actor="candidate-response-recorder",expected_revision=offer["revision"],response="accepted",response_reference="CANDIDATE-ACCEPTANCE-001")
            assert offer["status"]=="accepted"
            workspace=await service.list_workspace(project_id=58); handoff=workspace["onboarding_handoffs"][0]
            assert handoff["status"]=="ready" and workspace["contract"]["ai_autonomous_decision"] is False
            people=FactoryPeopleService(db)
            employee=await people.create_employee(project_id=58,context=context,actor="hr-author",employee_reference="EMP-FROM-OFFER-001",preferred_name="Lin Employee",work_email="lin.employee@factory.example",country_code="CN",source_type="recruiting-offer",source_reference=handoff["source_reference"],privacy_notice_reference="EMPLOYEE-PRIVACY-001")
            employee=await people.activate_employee(employee["id"],project_id=58,actor="hr-approver",expected_revision=employee["revision"],activation_reference="IDENTITY-ONBOARDING-001")
            assert employee["status"]=="active"
            workspace=await service.list_workspace(project_id=58)
            assert workspace["onboarding_handoffs"][0]["status"]=="consumed"
            assert workspace["onboarding_handoffs"][0]["consumed_employee_id"]==employee["id"]
            assert (await service.list_workspace(project_id=59))["candidates"]==[]
        await engine.dispose()
    asyncio.run(scenario())


def test_recruiting_blocks_overstaffing_missing_consent_stale_write_and_fake_hr_source():
    async def scenario():
        engine=create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection: await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine,expire_on_commit=False)() as db:
            context=_context(); position=await _position(db,context); service=FactoryRecruitingService(db)
            req=await _open_requisition(service,context,position,openings=2)
            with pytest.raises(ValueError,match="position plan"):
                await service.create_requisition(project_id=58,context=context,actor="hiring-author",requisition_reference="REQ-OVER",position_id=position["id"],opening_count=1,employment_type="full-time",work_location="Shanghai",target_start_date=date(2027,2,1),hiring_reason="This exceeds the governed headcount plan.",rubric_version="R1",rubric={"skills":"x","evidence":"x","communication":"x","integrity":"x"})
            with pytest.raises(ValueError,match="revision conflict"):
                await service.approve_requisition(req["id"],project_id=58,actor="other",expected_revision=999,approval_reference="STALE")
            with pytest.raises(ValueError,match="ready handoff"):
                await FactoryPeopleService(db).create_employee(project_id=58,context=context,actor="hr-author",employee_reference="FAKE-OFFER",preferred_name="Fake",work_email="fake@factory.example",country_code="CN",source_type="recruiting-offer",source_reference="accepted-offer:FAKE",privacy_notice_reference="NOTICE")
            with pytest.raises(ValueError,match="future retention"):
                await service.create_candidate(project_id=58,context=context,actor="recruiter",candidate_reference="EXPIRED",display_name="Expired",email="expired@example.com",country_code="CN",source_type="candidate-direct",source_reference="PORTAL",consent_reference="CONSENT",privacy_notice_reference="NOTICE",retention_until=date(2026,1,1),profile_reference="PROFILE")
        await engine.dispose()
    asyncio.run(scenario())
