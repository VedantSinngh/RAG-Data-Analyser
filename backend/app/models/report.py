import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    storage_url = Column(String, nullable=True) # PDF URL
    summary = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

    # Relationships
    user = relationship("User", back_populates="reports")
    analysis = relationship("Analysis", back_populates="reports")
