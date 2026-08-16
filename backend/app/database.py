import logging
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from app.config import settings

logger = logging.getLogger(__name__)

# Declarative Base for ORM models
Base = declarative_base()

SQLITE_FALLBACK_URL = "sqlite+aiosqlite:///./analystai.db"


def _prepare_url(url: str) -> str:
    """Add SSL param for PostgreSQL if not already present (required by Render)."""
    if url.startswith("sqlite"):
        return url
    if "postgresql" in url and "sslmode" not in url and "ssl=" not in url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}ssl=require"
    return url


def _create_engine(url: str):
    is_sqlite = url.startswith("sqlite")
    kwargs = {"future": True, "echo": False}
    if is_sqlite:
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_pre_ping"] = True
        kwargs["pool_size"] = 5
        kwargs["max_overflow"] = 10
        kwargs["pool_recycle"] = 300
    return create_async_engine(url, **kwargs)


def _build_session_factory(eng):
    return async_sessionmaker(
        bind=eng,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


# ---------- Initialise primary engine ----------
current_url = _prepare_url(settings.DATABASE_URL)
engine = _create_engine(current_url)
async_session = _build_session_factory(engine)

logger.info(f"Primary database URL type: {'SQLite' if 'sqlite' in current_url else 'PostgreSQL'}")


async def init_db():
    """
    Called once during app startup (lifespan).
    Tests the primary DB connection; if it fails, swaps to SQLite.
    Then creates all tables.
    """
    global engine, async_session, current_url

    # Try the primary (PostgreSQL) connection
    if "sqlite" not in current_url:
        try:
            async with engine.begin() as conn:
                from sqlalchemy import text
                await conn.execute(text("SELECT 1"))
            logger.info("PostgreSQL connection verified successfully.")
        except Exception as pg_err:
            logger.error(f"PostgreSQL connection failed: {pg_err}")
            logger.warning("Falling back to local SQLite database.")
            await engine.dispose()
            current_url = SQLITE_FALLBACK_URL
            engine = _create_engine(current_url)
            async_session = _build_session_factory(engine)

    # Create tables (works for both PostgreSQL and SQLite)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified successfully.")
    except Exception as err:
        logger.error(f"Failed to create database tables: {err}")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
