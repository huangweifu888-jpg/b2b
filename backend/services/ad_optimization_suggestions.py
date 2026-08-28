import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.ad_optimization_suggestions import Ad_optimization_suggestions

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Ad_optimization_suggestionsService:
    """Service layer for Ad_optimization_suggestions operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Ad_optimization_suggestions]:
        """Create a new ad_optimization_suggestions"""
        try:
            if user_id:
                data['user_id'] = user_id
            obj = Ad_optimization_suggestions(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created ad_optimization_suggestions with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating ad_optimization_suggestions: {str(e)}")
            raise

    async def check_ownership(self, obj_id: int, user_id: str) -> bool:
        """Check if user owns this record"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            return obj is not None
        except Exception as e:
            logger.error(f"Error checking ownership for ad_optimization_suggestions {obj_id}: {str(e)}")
            return False

    async def get_by_id(self, obj_id: int, user_id: Optional[str] = None) -> Optional[Ad_optimization_suggestions]:
        """Get ad_optimization_suggestions by ID (user can only see their own records)"""
        try:
            query = select(Ad_optimization_suggestions).where(Ad_optimization_suggestions.id == obj_id)
            if user_id:
                query = query.where(Ad_optimization_suggestions.user_id == user_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching ad_optimization_suggestions {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        user_id: Optional[str] = None,
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of ad_optimization_suggestionss (user can only see their own records)"""
        try:
            query = select(Ad_optimization_suggestions)
            count_query = select(func.count(Ad_optimization_suggestions.id))
            
            if user_id:
                query = query.where(Ad_optimization_suggestions.user_id == user_id)
                count_query = count_query.where(Ad_optimization_suggestions.user_id == user_id)
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Ad_optimization_suggestions, field):
                        query = query.where(getattr(Ad_optimization_suggestions, field) == value)
                        count_query = count_query.where(getattr(Ad_optimization_suggestions, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Ad_optimization_suggestions, field_name):
                        query = query.order_by(getattr(Ad_optimization_suggestions, field_name).desc())
                else:
                    if hasattr(Ad_optimization_suggestions, sort):
                        query = query.order_by(getattr(Ad_optimization_suggestions, sort))
            else:
                query = query.order_by(Ad_optimization_suggestions.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching ad_optimization_suggestions list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Ad_optimization_suggestions]:
        """Update ad_optimization_suggestions (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Ad_optimization_suggestions {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key) and key != 'user_id':
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated ad_optimization_suggestions {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating ad_optimization_suggestions {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int, user_id: Optional[str] = None) -> bool:
        """Delete ad_optimization_suggestions (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Ad_optimization_suggestions {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted ad_optimization_suggestions {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting ad_optimization_suggestions {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Ad_optimization_suggestions]:
        """Get ad_optimization_suggestions by any field"""
        try:
            if not hasattr(Ad_optimization_suggestions, field_name):
                raise ValueError(f"Field {field_name} does not exist on Ad_optimization_suggestions")
            result = await self.db.execute(
                select(Ad_optimization_suggestions).where(getattr(Ad_optimization_suggestions, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching ad_optimization_suggestions by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Ad_optimization_suggestions]:
        """Get list of ad_optimization_suggestionss filtered by field"""
        try:
            if not hasattr(Ad_optimization_suggestions, field_name):
                raise ValueError(f"Field {field_name} does not exist on Ad_optimization_suggestions")
            result = await self.db.execute(
                select(Ad_optimization_suggestions)
                .where(getattr(Ad_optimization_suggestions, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Ad_optimization_suggestions.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching ad_optimization_suggestionss by {field_name}: {str(e)}")
            raise