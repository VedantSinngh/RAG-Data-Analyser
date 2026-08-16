import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, BigInteger, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.user import PortableUUID


class Document(Base):
    __tablename__ = "documents"

    id = Column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(PortableUUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # 'csv'|'xlsx'|'pdf'|'txt'|'docx'
    storage_url = Column(String, nullable=False)
    size_bytes = Column(BigInteger, nullable=True)
    status = Column(String, default="pending", server_default="pending")  # 'pending'|'processing'|'ready'|'error'
    metadata_json = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="documents")
    embeddings = relationship("Embedding", back_populates="document", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="document")
