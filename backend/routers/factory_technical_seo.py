"""Permissioned technical SEO evidence and remediation handoff APIs."""
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_technical_seo import FactoryTechnicalSeoService
from services.tenant_access import require_project_access, require_project_permission

router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/technical-seo", tags=["factory-platform-technical-seo"])
MANAGE = "factory.trust.technical-seo.audit.manage"; VERIFY = "factory.trust.technical-seo.snapshot.verify"; APPROVE = "factory.trust.technical-seo.release.approve"; ACK = "factory.trust.technical-seo.handoff.acknowledge"
class AuditCreate(BaseModel): site_reference: str = Field(min_length=2, max_length=255); audit_reference: str = Field(min_length=2, max_length=255); public_scope: str = Field(min_length=2, max_length=255)
class SnapshotCreate(BaseModel): evidence_manifest: dict[str, Any]
class ReleaseCreate(BaseModel): target: str = Field(pattern="^(site-owner|web-team|seo-operations)$"); remediation_manifest: dict[str, Any]; rollback_reference: str = Field(min_length=1, max_length=255)
class RevisionReference(BaseModel): expected_revision: int = Field(gt=0); reference: str = Field(min_length=1, max_length=255)
def _fail(error: Exception) -> None: raise HTTPException(status_code=404 if isinstance(error, KeyError) else 409, detail=str(error)) from error
async def _run(db: AsyncSession, request: Request, user: UserResponse, project_id: int, permission: str, action: str, target_type: str, operation: Any, *, context: bool = False, **kwargs: Any) -> dict[str, object]:
    await require_project_access(db, current_user=user, project_id=project_id); resolved = await require_project_permission(db, current_user=user, project_id=project_id, permission=permission)
    try: item = await operation(project_id=project_id, actor=user.id, **({"context": resolved.context} if context else {}), **kwargs)
    except (KeyError, ValueError) as error: _fail(error)
    record_audit_event(db, action=action, actor_user_id=user.id, project_id=project_id, target_type=target_type, target_id=str(item.get("id")), ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "status": item.get("status"), "revision": item.get("revision")}); await db.commit(); return item
@router.get("")
async def workspace(project_id: int, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_project_access(db, current_user=current_user, project_id=project_id); return await FactoryTechnicalSeoService(db).workspace(project_id=project_id)
@router.post("/audits")
async def create_audit(project_id: int, payload: AuditCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _run(db, request, current_user, project_id, MANAGE, "factory.technical-seo.audit.create", "factory-technical-seo-audit", FactoryTechnicalSeoService(db).create_audit, context=True, **payload.model_dump())
@router.post("/audits/{audit_id}/snapshots")
async def capture_snapshot(project_id: int, audit_id: str, payload: SnapshotCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _run(db, request, current_user, project_id, MANAGE, "factory.technical-seo.snapshot.capture", "factory-technical-seo-snapshot", FactoryTechnicalSeoService(db).capture_snapshot, context=True, audit_id=audit_id, **payload.model_dump())
@router.post("/snapshots/{snapshot_id}/verify")
async def verify_snapshot(project_id: int, snapshot_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _run(db, request, current_user, project_id, VERIFY, "factory.technical-seo.snapshot.verify", "factory-technical-seo-snapshot", FactoryTechnicalSeoService(db).verify_snapshot, snapshot_id=snapshot_id, expected_revision=payload.expected_revision, verification_reference=payload.reference)
@router.post("/snapshots/{snapshot_id}/releases")
async def prepare_release(project_id: int, snapshot_id: str, payload: ReleaseCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _run(db, request, current_user, project_id, MANAGE, "factory.technical-seo.release.prepare", "factory-technical-seo-release", FactoryTechnicalSeoService(db).prepare_release, context=True, snapshot_id=snapshot_id, **payload.model_dump())
@router.post("/releases/{release_id}/approve")
async def approve_release(project_id: int, release_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _run(db, request, current_user, project_id, APPROVE, "factory.technical-seo.release.approve", "factory-technical-seo-release", FactoryTechnicalSeoService(db).approve_release, release_id=release_id, expected_revision=payload.expected_revision, approval_reference=payload.reference)
@router.post("/releases/{release_id}/acknowledge")
async def acknowledge_release(project_id: int, release_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _run(db, request, current_user, project_id, ACK, "factory.technical-seo.handoff.acknowledge", "factory-technical-seo-release", FactoryTechnicalSeoService(db).acknowledge_release, release_id=release_id, expected_revision=payload.expected_revision, consumer_receipt_reference=payload.reference)
