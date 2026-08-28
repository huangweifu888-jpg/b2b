"""Tenant-scoped configuration and release APIs for Factory Platform industry packs."""

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_industry_pack import FactoryIndustryPackService
from services.tenant_access import require_project_access
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/industry-packs", tags=["factory-platform-industry-packs"])


class IndustryPackCreate(BaseModel):
    segment: str = Field(default="industrial-pump-valve", min_length=1, max_length=100)


class IndustryPackUpdate(BaseModel):
    expected_revision: int = Field(gt=0)
    configuration: dict[str, str]
    evidence: dict[str, str]


class IndustryPackAction(BaseModel):
    expected_revision: int = Field(gt=0)


@router.get("")
async def list_industry_packs(project_id: int, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return {"items": await FactoryIndustryPackService(db).list(project_id=project_id)}


@router.post("")
async def create_industry_pack(project_id: int, payload: IndustryPackCreate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    resolved = await require_project_access(db, current_user=current_user, project_id=project_id)
    try:
        item = await FactoryIndustryPackService(db).create(project_id=project_id, context=resolved.context, actor=current_user.id, segment=payload.segment)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_industry_pack_created", actor_user_id=current_user.id, target_type="factory_industry_pack_installation", target_id=item["id"], ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "segment": item["segment"], "package_version": item["package_version"]})
    await db.commit(); return item


@router.patch("/{installation_id}")
async def update_industry_pack(project_id: int, installation_id: str, payload: IndustryPackUpdate, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    try:
        item = await FactoryIndustryPackService(db).update(installation_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id, configuration=payload.configuration, evidence=payload.evidence)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action="factory_industry_pack_updated", actor_user_id=current_user.id, target_type="factory_industry_pack_installation", target_id=installation_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "revision": item["revision"]})
    await db.commit(); return item


async def _transition(project_id: int, installation_id: str, payload: IndustryPackAction, request: Request, db: AsyncSession, current_user: UserResponse, action: str):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    service = FactoryIndustryPackService(db)
    try:
        item = await (service.validate(installation_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id) if action == "validated" else service.publish(installation_id, project_id=project_id, expected_revision=payload.expected_revision, actor=current_user.id))
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(db, action=f"factory_industry_pack_{action}", actor_user_id=current_user.id, target_type="factory_industry_pack_installation", target_id=installation_id, ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "revision": item["revision"], "package_version": item["package_version"]})
    await db.commit(); return item


@router.post("/{installation_id}/validate")
async def validate_industry_pack(project_id: int, installation_id: str, payload: IndustryPackAction, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _transition(project_id, installation_id, payload, request, db, current_user, "validated")


@router.post("/{installation_id}/publish")
async def publish_industry_pack(project_id: int, installation_id: str, payload: IndustryPackAction, request: Request, db: AsyncSession = Depends(get_db), current_user: UserResponse = Depends(get_current_user)):
    return await _transition(project_id, installation_id, payload, request, db, current_user, "published")
