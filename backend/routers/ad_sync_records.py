import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.ad_sync_records import Ad_sync_recordsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/ad_sync_records", tags=["ad_sync_records"])


# ---------- Pydantic Schemas ----------
class Ad_sync_recordsData(BaseModel):
    """Entity data schema (for create/update)"""
    platform_name: str
    account_id: str
    account_name: str
    sync_type: str
    sync_status: str
    sync_frequency: str = None
    data_snapshot: str = None
    error_message: str = None


class Ad_sync_recordsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    platform_name: Optional[str] = None
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    sync_type: Optional[str] = None
    sync_status: Optional[str] = None
    sync_frequency: Optional[str] = None
    data_snapshot: Optional[str] = None
    error_message: Optional[str] = None


class Ad_sync_recordsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    platform_name: str
    account_id: str
    account_name: str
    sync_type: str
    sync_status: str
    sync_frequency: Optional[str] = None
    data_snapshot: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Ad_sync_recordsListResponse(BaseModel):
    """List response schema"""
    items: List[Ad_sync_recordsResponse]
    total: int
    skip: int
    limit: int


class Ad_sync_recordsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Ad_sync_recordsData]


class Ad_sync_recordsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Ad_sync_recordsUpdateData


class Ad_sync_recordsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Ad_sync_recordsBatchUpdateItem]


class Ad_sync_recordsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Ad_sync_recordsListResponse)
async def query_ad_sync_recordss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query ad_sync_recordss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying ad_sync_recordss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Ad_sync_recordsService(db)
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
        logger.debug(f"Found {result['total']} ad_sync_recordss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying ad_sync_recordss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Ad_sync_recordsListResponse)
async def query_ad_sync_recordss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query ad_sync_recordss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying ad_sync_recordss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Ad_sync_recordsService(db)
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
        logger.debug(f"Found {result['total']} ad_sync_recordss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying ad_sync_recordss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Ad_sync_recordsResponse)
async def get_ad_sync_records(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single ad_sync_records by ID (user can only see their own records)"""
    logger.debug(f"Fetching ad_sync_records with id: {id}, fields={fields}")
    
    service = Ad_sync_recordsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Ad_sync_records with id {id} not found")
            raise HTTPException(status_code=404, detail="Ad_sync_records not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching ad_sync_records {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Ad_sync_recordsResponse, status_code=201)
async def create_ad_sync_records(
    data: Ad_sync_recordsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new ad_sync_records"""
    logger.debug(f"Creating new ad_sync_records with data: {data}")
    
    service = Ad_sync_recordsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create ad_sync_records")
        
        logger.info(f"Ad_sync_records created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating ad_sync_records: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating ad_sync_records: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Ad_sync_recordsResponse], status_code=201)
async def create_ad_sync_recordss_batch(
    request: Ad_sync_recordsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple ad_sync_recordss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} ad_sync_recordss")
    
    service = Ad_sync_recordsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} ad_sync_recordss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Ad_sync_recordsResponse])
async def update_ad_sync_recordss_batch(
    request: Ad_sync_recordsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple ad_sync_recordss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} ad_sync_recordss")
    
    service = Ad_sync_recordsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} ad_sync_recordss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Ad_sync_recordsResponse)
async def update_ad_sync_records(
    id: int,
    data: Ad_sync_recordsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing ad_sync_records (requires ownership)"""
    logger.debug(f"Updating ad_sync_records {id} with data: {data}")

    service = Ad_sync_recordsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Ad_sync_records with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Ad_sync_records not found")
        
        logger.info(f"Ad_sync_records {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating ad_sync_records {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating ad_sync_records {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_ad_sync_recordss_batch(
    request: Ad_sync_recordsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple ad_sync_recordss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} ad_sync_recordss")
    
    service = Ad_sync_recordsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} ad_sync_recordss successfully")
        return {"message": f"Successfully deleted {deleted_count} ad_sync_recordss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_ad_sync_records(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single ad_sync_records by ID (requires ownership)"""
    logger.debug(f"Deleting ad_sync_records with id: {id}")
    
    service = Ad_sync_recordsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Ad_sync_records with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Ad_sync_records not found")
        
        logger.info(f"Ad_sync_records {id} deleted successfully")
        return {"message": "Ad_sync_records deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting ad_sync_records {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")