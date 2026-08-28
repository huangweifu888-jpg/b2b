"""Tenant-scoped structured-data center APIs."""
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_structured_data import FactoryStructuredDataService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(prefix="/api/v1/factory-platform/projects/{project_id}/structured-data", tags=["factory-platform-structured-data"])
BUNDLE_MANAGE = "factory.recommend.structured.bundle.manage"
MAPPING_VERIFY = "factory.recommend.structured.mapping.verify"
VALIDATE = "factory.recommend.structured.validation.execute"
PUBLISH = "factory.recommend.structured.publish"
ACK = "factory.recommend.structured.handoff.acknowledge"


class BundleCreate(BaseModel):
    bundle_code: str = Field(min_length=1, max_length=64)
    bundle_name: str = Field(min_length=1, max_length=180)
    target_site_reference: str = Field(min_length=1, max_length=180)
    default_locale: str = Field(min_length=2, max_length=16)
    graph_version_id: str = Field(min_length=1, max_length=100)


class MappingCreate(BaseModel):
    schema_type: Literal["Organization", "Product", "FAQPage", "Review", "Article"]
    source_entity_id: str = Field(min_length=1, max_length=100)
    field_map: dict[str, str]
    required_fields: list[str] = Field(min_length=1, max_length=40)


class RevisionReference(BaseModel):
    expected_revision: int = Field(gt=0)
    reference: str = Field(min_length=1, max_length=255)


class ValidationRun(BaseModel):
    expected_revision: int = Field(gt=0)
    validation_reference: str = Field(min_length=1, max_length=255)


class PublishBundle(BaseModel):
    expected_revision: int = Field(gt=0)
    validation_id: str = Field(min_length=1, max_length=100)
    consumer: Literal["website", "search", "commerce", "geo"]
    deployment_reference: str = Field(min_length=1, max_length=255)


def _raise(exc: Exception):
    if isinstance(exc, KeyError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    raise HTTPException(status_code=409, detail=str(exc)) from exc


def _item(payload):
    if isinstance(payload, dict):
        for key in ("bundle", "release", "publication"):
            if isinstance(payload.get(key), dict):
                return payload[key]
    return payload


def _audit(db, request, user, action, target_type, item, project_id):
    item = _item(item)
    record_audit_event(db, action=action, actor_user_id=user.id, project_id=project_id, target_type=target_type, target_id=str(item["id"]), ip_address=request.client.host if request.client else None, detail={"project_id": project_id, "status": item.get("status"), "revision": item.get("revision")})


async def _run(db, request, user, project_id, permission, action, target_type, method, *, context=False, **kwargs):
    resolved = await require_project_permission(db, current_user=user, project_id=project_id, permission=permission)
    try:
        result = await method(project_id=project_id, actor=user.id, **({"context": resolved.context} if context else {}), **kwargs)
    except (KeyError, ValueError) as exc:
        _raise(exc)
    _audit(db, request, user, action, target_type, result, project_id)
    await db.commit()
    return result


@router.get("")
async def workspace(project_id: int, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryStructuredDataService(db).list_workspace(project_id=project_id)


@router.post("/bundles")
async def create_bundle(project_id: int, payload: BundleCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, BUNDLE_MANAGE, "factory.structured.bundle.create", "factory-structured-bundle", FactoryStructuredDataService(db).create_bundle, context=True, **payload.model_dump())


@router.post("/bundles/{bundle_id}/mappings")
async def add_mapping(project_id: int, bundle_id: str, payload: MappingCreate, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, BUNDLE_MANAGE, "factory.structured.mapping.create", "factory-structured-mapping", FactoryStructuredDataService(db).add_mapping, context=True, bundle_id=bundle_id, **payload.model_dump())


@router.post("/mappings/{mapping_id}/verify")
async def verify_mapping(project_id: int, mapping_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, MAPPING_VERIFY, "factory.structured.mapping.verify", "factory-structured-mapping", FactoryStructuredDataService(db).verify_mapping, mapping_id=mapping_id, expected_revision=payload.expected_revision, reference=payload.reference)


@router.post("/bundles/{bundle_id}/validate")
async def validate_bundle(project_id: int, bundle_id: str, payload: ValidationRun, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, VALIDATE, "factory.structured.validation.execute", "factory-structured-validation", FactoryStructuredDataService(db).run_validation, context=True, bundle_id=bundle_id, **payload.model_dump())


@router.post("/bundles/{bundle_id}/publish")
async def publish_bundle(project_id: int, bundle_id: str, payload: PublishBundle, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, PUBLISH, "factory.structured.bundle.publish", "factory-structured-bundle", FactoryStructuredDataService(db).publish_bundle, context=True, bundle_id=bundle_id, **payload.model_dump())


@router.post("/publications/{publication_id}/acknowledge")
async def acknowledge(project_id: int, publication_id: str, payload: RevisionReference, request: Request, current_user: UserResponse = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _run(db, request, current_user, project_id, ACK, "factory.structured.publication.acknowledge", "factory-structured-publication", FactoryStructuredDataService(db).acknowledge_publication, publication_id=publication_id, expected_revision=payload.expected_revision, reference=payload.reference)
