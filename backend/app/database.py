import logging
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from app.config import settings

logger = logging.getLogger(__name__)

# Declarative Base for ORM models
Base = declarative_base()

def create_db_engine(url: str):
    is_sqlite = url.startswith("sqlite")
    engine_kwargs = {
        "echo": settings.APP_ENV == "development",
        "future": True
    }
    if is_sqlite:
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    return create_async_engine(url, **engine_kwargs)

current_url = settings.DATABASE_URL
engine = create_db_engine(current_url)

async_session = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency generator that yields an active database session.
    If PostgreSQL host resolution fails (gaierror), falls back to a local SQLite database automatically.
    """
    global engine, async_session, current_url
    try:
        async with async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()
    except Exception as err:
        err_str = str(err)
        if ("gaierror" in err_str or "Name or service not known" in err_str or "refused" in err_str) and not current_url.startswith("sqlite"):
            logger.warning(f"PostgreSQL connection failed ({err_str}). Switching to fallback local SQLite database.")
            current_url = "sqlite+aiosqlite:///./analystai.db"
            engine = create_db_engine(current_url)
            
            # Ensure tables exist in fallback SQLite DB
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                
            async_session = async_sessionmaker(
                bind=engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autocommit=False,
                autoflush=False
            )
            
            async with async_session() as session:
                try:
                    yield session
                    await session.commit()
                except Exception:
                    await session.rollback()
                    raise
                finally:
                    await session.close()
        else:
            raise err

