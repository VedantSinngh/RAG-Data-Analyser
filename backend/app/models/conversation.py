import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.user import PortableUUID


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(PortableUUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    messages = Column(JSON, default=list)  # List of {role, content, ts}
    context_ids = Column(JSON, default=list)  # Linked analysis IDs (stored as JSON array instead of ARRAY)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="conversations")
