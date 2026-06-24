from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import field_validator

# backend/ directory: resolves to the project's backend folder locally and /app in Docker.
BACKEND_DIR: Path = Path(__file__).resolve().parent.parent

class Settings(BaseSettings):
    APP_ENV: str = "development"
    SECRET_KEY: str = "dev_secret_key"
    FRONTEND_URL: str = "http://localhost:3000"

    # Database URL
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@postgres:5432/analystai"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def format_database_url(cls, v: str) -> str:
        if v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://") and "+asyncpg" not in v:
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # Groq API config (OpenAI-compatible)
    # Base URL: https://api.groq.com/openai/v1
    # Get your free API key at: https://console.groq.com
    GROQ_API_KEY: str = "your-groq-api-key-here"
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"

    # HuggingFace Inference API for embeddings (optional — free tier available)
    # Groq has no embeddings endpoint, so we use HuggingFace or fall back to local hash
    HUGGINGFACE_API_KEY: str = ""

    # Storage paths — derived from backend dir so they work both locally and in Docker.
    # In Docker, /app/app/config.py -> BACKEND_DIR = /app (matches the WORKDIR + volume).
    UPLOAD_DIR: str = str(BACKEND_DIR / "uploads")
    REPORTS_DIR: str = str(BACKEND_DIR / "uploads" / "reports")

    # Vector DB settings
    CHROMA_PERSIST_DIR: str = str(BACKEND_DIR / "chroma_db")
    CHROMA_COLLECTION_NAME: str = "analystai_docs"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()

