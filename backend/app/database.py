import logging
import asyncio
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from app.config import settings

logger = logging.getLogger(__name__)

# Declarative Base for ORM models
Base = declarative_base()

SQLITE_FALLBACK_URL = "sqlite+aiosqlite:///./analystai.db"

def create_db_engine(url: str):
    is_sqlite = url.startswith("sqlite")
    engine_kwargs = {
        "echo": settings.APP_ENV == "development",
        "future": True
    }
    if is_sqlite:
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    else:
        # For PostgreSQL, add pool settings to handle connection drops gracefully
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_size"] = 5
        engine_kwargs["max_overflow"] = 10
        engine_kwargs["pool_recycle"] = 300
    return create_async_engine(url, **engine_kwargs)


def _resolve_database_url() -> str:
    """
    Determine which database URL to use.

    If DATABASE_URL points to a PostgreSQL host that clearly can't be reached
    (e.g. Docker-Compose hostname 'postgres' when running on Render), fall back
    to local SQLite immediately instead of failing on every request.
    """
    url = settings.DATABASE_URL

    # If it's already sqlite, just use it
    if url.startswith("sqlite"):
        return url

    # Quick DNS sanity-check for postgres hostname
    # Extract host from the URL: postgresql+asyncpg://user:pass@HOST:port/db
    try:
        import re
        match = re.search(r"@([^/:]+)", url)
        if match:
            host = match.group(1)
            # If the host is 'postgres' or 'localhost' or '127.0.0.1', and we're
            # running in production on Render, it won't resolve.
            import socket
            socket.getaddrinfo(host, None)
            logger.info(f"PostgreSQL host '{host}' is resolvable. Using PostgreSQL.")
            return url
    except socket.gaierror:
        logger.warning(
            f"PostgreSQL host '{host}' cannot be resolved (DNS failure). "
            f"Falling back to local SQLite database."
        )
        return SQLITE_FALLBACK_URL
    except Exception as e:
        logger.warning(f"Error checking database host: {e}. Falling back to SQLite.")
        return SQLITE_FALLBACK_URL

    return url


current_url = _resolve_database_url()
logger.info(f"Using database: {'SQLite (local fallback)' if 'sqlite' in current_url else 'PostgreSQL'}")

engine = create_db_engine(current_url)

async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency generator that yields an active database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

