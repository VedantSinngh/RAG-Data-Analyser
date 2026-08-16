import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.user import PortableUUID


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(PortableUUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    document_id = Column(PortableUUID(), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    query = Column(String, nullable=False)
    result = Column(JSON, nullable=True)  # Full agent execution outputs
    status = Column(String, default="pending", server_default="pending")  # 'pending'|'completed'|'error'
    tokens_used = Column(Integer, default=0, server_default="0")
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="analyses")
    document = relationship("Document", back_populates="analyses")
    reports = relationship("Report", back_populates="analysis", cascade="all, delete-orphan")
    agent_logs = relationship("AgentLog", back_populates="analysis", cascade="all, delete-orphan")
    charts = relationship("Chart", back_populates="analysis", cascade="all, delete-orphan")
