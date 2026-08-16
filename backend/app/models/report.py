import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.user import PortableUUID


class Report(Base):
    __tablename__ = "reports"

    id = Column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(PortableUUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    analysis_id = Column(PortableUUID(), ForeignKey("analyses.id", ondelete="SET NULL"), nullable=True)
    title = Column(String, nullable=False)
    storage_url = Column(String, nullable=True)  # PDF URL
    summary = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="reports")
    analysis = relationship("Analysis", back_populates="reports")
