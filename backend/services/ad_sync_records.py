import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.ad_sync_records import Ad_sync_records

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Ad_sync_recordsService:
    """Service layer for Ad_sync_records operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Ad_sync_records]:
        """Create a new ad_sync_records"""
        try:
            if user_id:
                data['user_id'] = user_id
            obj = Ad_sync_records(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created ad_sync_records with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating ad_sync_records: {str(e)}")
            raise

    async def check_ownership(self, obj_id: int, user_id: str) -> bool:
        """Check if user owns this record"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            return obj is not None
        except Exception as e:
            logger.error(f"Error checking ownership for ad_sync_records {obj_id}: {str(e)}")
            return False

    async def get_by_id(self, obj_id: int, user_id: Optional[str] = None) -> Optional[Ad_sync_records]:
        """Get ad_sync_records by ID (user can only see their own records)"""
        try:
            query = select(Ad_sync_records).where(Ad_sync_records.id == obj_id)
            if user_id:
                query = query.where(Ad_sync_records.user_id == user_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching ad_sync_records {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        user_id: Optional[str] = None,
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of ad_sync_recordss (user can only see their own records)"""
        try:
            query = select(Ad_sync_records)
            count_query = select(func.count(Ad_sync_records.id))
            
            if user_id:
                query = query.where(Ad_sync_records.user_id == user_id)
                count_query = count_query.where(Ad_sync_records.user_id == user_id)
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Ad_sync_records, field):
                        query = query.where(getattr(Ad_sync_records, field) == value)
                        count_query = count_query.where(getattr(Ad_sync_records, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Ad_sync_records, field_name):
                        query = query.order_by(getattr(Ad_sync_records, field_name).desc())
                else:
                    if hasattr(Ad_sync_records, sort):
                        query = query.order_by(getattr(Ad_sync_records, sort))
            else:
                query = query.order_by(Ad_sync_records.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching ad_sync_records list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Ad_sync_records]:
        """Update ad_sync_records (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Ad_sync_records {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key) and key != 'user_id':
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated ad_sync_records {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating ad_sync_records {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int, user_id: Optional[str] = None) -> bool:
        """Delete ad_sync_records (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Ad_sync_records {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted ad_sync_records {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting ad_sync_records {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Ad_sync_records]:
        """Get ad_sync_records by any field"""
        try:
            if not hasattr(Ad_sync_records, field_name):
                raise ValueError(f"Field {field_name} does not exist on Ad_sync_records")
            result = await self.db.execute(
                select(Ad_sync_records).where(getattr(Ad_sync_records, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching ad_sync_records by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Ad_sync_records]:
        """Get list of ad_sync_recordss filtered by field"""
        try:
            if not hasattr(Ad_sync_records, field_name):
                raise ValueError(f"Field {field_name} does not exist on Ad_sync_records")
            result = await self.db.execute(
                select(Ad_sync_records)
                .where(getattr(Ad_sync_records, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Ad_sync_records.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching ad_sync_recordss by {field_name}: {str(e)}")
            raise