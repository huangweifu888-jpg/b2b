"""Tenant-scoped governed HR people, employment and capability APIs."""

from datetime import date
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_people import FactoryPeopleService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/people", tags=["factory-platform-people"])
MASTER_MANAGE = "factory.operations.people.master.manage"
MASTER_APPROVE = "factory.operations.people.master.approve"
CONTRACT_MANAGE = "factory.operations.people.contract.manage"
CONTRACT_APPROVE = "factory.operations.people.contract.approve"
TIME_MANAGE = "factory.operations.people.time.manage"
TIME_APPROVE = "factory.operations.people.time.approve"
PERFORMANCE_MANAGE = "factory.operations.people.performance.manage"
PERFORMANCE_CALIBRATE = "factory.operations.people.performance.calibrate"
TRAINING_MANAGE = "factory.operations.people.training.manage"
TRAINING_VERIFY = "factory.operations.people.training.verify"


class OrgUnitCreate(BaseModel):
    unit_reference: str = Field(min_length=1, max_length=255)
    unit_code: str = Field(min_length=2, max_length=100)
    unit_name: str = Field(min_length=1, max_length=255)
    unit_type: Literal["company", "business-unit", "department", "team", "factory"]
    parent_unit_id: str | None = Field(default=None, max_length=100)
    erp_operating_unit_id: str | None = Field(default=None, max_length=100)
    country_code: str = Field(pattern=r"^[A-Za-z]{2}$")
    timezone_name: str = Field(min_length=1, max_length=100)


class PositionCreate(BaseModel):
    org_unit_id: str = Field(min_length=1, max_length=100)
    position_reference: str = Field(min_length=1, max_length=255)
    position_code: str = Field(min_length=2, max_length=100)
    position_title: str = Field(min_length=1, max_length=255)
    job_family: str = Field(min_length=1, max_length=100)
    employment_level: str = Field(min_length=1, max_length=40)
    planned_headcount: int = Field(ge=1, le=100000)
    weekly_capacity_hours: str = Field(min_length=1, max_length=20)
    critical_role: bool = False


class EmployeeCreate(BaseModel):
    employee_reference: str = Field(min_length=1, max_length=255)
    preferred_name: str = Field(min_length=1, max_length=255)
    work_email: EmailStr
    country_code: str = Field(pattern=r"^[A-Za-z]{2}$")
    source_type: Literal["hr-direct", "recruiting-offer", "migration"]
    source_reference: str = Field(min_length=1, max_length=500)
    privacy_notice_reference: str = Field(min_length=1, max_length=500)


class ContractCreate(BaseModel):
    contract_reference: str = Field(min_length=1, max_length=255)
    employee_id: str = Field(min_length=1, max_length=100)
    position_id: str = Field(min_length=1, max_length=100)
    employment_type: Literal["full-time", "part-time", "fixed-term", "contractor", "intern"]
    work_location: str = Field(min_length=1, max_length=255)
    start_date: date
    end_date: date | None = None
    weekly_hours: str = Field(min_length=1, max_length=20)
    compensation_band: str = Field(min_length=1, max_length=100)
    payroll_reference: str = Field(min_length=1, max_length=500)
    signed_document_reference: str = Field(min_length=1, max_length=500)


class TimeRecordCreate(BaseModel):
    employee_id: str = Field(min_length=1, max_length=100)
    period_code: str = Field(pattern=r"^20\d{2}-(0[1-9]|1[0-2])$")
    scheduled_hours: str = Field(min_length=1, max_length=20)
    worked_hours: str = Field(min_length=1, max_length=20)
    approved_absence_hours: str = Field(min_length=1, max_length=20)
    overtime_hours: str = Field(min_length=1, max_length=20)
    source_reference: str = Field(min_length=1, max_length=500)


class PerformanceReviewCreate(BaseModel):
    employee_id: str = Field(min_length=1, max_length=100)
    cycle_code: str = Field(min_length=1, max_length=40)
    goals_score: str = Field(min_length=1, max_length=20)
    competency_score: str = Field(min_length=1, max_length=20)
    evidence_reference: str = Field(min_length=1, max_length=500)
    manager_comment: str = Field(min_length=8, max_length=4000)


class TrainingAssign(BaseModel):
    employee_id: str = Field(min_length=1, max_length=100)
    course_code: str = Field(min_length=2, max_length=100)
    course_title: str = Field(min_length=1, max_length=255)
    mandatory: bool = False
    due_date: date


class TrainingComplete(BaseModel):
    expected_revision: int = Field(gt=0)
    completion_evidence_reference: str = Field(min_length=1, max_length=500)
    expires_at: date | None = None


class RevisionEvidence(BaseModel):
    expected_revision: int = Field(gt=0)
    evidence_reference: str = Field(min_length=1, max_length=500)


def _raise(exc: Exception):
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _audit(db: AsyncSession, request: Request, user: UserResponse, *, action: str,
           target_type: str, item: dict[str, object], project_id: int):
    number = next((item.get(key) for key in (
        "unit_number", "position_number", "employee_number", "contract_number",
        "time_number", "review_number", "training_number",
    ) if item.get(key)), None)
    record_audit_event(
        db, action=action, actor_user_id=user.id, project_id=project_id,
        target_type=target_type, target_id=str(item["id"]),
        ip_address=request.client.host if request.client else None,
        detail={"project_id": project_id, "number": number, "status": item.get("status"),
                "revision": item.get("revision")},
    )


async def _permission(db, user, project_id, permission):
    return await require_project_permission(db, current_user=user, project_id=project_id, permission=permission)


async def _run(db, request, user, project_id, permission, action, target_type, method, **kwargs):
    resolved = await _permission(db, user, project_id, permission)
    try:
        item = await method(project_id=project_id, actor=user.id, **kwargs,
                            **({"context": resolved.context} if "context" not in kwargs and method.__name__.startswith(("create_", "assign_")) else {}))
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, user, action=action, target_type=target_type, item=item, project_id=project_id)
    await db.commit()
    return item


@router.get("")
async def workspace(project_id: int, db: AsyncSession = Depends(get_db),
                    current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryPeopleService(db).list_workspace(project_id=project_id)


@router.post("/org-units")
async def create_org_unit(project_id: int, payload: OrgUnitCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, MASTER_MANAGE, "factory_people_org_unit_created", "factory_people_org_unit", FactoryPeopleService(db).create_org_unit, **payload.model_dump())


@router.post("/org-units/{item_id}/approve")
async def approve_org_unit(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, MASTER_APPROVE, "factory_people_org_unit_activated", "factory_people_org_unit", FactoryPeopleService(db).approve_org_unit, item_id=item_id, expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)


@router.post("/positions")
async def create_position(project_id: int, payload: PositionCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, MASTER_MANAGE, "factory_people_position_created", "factory_people_position", FactoryPeopleService(db).create_position, **payload.model_dump())


@router.post("/employees")
async def create_employee(project_id: int, payload: EmployeeCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, MASTER_MANAGE, "factory_people_employee_created", "factory_people_employee", FactoryPeopleService(db).create_employee, **payload.model_dump())


@router.post("/employees/{item_id}/activate")
async def activate_employee(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, MASTER_APPROVE, "factory_people_employee_activated", "factory_people_employee", FactoryPeopleService(db).activate_employee, item_id=item_id, expected_revision=payload.expected_revision, activation_reference=payload.evidence_reference)


@router.post("/contracts")
async def create_contract(project_id: int, payload: ContractCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, CONTRACT_MANAGE, "factory_people_contract_created", "factory_people_contract", FactoryPeopleService(db).create_contract, **payload.model_dump())


@router.post("/contracts/{item_id}/submit")
async def submit_contract(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, CONTRACT_MANAGE, "factory_people_contract_submitted", "factory_people_contract", FactoryPeopleService(db).submit_contract, item_id=item_id, expected_revision=payload.expected_revision, evidence_reference=payload.evidence_reference)


@router.post("/contracts/{item_id}/approve")
async def approve_contract(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, CONTRACT_APPROVE, "factory_people_contract_activated", "factory_people_contract", FactoryPeopleService(db).approve_contract, item_id=item_id, expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)


@router.post("/time-records")
async def create_time_record(project_id: int, payload: TimeRecordCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, TIME_MANAGE, "factory_people_time_record_created", "factory_people_time_record", FactoryPeopleService(db).create_time_record, **payload.model_dump())


@router.post("/time-records/{item_id}/submit")
async def submit_time_record(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, TIME_MANAGE, "factory_people_time_record_submitted", "factory_people_time_record", FactoryPeopleService(db).submit_time_record, item_id=item_id, expected_revision=payload.expected_revision, evidence_reference=payload.evidence_reference)


@router.post("/time-records/{item_id}/approve")
async def approve_time_record(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, TIME_APPROVE, "factory_people_time_record_approved", "factory_people_time_record", FactoryPeopleService(db).approve_time_record, item_id=item_id, expected_revision=payload.expected_revision, approval_reference=payload.evidence_reference)


@router.post("/performance-reviews")
async def create_performance_review(project_id: int, payload: PerformanceReviewCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, PERFORMANCE_MANAGE, "factory_people_performance_review_created", "factory_people_performance_review", FactoryPeopleService(db).create_performance_review, **payload.model_dump())


@router.post("/performance-reviews/{item_id}/calibrate")
async def calibrate_performance_review(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, PERFORMANCE_CALIBRATE, "factory_people_performance_review_calibrated", "factory_people_performance_review", FactoryPeopleService(db).calibrate_performance_review, item_id=item_id, expected_revision=payload.expected_revision, calibration_reference=payload.evidence_reference)


@router.post("/training")
async def assign_training(project_id: int, payload: TrainingAssign, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, TRAINING_MANAGE, "factory_people_training_assigned", "factory_people_training", FactoryPeopleService(db).assign_training, **payload.model_dump())


@router.post("/training/{item_id}/complete")
async def complete_training(project_id: int, item_id: str, payload: TrainingComplete, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, TRAINING_MANAGE, "factory_people_training_completed", "factory_people_training", FactoryPeopleService(db).complete_training, item_id=item_id, **payload.model_dump())


@router.post("/training/{item_id}/verify")
async def verify_training(project_id: int, item_id: str, payload: RevisionEvidence, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _run(db, request, current_user, project_id, TRAINING_VERIFY, "factory_people_training_verified", "factory_people_training", FactoryPeopleService(db).verify_training, item_id=item_id, expected_revision=payload.expected_revision, verification_reference=payload.evidence_reference)
