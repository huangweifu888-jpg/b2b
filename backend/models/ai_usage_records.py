from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Float, Integer, String


class Ai_usage_records(Base):
    __tablename__ = "ai_usage_records"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    model_id = Column(String, nullable=False)
    model_name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    tokens_used = Column(Integer, nullable=True, default=0, server_default='0')
    cost = Column(Float, nullable=True, default=0, server_default='0')
    status = Column(String, nullable=True, default='success', server_default='success')
    source_page = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)