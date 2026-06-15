import uuid
from sqlalchemy import Column, DateTime, ForeignKey, text, ARRAY, String
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    messages = Column(JSONB, default=[], server_default=text("'[]'::jsonb")) # List of {role, content, ts}
    context_ids = Column(ARRAY(String), default=[], server_default=text("'{}'::text[]")) # Linked analysis IDs
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"))

    # Relationships
    user = relationship("User", back_populates="conversations")
