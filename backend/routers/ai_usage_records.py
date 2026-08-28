import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.ai_usage_records import Ai_usage_recordsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/ai_usage_records", tags=["ai_usage_records"])


# ---------- Pydantic Schemas ----------
class Ai_usage_recordsData(BaseModel):
    """Entity data schema (for create/update)"""
    model_id: str
    model_name: str
    category: str
    tokens_used: int = None
    cost: float = None
    status: str = None
    source_page: str = None


class Ai_usage_recordsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    model_id: Optional[str] = None
    model_name: Optional[str] = None
    category: Optional[str] = None
    tokens_used: Optional[int] = None
    cost: Optional[float] = None
    status: Optional[str] = None
    source_page: Optional[str] = None


class Ai_usage_recordsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    model_id: str
    model_name: str
    category: str
    tokens_used: Optional[int] = None
    cost: Optional[float] = None
    status: Optional[str] = None
    source_page: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Ai_usage_recordsListResponse(BaseModel):
    """List response schema"""
    items: List[Ai_usage_recordsResponse]
    total: int
    skip: int
    limit: int


class Ai_usage_recordsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Ai_usage_recordsData]


class Ai_usage_recordsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Ai_usage_recordsUpdateData


class Ai_usage_recordsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Ai_usage_recordsBatchUpdateItem]


class Ai_usage_recordsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Ai_usage_recordsListResponse)
async def query_ai_usage_recordss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query ai_usage_recordss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying ai_usage_recordss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Ai_usage_recordsService(db)
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
        logger.debug(f"Found {result['total']} ai_usage_recordss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying ai_usage_recordss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Ai_usage_recordsListResponse)
async def query_ai_usage_recordss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query ai_usage_recordss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying ai_usage_recordss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Ai_usage_recordsService(db)
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
        logger.debug(f"Found {result['total']} ai_usage_recordss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying ai_usage_recordss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Ai_usage_recordsResponse)
async def get_ai_usage_records(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single ai_usage_records by ID (user can only see their own records)"""
    logger.debug(f"Fetching ai_usage_records with id: {id}, fields={fields}")
    
    service = Ai_usage_recordsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Ai_usage_records with id {id} not found")
            raise HTTPException(status_code=404, detail="Ai_usage_records not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching ai_usage_records {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Ai_usage_recordsResponse, status_code=201)
async def create_ai_usage_records(
    data: Ai_usage_recordsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new ai_usage_records"""
    logger.debug(f"Creating new ai_usage_records with data: {data}")
    
    service = Ai_usage_recordsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create ai_usage_records")
        
        logger.info(f"Ai_usage_records created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating ai_usage_records: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating ai_usage_records: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Ai_usage_recordsResponse], status_code=201)
async def create_ai_usage_recordss_batch(
    request: Ai_usage_recordsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple ai_usage_recordss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} ai_usage_recordss")
    
    service = Ai_usage_recordsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} ai_usage_recordss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Ai_usage_recordsResponse])
async def update_ai_usage_recordss_batch(
    request: Ai_usage_recordsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple ai_usage_recordss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} ai_usage_recordss")
    
    service = Ai_usage_recordsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} ai_usage_recordss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Ai_usage_recordsResponse)
async def update_ai_usage_records(
    id: int,
    data: Ai_usage_recordsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing ai_usage_records (requires ownership)"""
    logger.debug(f"Updating ai_usage_records {id} with data: {data}")

    service = Ai_usage_recordsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Ai_usage_records with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Ai_usage_records not found")
        
        logger.info(f"Ai_usage_records {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating ai_usage_records {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating ai_usage_records {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_ai_usage_recordss_batch(
    request: Ai_usage_recordsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple ai_usage_recordss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} ai_usage_recordss")
    
    service = Ai_usage_recordsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} ai_usage_recordss successfully")
        return {"message": f"Successfully deleted {deleted_count} ai_usage_recordss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_ai_usage_records(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single ai_usage_records by ID (requires ownership)"""
    logger.debug(f"Deleting ai_usage_records with id: {id}")
    
    service = Ai_usage_recordsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Ai_usage_records with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Ai_usage_records not found")
        
        logger.info(f"Ai_usage_records {id} deleted successfully")
        return {"message": "Ai_usage_records deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting ai_usage_records {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")