import uuid
from sqlalchemy import Column, String, DateTime, BigInteger, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.database import Base

class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False) # 'csv'|'xlsx'|'pdf'|'txt'|'docx'
    storage_url = Column(String, nullable=False)
    size_bytes = Column(BigInteger, nullable=True)
    status = Column(String, default="pending", server_default="pending") # 'pending'|'processing'|'ready'|'error'
    metadata_json = Column("metadata", JSONB, default={}, server_default=text("'{}'::jsonb"))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))

    # Relationships
    user = relationship("User", back_populates="documents")
    embeddings = relationship("Embedding", back_populates="document", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="document")
