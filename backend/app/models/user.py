import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, TypeDecorator, CHAR
from sqlalchemy.orm import relationship
from app.database import Base


class PortableUUID(TypeDecorator):
    """UUID type that works on both PostgreSQL (native UUID) and SQLite (CHAR(32))."""
    impl = CHAR(32)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value.hex
        return uuid.UUID(value).hex

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(value)


class User(Base):
    __tablename__ = "users"

    id = Column(PortableUUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=True)
    role = Column(String, default="user", server_default="user")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    documents = relationship("Document", back_populates="user", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="user", cascade="all, delete-orphan")
    reports = relationship("Report", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
