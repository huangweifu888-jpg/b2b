import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.product_market_configs import Product_market_configsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/product_market_configs", tags=["product_market_configs"])


# ---------- Pydantic Schemas ----------
class Product_market_configsData(BaseModel):
    """Entity data schema (for create/update)"""
    config_data: str
    version: int
    version_label: str = None
    is_current: bool = None


class Product_market_configsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    config_data: Optional[str] = None
    version: Optional[int] = None
    version_label: Optional[str] = None
    is_current: Optional[bool] = None


class Product_market_configsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    config_data: str
    version: int
    version_label: Optional[str] = None
    is_current: Optional[bool] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Product_market_configsListResponse(BaseModel):
    """List response schema"""
    items: List[Product_market_configsResponse]
    total: int
    skip: int
    limit: int


class Product_market_configsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Product_market_configsData]


class Product_market_configsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Product_market_configsUpdateData


class Product_market_configsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Product_market_configsBatchUpdateItem]


class Product_market_configsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Product_market_configsListResponse)
async def query_product_market_configss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query product_market_configss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying product_market_configss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Product_market_configsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} product_market_configss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying product_market_configss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Product_market_configsListResponse)
async def query_product_market_configss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query product_market_configss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying product_market_configss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Product_market_configsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} product_market_configss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying product_market_configss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Product_market_configsResponse)
async def get_product_market_configs(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single product_market_configs by ID (user can only see their own records)"""
    logger.debug(f"Fetching product_market_configs with id: {id}, fields={fields}")
    
    service = Product_market_configsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Product_market_configs with id {id} not found")
            raise HTTPException(status_code=404, detail="Product_market_configs not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching product_market_configs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Product_market_configsResponse, status_code=201)
async def create_product_market_configs(
    data: Product_market_configsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new product_market_configs"""
    logger.debug(f"Creating new product_market_configs with data: {data}")
    
    service = Product_market_configsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create product_market_configs")
        
        logger.info(f"Product_market_configs created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating product_market_configs: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating product_market_configs: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Product_market_configsResponse], status_code=201)
async def create_product_market_configss_batch(
    request: Product_market_configsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple product_market_configss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} product_market_configss")
    
    service = Product_market_configsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} product_market_configss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Product_market_configsResponse])
async def update_product_market_configss_batch(
    request: Product_market_configsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple product_market_configss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} product_market_configss")
    
    service = Product_market_configsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} product_market_configss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Product_market_configsResponse)
async def update_product_market_configs(
    id: int,
    data: Product_market_configsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing product_market_configs (requires ownership)"""
    logger.debug(f"Updating product_market_configs {id} with data: {data}")

    service = Product_market_configsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Product_market_configs with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Product_market_configs not found")
        
        logger.info(f"Product_market_configs {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating product_market_configs {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating product_market_configs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_product_market_configss_batch(
    request: Product_market_configsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple product_market_configss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} product_market_configss")
    
    service = Product_market_configsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} product_market_configss successfully")
        return {"message": f"Successfully deleted {deleted_count} product_market_configss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_product_market_configs(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single product_market_configs by ID (requires ownership)"""
    logger.debug(f"Deleting product_market_configs with id: {id}")
    
    service = Product_market_configsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Product_market_configs with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Product_market_configs not found")
        
        logger.info(f"Product_market_configs {id} deleted successfully")
        return {"message": "Product_market_configs deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting product_market_configs {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")