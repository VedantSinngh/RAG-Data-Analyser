import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.user import PortableUUID


class Embedding(Base):
    __tablename__ = "embeddings"

    id = Column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    document_id = Column(PortableUUID(), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    chunk_text = Column(String, nullable=False)
    chroma_id = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    document = relationship("Document", back_populates="embeddings")
