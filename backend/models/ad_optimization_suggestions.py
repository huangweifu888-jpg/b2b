from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Ad_optimization_suggestions(Base):
    __tablename__ = "ad_optimization_suggestions"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    platform_name = Column(String, nullable=False)
    account_id = Column(String, nullable=False)
    account_name = Column(String, nullable=True)
    suggestion_type = Column(String, nullable=False)
    suggestion_content = Column(String, nullable=False)
    priority = Column(String, nullable=True)
    status = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)