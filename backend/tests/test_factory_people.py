import asyncio
from datetime import date

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

import models  # noqa: F401
from core.database import Base
from core.tenant_context import build_tenant_context
from services.factory_people import FactoryPeopleService


def _context(tenant="tenant-people", plan="plan-57"):
    return build_tenant_context(
        agent_path=f"hq/{tenant}", tenant_id=tenant, client_id=f"client-{tenant}", plan_id=plan,
    )


async def _active_people_masters(service, context, *, project_id=57, employee_ref="EMP-001"):
    org = await service.create_org_unit(
        project_id=project_id, context=context, actor="org-author", unit_reference="PEOPLE-HQ",
        unit_code="PEOPLE-HQ", unit_name="People Headquarters", unit_type="company",
        parent_unit_id=None, erp_operating_unit_id=None, country_code="CN", timezone_name="Asia/Shanghai",
    )
    with pytest.raises(ValueError, match="independent"):
        await service.approve_org_unit(org["id"], project_id=project_id, actor="org-author",
                                      expected_revision=org["revision"], approval_reference="SELF")
    org = await service.approve_org_unit(
        org["id"], project_id=project_id, actor="org-approver",
        expected_revision=org["revision"], approval_reference="ORG-CONTROL-APPROVAL",
    )
    position = await service.create_position(
        project_id=project_id, context=context, actor="position-owner", org_unit_id=org["id"],
        position_reference="EXPORT-SALES-DIRECTOR", position_code="EXP-SALES-DIR",
        position_title="Export Sales Director", job_family="Commercial", employment_level="L6",
        planned_headcount=2, weekly_capacity_hours="40", critical_role=True,
    )
    employee = await service.create_employee(
        project_id=project_id, context=context, actor="employee-author",
        employee_reference=employee_ref, preferred_name="Ada Chen",
        work_email=f"{employee_ref.lower()}@factory.example", country_code="CN",
        source_type="hr-direct", source_reference=f"HR-ONBOARD-{employee_ref}",
        privacy_notice_reference="PRIVACY-NOTICE-2026-V1",
    )
    with pytest.raises(ValueError, match="independent"):
        await service.activate_employee(
            employee["id"], project_id=project_id, actor="employee-author",
            expected_revision=employee["revision"], activation_reference="SELF",
        )
    employee = await service.activate_employee(
        employee["id"], project_id=project_id, actor="identity-approver",
        expected_revision=employee["revision"], activation_reference="IDENTITY-CHECK-001",
    )
    return org, position, employee


async def _active_contract(service, context, position, employee, *, project_id=57, reference="CONTRACT-001"):
    contract = await service.create_contract(
        project_id=project_id, context=context, actor="contract-author", contract_reference=reference,
        employee_id=employee["id"], position_id=position["id"], employment_type="full-time",
        work_location="Shanghai", start_date=date(2026, 8, 1), end_date=None,
        weekly_hours="40", compensation_band="CN-L6-BAND",
        payroll_reference="PAYROLL-WORKER-001", signed_document_reference="DOCUSIGN-CONTRACT-001",
    )
    contract = await service.submit_contract(
        contract["id"], project_id=project_id, actor="contract-author",
        expected_revision=contract["revision"], evidence_reference="CONTRACT-SUBMIT-001",
    )
    with pytest.raises(ValueError, match="independent"):
        await service.approve_contract(
            contract["id"], project_id=project_id, actor="contract-author",
            expected_revision=contract["revision"], approval_reference="SELF",
        )
    return await service.approve_contract(
        contract["id"], project_id=project_id, actor="contract-approver",
        expected_revision=contract["revision"], approval_reference="LEGAL-HR-APPROVAL-001",
    )


def test_people_closes_employment_time_performance_and_training_controls():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context()
            service = FactoryPeopleService(db)
            _, position, employee = await _active_people_masters(service, context)
            contract = await _active_contract(service, context, position, employee)
            assert contract["status"] == "active"

            time_record = await service.create_time_record(
                project_id=57, context=context, actor="time-author", employee_id=employee["id"],
                period_code="2026-08", scheduled_hours="160", worked_hours="162",
                approved_absence_hours="8", overtime_hours="10", source_reference="TIMECLOCK-2026-08",
            )
            time_record = await service.submit_time_record(
                time_record["id"], project_id=57, actor="time-author",
                expected_revision=time_record["revision"], evidence_reference="TIME-SUBMIT-2026-08",
            )
            with pytest.raises(ValueError, match="independent"):
                await service.approve_time_record(
                    time_record["id"], project_id=57, actor="time-author",
                    expected_revision=time_record["revision"], approval_reference="SELF",
                )
            time_record = await service.approve_time_record(
                time_record["id"], project_id=57, actor="time-approver",
                expected_revision=time_record["revision"], approval_reference="TIME-APPROVAL-2026-08",
            )
            assert time_record["status"] == "approved"

            review = await service.create_performance_review(
                project_id=57, context=context, actor="manager", employee_id=employee["id"],
                cycle_code="2026-H2", goals_score="92", competency_score="88",
                evidence_reference="OKR-2026-H2", manager_comment="Exceeded export pipeline and team goals.",
            )
            with pytest.raises(ValueError, match="independent"):
                await service.calibrate_performance_review(
                    review["id"], project_id=57, actor="manager",
                    expected_revision=review["revision"], calibration_reference="SELF",
                )
            review = await service.calibrate_performance_review(
                review["id"], project_id=57, actor="talent-committee",
                expected_revision=review["revision"], calibration_reference="CALIBRATION-2026-H2",
            )
            assert review["status"] == "calibrated" and review["overall_score"] == "90.00"

            training = await service.assign_training(
                project_id=57, context=context, actor="learning-owner", employee_id=employee["id"],
                course_code="EXPORT-COMPLIANCE", course_title="Export Trade Compliance",
                mandatory=True, due_date=date(2027, 8, 31),
            )
            training = await service.complete_training(
                training["id"], project_id=57, actor="employee-recorder",
                expected_revision=training["revision"],
                completion_evidence_reference="LMS-CERTIFICATE-001", expires_at=date(2028, 8, 31),
            )
            with pytest.raises(ValueError, match="independent"):
                await service.verify_training(
                    training["id"], project_id=57, actor="employee-recorder",
                    expected_revision=training["revision"], verification_reference="SELF",
                )
            training = await service.verify_training(
                training["id"], project_id=57, actor="compliance-verifier",
                expected_revision=training["revision"], verification_reference="LMS-VERIFICATION-001",
            )
            assert training["status"] == "verified"

            workspace = await service.list_workspace(project_id=57)
            assert workspace["metrics"] == {
                "active_headcount": 1,
                "planned_headcount": 2,
                "critical_role_fill_rate": "100.00",
                "mandatory_training_compliance": "100.00",
            }
            assert workspace["contract"]["marketing_contact_import"] is False
            assert workspace["contract"]["raw_bank_tax_health_data_stored"] is False
            assert len(workspace["evidence"]) >= 14
            assert (await service.list_workspace(project_id=58))["employees"] == []
        await engine.dispose()
    asyncio.run(scenario())


def test_people_blocks_ungoverned_sources_overlap_unreconciled_time_and_stale_revision():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            context = _context()
            service = FactoryPeopleService(db)
            _, position, employee = await _active_people_masters(service, context)
            await _active_contract(service, context, position, employee)

            with pytest.raises(ValueError, match="governed source"):
                await service.create_employee(
                    project_id=57, context=context, actor="bad-import",
                    employee_reference="LEAD-001", preferred_name="Marketing Lead",
                    work_email="lead@factory.example", country_code="CN", source_type="marketing-contact",
                    source_reference="CRM-LEAD-001", privacy_notice_reference="CRM-CONSENT",
                )
            with pytest.raises(ValueError, match="reconcile"):
                await service.create_time_record(
                    project_id=57, context=context, actor="time-author", employee_id=employee["id"],
                    period_code="2026-09", scheduled_hours="160", worked_hours="170",
                    approved_absence_hours="8", overtime_hours="0", source_reference="BAD-TIME",
                )
            second = await service.create_contract(
                project_id=57, context=context, actor="contract-author-2", contract_reference="CONTRACT-002",
                employee_id=employee["id"], position_id=position["id"], employment_type="full-time",
                work_location="Shanghai", start_date=date(2027, 1, 1), end_date=None,
                weekly_hours="40", compensation_band="CN-L6-BAND",
                payroll_reference="PAYROLL-WORKER-001", signed_document_reference="DOCUSIGN-CONTRACT-002",
            )
            second = await service.submit_contract(
                second["id"], project_id=57, actor="contract-author-2",
                expected_revision=second["revision"], evidence_reference="SECOND-SUBMIT",
            )
            with pytest.raises(ValueError, match="active HR contract"):
                await service.approve_contract(
                    second["id"], project_id=57, actor="contract-approver-2",
                    expected_revision=second["revision"], approval_reference="SECOND-APPROVAL",
                )
            with pytest.raises(ValueError, match="revision conflict"):
                await service.approve_contract(
                    second["id"], project_id=57, actor="contract-approver-2",
                    expected_revision=999, approval_reference="STALE",
                )
        await engine.dispose()
    asyncio.run(scenario())


def test_people_enforces_tenant_scoped_master_uniqueness():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            service = FactoryPeopleService(db)
            _, _, employee_a = await _active_people_masters(service, _context("tenant-a"), project_id=57)
            _, _, employee_b = await _active_people_masters(service, _context("tenant-b"), project_id=58)
            assert employee_a["employee_reference"] == employee_b["employee_reference"] == "EMP-001"
            with pytest.raises(KeyError, match="not found"):
                await service.activate_employee(
                    employee_a["id"], project_id=58, actor="cross-tenant",
                    expected_revision=employee_a["revision"], activation_reference="INVALID",
                )
        await engine.dispose()
    asyncio.run(scenario())
