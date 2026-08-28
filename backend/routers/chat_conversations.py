import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.chat_conversations import Chat_conversationsService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/chat_conversations", tags=["chat_conversations"])


# ---------- Pydantic Schemas ----------
class Chat_conversationsData(BaseModel):
    """Entity data schema (for create/update)"""
    title: str
    message_count: int = None
    last_message_at: Optional[datetime] = None


class Chat_conversationsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    title: Optional[str] = None
    message_count: Optional[int] = None
    last_message_at: Optional[datetime] = None


class Chat_conversationsResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    title: str
    message_count: Optional[int] = None
    last_message_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Chat_conversationsListResponse(BaseModel):
    """List response schema"""
    items: List[Chat_conversationsResponse]
    total: int
    skip: int
    limit: int


class Chat_conversationsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Chat_conversationsData]


class Chat_conversationsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Chat_conversationsUpdateData


class Chat_conversationsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Chat_conversationsBatchUpdateItem]


class Chat_conversationsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Chat_conversationsListResponse)
async def query_chat_conversationss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query chat_conversationss with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying chat_conversationss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Chat_conversationsService(db)
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
        logger.debug(f"Found {result['total']} chat_conversationss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying chat_conversationss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Chat_conversationsListResponse)
async def query_chat_conversationss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query chat_conversationss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying chat_conversationss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Chat_conversationsService(db)
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
        logger.debug(f"Found {result['total']} chat_conversationss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying chat_conversationss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Chat_conversationsResponse)
async def get_chat_conversations(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single chat_conversations by ID (user can only see their own records)"""
    logger.debug(f"Fetching chat_conversations with id: {id}, fields={fields}")
    
    service = Chat_conversationsService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Chat_conversations with id {id} not found")
            raise HTTPException(status_code=404, detail="Chat_conversations not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching chat_conversations {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Chat_conversationsResponse, status_code=201)
async def create_chat_conversations(
    data: Chat_conversationsData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new chat_conversations"""
    logger.debug(f"Creating new chat_conversations with data: {data}")
    
    service = Chat_conversationsService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create chat_conversations")
        
        logger.info(f"Chat_conversations created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating chat_conversations: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating chat_conversations: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Chat_conversationsResponse], status_code=201)
async def create_chat_conversationss_batch(
    request: Chat_conversationsBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple chat_conversationss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} chat_conversationss")
    
    service = Chat_conversationsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} chat_conversationss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Chat_conversationsResponse])
async def update_chat_conversationss_batch(
    request: Chat_conversationsBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple chat_conversationss in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} chat_conversationss")
    
    service = Chat_conversationsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} chat_conversationss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Chat_conversationsResponse)
async def update_chat_conversations(
    id: int,
    data: Chat_conversationsUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing chat_conversations (requires ownership)"""
    logger.debug(f"Updating chat_conversations {id} with data: {data}")

    service = Chat_conversationsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Chat_conversations with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Chat_conversations not found")
        
        logger.info(f"Chat_conversations {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating chat_conversations {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating chat_conversations {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_chat_conversationss_batch(
    request: Chat_conversationsBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple chat_conversationss by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} chat_conversationss")
    
    service = Chat_conversationsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} chat_conversationss successfully")
        return {"message": f"Successfully deleted {deleted_count} chat_conversationss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_chat_conversations(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single chat_conversations by ID (requires ownership)"""
    logger.debug(f"Deleting chat_conversations with id: {id}")
    
    service = Chat_conversationsService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Chat_conversations with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Chat_conversations not found")
        
        logger.info(f"Chat_conversations {id} deleted successfully")
        return {"message": "Chat_conversations deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat_conversations {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")