"""Tenant-scoped PLM engineering and product-passport APIs."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from schemas.auth import UserResponse
from services.audit import record_audit_event
from services.factory_product_passport import FactoryProductPassportService
from services.tenant_access import require_project_access, require_project_permission
from sqlalchemy.ext.asyncio import AsyncSession


router = APIRouter(
    prefix="/api/v1/factory-platform/projects/{project_id}/product-passports",
    tags=["factory-platform-product-passports"],
)

ENGINEERING_MANAGE = "factory.fulfillment.engineering.manage"
ENGINEERING_RELEASE = "factory.fulfillment.engineering.release"
PASSPORT_PUBLISH = "factory.fulfillment.passport.publish"


class BomComponent(BaseModel):
    material_reference: str = Field(min_length=1, max_length=255)
    material_name: str = Field(min_length=1, max_length=500)
    supplier_reference: str = Field(min_length=1, max_length=255)
    quantity: str = Field(min_length=1, max_length=50)
    unit: str = Field(min_length=1, max_length=30)
    origin_country: str = Field(min_length=2, max_length=100)


class EngineeringCreate(BaseModel):
    order_id: str = Field(min_length=1, max_length=100)
    product_reference: str = Field(min_length=1, max_length=255)
    sku_reference: str = Field(min_length=1, max_length=255)
    product_name: str = Field(min_length=2, max_length=500)
    engineering_version: str = Field(min_length=1, max_length=100)
    specification: dict[str, str]
    bom_components: list[BomComponent] = Field(min_length=2, max_length=500)


class EngineeringRelease(BaseModel):
    expected_revision: int = Field(gt=0)
    release_reference: str = Field(min_length=1, max_length=255)
    release_note: str = Field(min_length=8, max_length=2000)


class PassportCreate(BaseModel):
    engineering_version_id: str = Field(min_length=1, max_length=100)
    order_id: str = Field(min_length=1, max_length=100)
    target_market: str = Field(min_length=2, max_length=100)
    access_mode: Literal["controlled", "customer", "public-summary"] = "controlled"


class CertificateCreate(BaseModel):
    expected_revision: int = Field(gt=0)
    certificate_type: str = Field(min_length=1, max_length=100)
    certificate_number: str = Field(min_length=1, max_length=255)
    issuer: str = Field(min_length=1, max_length=500)
    jurisdiction: str = Field(min_length=2, max_length=100)
    valid_from: datetime
    valid_until: datetime
    evidence_reference: str = Field(min_length=1, max_length=500)


class PassportPublish(BaseModel):
    expected_revision: int = Field(gt=0)


@router.get("")
async def list_product_passports(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_access(db, current_user=current_user, project_id=project_id)
    return await FactoryProductPassportService(db).list_workspace(project_id=project_id)


@router.post("/engineering")
async def create_engineering_version(
    project_id: int,
    payload: EngineeringCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(
        db,
        current_user=current_user,
        project_id=project_id,
        permission=ENGINEERING_MANAGE,
    )
    try:
        item = await FactoryProductPassportService(db).create_engineering_version(
            project_id=project_id,
            context=resolved.context,
            actor=current_user.id,
            **payload.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(
        db,
        action="factory_engineering_version_created",
        actor_user_id=current_user.id,
        target_type="factory_engineering_version",
        target_id=item["id"],
        ip_address=request.client.host if request.client else None,
        detail={
            "project_id": project_id,
            "engineering_number": item["engineering_number"],
            "product_reference": item["product_reference"],
            "sku_reference": item["sku_reference"],
            "bom_component_count": len(item["bom_components"]),
        },
    )
    await db.commit()
    return item


@router.post("/engineering/{engineering_id}/release")
async def release_engineering_version(
    project_id: int,
    engineering_id: str,
    payload: EngineeringRelease,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(
        db,
        current_user=current_user,
        project_id=project_id,
        permission=ENGINEERING_RELEASE,
    )
    try:
        item = await FactoryProductPassportService(db).release_engineering_version(
            engineering_id,
            project_id=project_id,
            actor=current_user.id,
            **payload.model_dump(),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(
        db,
        action="factory_engineering_version_released",
        actor_user_id=current_user.id,
        target_type="factory_engineering_version",
        target_id=engineering_id,
        ip_address=request.client.host if request.client else None,
        detail={
            "project_id": project_id,
            "engineering_number": item["engineering_number"],
            "release_reference": item["release_reference"],
            "revision": item["revision"],
        },
    )
    await db.commit()
    return item


@router.post("/passports")
async def create_product_passport(
    project_id: int,
    payload: PassportCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(
        db,
        current_user=current_user,
        project_id=project_id,
        permission=ENGINEERING_MANAGE,
    )
    try:
        item = await FactoryProductPassportService(db).create_passport(
            project_id=project_id,
            context=resolved.context,
            actor=current_user.id,
            **payload.model_dump(),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(
        db,
        action="factory_product_passport_created",
        actor_user_id=current_user.id,
        target_type="factory_product_passport",
        target_id=item["id"],
        ip_address=request.client.host if request.client else None,
        detail={
            "project_id": project_id,
            "passport_number": item["passport_number"],
            "engineering_version_id": item["engineering_version_id"],
            "order_id": item["order_id"],
            "batch_reference": item["batch_reference"],
        },
    )
    await db.commit()
    return item


@router.post("/passports/{passport_id}/certificates")
async def add_product_passport_certificate(
    project_id: int,
    passport_id: str,
    payload: CertificateCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    resolved = await require_project_permission(
        db,
        current_user=current_user,
        project_id=project_id,
        permission=ENGINEERING_MANAGE,
    )
    try:
        item = await FactoryProductPassportService(db).add_certificate(
            passport_id,
            project_id=project_id,
            context=resolved.context,
            actor=current_user.id,
            **payload.model_dump(),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    certificate = item["certificate"]
    record_audit_event(
        db,
        action="factory_product_passport_certificate_verified",
        actor_user_id=current_user.id,
        target_type="factory_product_passport_certificate",
        target_id=certificate["id"],
        ip_address=request.client.host if request.client else None,
        detail={
            "project_id": project_id,
            "passport_id": passport_id,
            "certificate_number": certificate["certificate_number"],
            "jurisdiction": certificate["jurisdiction"],
            "evidence_reference": certificate["evidence_reference"],
        },
    )
    await db.commit()
    return item


@router.post("/passports/{passport_id}/publish")
async def publish_product_passport(
    project_id: int,
    passport_id: str,
    payload: PassportPublish,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    await require_project_permission(
        db,
        current_user=current_user,
        project_id=project_id,
        permission=PASSPORT_PUBLISH,
    )
    try:
        item = await FactoryProductPassportService(db).publish_passport(
            passport_id,
            project_id=project_id,
            actor=current_user.id,
            **payload.model_dump(),
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    record_audit_event(
        db,
        action="factory_product_passport_published",
        actor_user_id=current_user.id,
        target_type="factory_product_passport",
        target_id=passport_id,
        ip_address=request.client.host if request.client else None,
        detail={
            "project_id": project_id,
            "passport_number": item["passport_number"],
            "trace_digest": item["trace_digest"],
            "target_market": item["target_market"],
            "access_mode": item["access_mode"],
            "linked_asset_count": len(item["linked_assets"]),
        },
    )
    await db.commit()
    return item
