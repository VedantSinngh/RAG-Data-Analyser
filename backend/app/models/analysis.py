import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    query = Column(String, nullable=False)
    result = Column(JSONB, nullable=True) # Full agent execution outputs
    status = Column(String, default="pending", server_default="pending") # 'pending'|'completed'|'error'
    tokens_used = Column(Integer, default=0, server_default="0")
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

    # Relationships
    user = relationship("User", back_populates="analyses")
    document = relationship("Document", back_populates="analyses")
    reports = relationship("Report", back_populates="analysis", cascade="all, delete-orphan")
    agent_logs = relationship("AgentLog", back_populates="analysis", cascade="all, delete-orphan")
    charts = relationship("Chart", back_populates="analysis", cascade="all, delete-orphan")
