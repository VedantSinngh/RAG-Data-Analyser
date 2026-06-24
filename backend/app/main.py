from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine
from app.models import Base  # This loads all models so they register on Base
from app.routers import auth, documents, analysis, chat, reports

# Define lifespan event to auto-generate tables on startup (for local development)
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    import os
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.REPORTS_DIR, exist_ok=True)
    async with engine.begin() as conn:
        # Create all tables on startup if they don't exist
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Shutdown actions
    await engine.dispose()

app = FastAPI(
    title="AnalystAI API",
    description="Production-grade, Multi-Agent RAG-powered Data Analysis Platform backend service.",
    version="1.0.0",
    lifespan=lifespan
)

# Set up CORS middleware
origins = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")

@app.get("/")
async def root():
    return {
        "message": "Welcome to the AnalystAI API",
        "version": "1.0.0",
        "docs_url": "/docs"
    }

@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "ok",
        "environment": settings.APP_ENV
    }
