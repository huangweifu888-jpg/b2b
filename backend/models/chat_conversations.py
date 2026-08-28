from core.database import Base
from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String


class Chat_conversations(Base):
    __tablename__ = "chat_conversations"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message_count = Column(Integer, nullable=True, default=0, server_default='0')
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.now)
    updated_at = Column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)