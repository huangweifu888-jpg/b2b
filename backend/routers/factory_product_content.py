"""Permissioned APIs for product content version release."""
from typing import Any
from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_product_content import FactoryProductContentService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/product-content", tags=["factory-platform-product-content"])
MANAGE = "factory.content.product.asset.manage"; REVIEW = "factory.content.product.version.review"; APPROVE = "factory.content.product.publication.approve"; ACK = "factory.content.product.handoff.acknowledge"
class AssetCreate(BaseModel): product_reference: str = Field(min_length=2, max_length=160); display_name: str = Field(min_length=2, max_length=200)
class VersionCreate(BaseModel): locale: str = Field(min_length=2, max_length=16); content_document: dict[str, Any]; product_fact_reference: str = Field(min_length=1, max_length=255)
class RevisionReference(BaseModel): expected_revision: int = Field(gt=0); reference: str = Field(min_length=1, max_length=255)
class PublicationCreate(BaseModel): target: str = Field(pattern="^(website-product|channel-listing|sales-enablement|seo-content)$"); rollback_reference: str = Field(min_length=1, max_length=255)
def _fail(error: Exception): raise HTTPException(status_code=404 if isinstance(error, KeyError) else 409, detail=str(error)) from error
async def _run(db: AsyncSession, request: Request, user: UserResponse, project_id: int, permission: str, action: str, target_type: str, operation: Any, *, context: bool = False, **kwargs: Any):
    await require_project_access(db, current_user=user, project_id=project_id); resolved = await require_project_permission(db, current_user=user, project_id=project_id, permission=permission)
    try: item = await operation(project_id=project_id, actor=user.id, **({"context": resolved.context} if context else {}), **kwargs)
    except (KeyError, ValueError) as error: _fail(error)
    record_audit_event(db, action=action, actor_user_id=user.id, project_id=project_id, target_type=target_type, target_id=str(item.get("id")), ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "status": item.get("status"), "revision": item.get("revision")}); await db.commit(); return item
@router.get("")
async def workspace(project_id: int, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_project_access(db, current_user=current_user, project_id=project_id); return await FactoryProductContentService(db).workspace(project_id=project_id)
@router.post("/assets")
async def create_asset(project_id: int, payload: AssetCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _run(db, request, current_user, project_id, MANAGE, "factory.product-content.asset.create", "factory-product-content-asset", FactoryProductContentService(db).create_asset, context=True, **payload.model_dump())
@router.post("/assets/{asset_id}/versions")
async def draft_version(project_id: int, asset_id: str, payload: VersionCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _run(db, request, current_user, project_id, MANAGE, "factory.product-content.version.draft", "factory-product-content-version", FactoryProductContentService(db).draft_version, context=True, asset_id=asset_id, **payload.model_dump())
@router.post("/versions/{version_id}/review")
async def review_version(project_id: int, version_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _run(db, request, current_user, project_id, REVIEW, "factory.product-content.version.review", "factory-product-content-version", FactoryProductContentService(db).review_version, version_id=version_id, expected_revision=payload.expected_revision, review_reference=payload.reference)
@router.post("/versions/{version_id}/publications")
async def prepare_publication(project_id: int, version_id: str, payload: PublicationCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _run(db, request, current_user, project_id, MANAGE, "factory.product-content.publication.prepare", "factory-product-content-publication", FactoryProductContentService(db).prepare_publication, context=True, version_id=version_id, **payload.model_dump())
@router.post("/publications/{publication_id}/approve")
async def approve_publication(project_id: int, publication_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _run(db, request, current_user, project_id, APPROVE, "factory.product-content.publication.approve", "factory-product-content-publication", FactoryProductContentService(db).approve_publication, publication_id=publication_id, expected_revision=payload.expected_revision, approval_reference=payload.reference)
@router.post("/publications/{publication_id}/acknowledge")
async def acknowledge_publication(project_id: int, publication_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)): return await _run(db, request, current_user, project_id, ACK, "factory.product-content.publication.acknowledge", "factory-product-content-publication", FactoryProductContentService(db).acknowledge_publication, publication_id=publication_id, expected_revision=payload.expected_revision, consumer_receipt_reference=payload.reference)
