import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.user import PortableUUID


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(PortableUUID(), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False)
    agent_name = Column(String, nullable=False)
    input_data = Column("input", JSON, nullable=True)
    output_data = Column("output", JSON, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    error = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    analysis = relationship("Analysis", back_populates="agent_logs")
