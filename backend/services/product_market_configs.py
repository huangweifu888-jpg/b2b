import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.product_market_configs import Product_market_configs

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Product_market_configsService:
    """Service layer for Product_market_configs operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Product_market_configs]:
        """Create a new product_market_configs"""
        try:
            if user_id:
                data['user_id'] = user_id
            obj = Product_market_configs(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created product_market_configs with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating product_market_configs: {str(e)}")
            raise

    async def check_ownership(self, obj_id: int, user_id: str) -> bool:
        """Check if user owns this record"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            return obj is not None
        except Exception as e:
            logger.error(f"Error checking ownership for product_market_configs {obj_id}: {str(e)}")
            return False

    async def get_by_id(self, obj_id: int, user_id: Optional[str] = None) -> Optional[Product_market_configs]:
        """Get product_market_configs by ID (user can only see their own records)"""
        try:
            query = select(Product_market_configs).where(Product_market_configs.id == obj_id)
            if user_id:
                query = query.where(Product_market_configs.user_id == user_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching product_market_configs {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        user_id: Optional[str] = None,
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of product_market_configss (user can only see their own records)"""
        try:
            query = select(Product_market_configs)
            count_query = select(func.count(Product_market_configs.id))
            
            if user_id:
                query = query.where(Product_market_configs.user_id == user_id)
                count_query = count_query.where(Product_market_configs.user_id == user_id)
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Product_market_configs, field):
                        query = query.where(getattr(Product_market_configs, field) == value)
                        count_query = count_query.where(getattr(Product_market_configs, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Product_market_configs, field_name):
                        query = query.order_by(getattr(Product_market_configs, field_name).desc())
                else:
                    if hasattr(Product_market_configs, sort):
                        query = query.order_by(getattr(Product_market_configs, sort))
            else:
                query = query.order_by(Product_market_configs.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching product_market_configs list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any], user_id: Optional[str] = None) -> Optional[Product_market_configs]:
        """Update product_market_configs (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Product_market_configs {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key) and key != 'user_id':
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated product_market_configs {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating product_market_configs {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int, user_id: Optional[str] = None) -> bool:
        """Delete product_market_configs (requires ownership)"""
        try:
            obj = await self.get_by_id(obj_id, user_id=user_id)
            if not obj:
                logger.warning(f"Product_market_configs {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted product_market_configs {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting product_market_configs {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Product_market_configs]:
        """Get product_market_configs by any field"""
        try:
            if not hasattr(Product_market_configs, field_name):
                raise ValueError(f"Field {field_name} does not exist on Product_market_configs")
            result = await self.db.execute(
                select(Product_market_configs).where(getattr(Product_market_configs, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching product_market_configs by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Product_market_configs]:
        """Get list of product_market_configss filtered by field"""
        try:
            if not hasattr(Product_market_configs, field_name):
                raise ValueError(f"Field {field_name} does not exist on Product_market_configs")
            result = await self.db.execute(
                select(Product_market_configs)
                .where(getattr(Product_market_configs, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Product_market_configs.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching product_market_configss by {field_name}: {str(e)}")
            raise