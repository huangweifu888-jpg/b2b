from core.database import Base
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Integer, String


class Ad_sync_settings(Base):
    __tablename__ = "ad_sync_settings"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    platform_name = Column(String, nullable=False)
    account_id = Column(String, nullable=False)
    sync_frequency = Column(String, nullable=True)
    auto_sync_enabled = Column(Boolean, nullable=True)
    last_sync_at = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)