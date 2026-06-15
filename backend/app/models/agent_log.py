import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    agent_name = Column(String, nullable=False)
    input_data = Column("input", JSONB, nullable=True)
    output_data = Column("output", JSONB, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    error = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

    # Relationships
    analysis = relationship("Analysis", back_populates="agent_logs")
