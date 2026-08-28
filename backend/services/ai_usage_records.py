import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.ai_usage_records import Ai_usage_records

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Ai_usage_recordsService:
    """Service layer for Ai_usage_records operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Ai_usage_records]:
        """Create a new ai_usage_records"""
        try:
            if user_id:
                data['user_id'] = user_id
            obj = Ai_usage_records(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created ai_usage_records with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating ai_usage_records: {str(e)}")
            raise

    async def check_ownership(self, obj_id: int, user_id: str) -> bool:
        """Check if user owns this record"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            return obj is not None
        except Exception as e:
            logger.error(f"Error checking ownership for ai_usage_records {obj_id}: {str(e)}")
            return False

    async def get_by_id(self, obj_id: int, user_id: Optional[str] = None) -> Optional[Ai_usage_records]:
        """Get ai_usage_records by ID (user can only see their own records)"""
        try:
            query = select(Ai_usage_records).where(Ai_usage_records.id == obj_id)
            if user_id:
                query = query.where(Ai_usage_records.user_id == user_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching ai_usage_records {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        user_id: Optional[str] = None,
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of ai_usage_recordss (user can only see their own records)"""
        try:
            query = select(Ai_usage_records)
            count_query = select(func.count(Ai_usage_records.id))
            
            if user_id:
                query = query.where(Ai_usage_records.user_id == user_id)
                count_query = count_query.where(Ai_usage_records.user_id == user_id)
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Ai_usage_records, field):
                        query = query.where(getattr(Ai_usage_records, field) == value)
                        count_query = count_query.where(getattr(Ai_usage_records, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Ai_usage_records, field_name):
                        query = query.order_by(getattr(Ai_usage_records, field_name).desc())
                else:
                    if hasattr(Ai_usage_records, sort):
                        query = query.order_by(getattr(Ai_usage_records, sort))
            else:
                query = query.order_by(Ai_usage_records.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching ai_usage_records list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Ai_usage_records]:
        """Update ai_usage_records (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Ai_usage_records {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key) and key != 'user_id':
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated ai_usage_records {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating ai_usage_records {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int, user_id: Optional[str] = None) -> bool:
        """Delete ai_usage_records (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Ai_usage_records {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted ai_usage_records {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting ai_usage_records {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Ai_usage_records]:
        """Get ai_usage_records by any field"""
        try:
            if not hasattr(Ai_usage_records, field_name):
                raise ValueError(f"Field {field_name} does not exist on Ai_usage_records")
            result = await self.db.execute(
                select(Ai_usage_records).where(getattr(Ai_usage_records, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching ai_usage_records by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Ai_usage_records]:
        """Get list of ai_usage_recordss filtered by field"""
        try:
            if not hasattr(Ai_usage_records, field_name):
                raise ValueError(f"Field {field_name} does not exist on Ai_usage_records")
            result = await self.db.execute(
                select(Ai_usage_records)
                .where(getattr(Ai_usage_records, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Ai_usage_records.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching ai_usage_recordss by {field_name}: {str(e)}")
            raise