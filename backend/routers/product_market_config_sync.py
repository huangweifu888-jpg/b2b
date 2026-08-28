"""Product Market Config Cloud Sync API - save, load, version history, rollback"""
import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from models.product_market_configs import Product_market_configs

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/product-market-config", tags=["product-market-config"])


class SaveConfigRequest(BaseModel):
    config_data: str  # JSON string
    version_label: Optional[str] = None


class ConfigResponse(BaseModel):
    id: int
    version: int
    version_label: Optional[str] = None
    config_data: str
    is_current: bool
    created_at: Optional[str] = None


class VersionItem(BaseModel):
    id: int
    version: int
    version_label: Optional[str] = None
    is_current: bool
    created_at: Optional[str] = None


class VersionListResponse(BaseModel):
    items: List[VersionItem]
    total: int


@router.post("/save", response_model=ConfigResponse)
async def save_config(
    data: SaveConfigRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save current config as a new version"""
    try:
        # Validate JSON
        json.loads(data.config_data)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in config_data")

    # Get the max version for this user
    result = await db.execute(
        select(func.max(Product_market_configs.version)).where(
            Product_market_configs.user_id == current_user.id
        )
    )
    max_version = result.scalar() or 0
    new_version = max_version + 1

    # Mark all existing configs as not current
    await db.execute(
        update(Product_market_configs)
        .where(Product_market_configs.user_id == current_user.id)
        .values(is_current=False)
    )

    # Create new config
    new_config = Product_market_configs(
        user_id=current_user.id,
        config_data=data.config_data,
        version=new_version,
        version_label=data.version_label or f"版本 {new_version}",
        is_current=True,
    )
    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)

    return ConfigResponse(
        id=new_config.id,
        version=new_config.version,
        version_label=new_config.version_label,
        config_data=new_config.config_data,
        is_current=new_config.is_current,
        created_at=str(new_config.created_at) if new_config.created_at else None,
    )


@router.get("/latest", response_model=Optional[ConfigResponse])
async def get_latest_config(
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the latest (current) config for the user"""
    result = await db.execute(
        select(Product_market_configs)
        .where(
            Product_market_configs.user_id == current_user.id,
            Product_market_configs.is_current == True,
        )
        .order_by(Product_market_configs.version.desc())
        .limit(1)
    )
    config = result.scalar_one_or_none()
    if not config:
        return None
    return ConfigResponse(
        id=config.id,
        version=config.version,
        version_label=config.version_label,
        config_data=config.config_data,
        is_current=config.is_current,
        created_at=str(config.created_at) if config.created_at else None,
    )


@router.get("/versions", response_model=VersionListResponse)
async def list_versions(
    skip: int = 0,
    limit: int = 20,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all config versions for the user"""
    # Count total
    count_result = await db.execute(
        select(func.count(Product_market_configs.id)).where(
            Product_market_configs.user_id == current_user.id
        )
    )
    total = count_result.scalar() or 0

    # Get versions
    result = await db.execute(
        select(Product_market_configs)
        .where(Product_market_configs.user_id == current_user.id)
        .order_by(Product_market_configs.version.desc())
        .offset(skip)
        .limit(limit)
    )
    configs = result.scalars().all()

    items = [
        VersionItem(
            id=c.id,
            version=c.version,
            version_label=c.version_label,
            is_current=c.is_current,
            created_at=str(c.created_at) if c.created_at else None,
        )
        for c in configs
    ]

    return VersionListResponse(items=items, total=total)


@router.post("/rollback/{version_id}", response_model=ConfigResponse)
async def rollback_to_version(
    version_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rollback to a specific version"""
    # Get the target version
    result = await db.execute(
        select(Product_market_configs).where(
            Product_market_configs.id == version_id,
            Product_market_configs.user_id == current_user.id,
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Version not found")

    # Mark all as not current
    await db.execute(
        update(Product_market_configs)
        .where(Product_market_configs.user_id == current_user.id)
        .values(is_current=False)
    )

    # Mark target as current
    target.is_current = True
    await db.commit()
    await db.refresh(target)

    return ConfigResponse(
        id=target.id,
        version=target.version,
        version_label=target.version_label,
        config_data=target.config_data,
        is_current=target.is_current,
        created_at=str(target.created_at) if target.created_at else None,
    )
