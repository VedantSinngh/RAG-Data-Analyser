from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.config import settings
from app import database
from app.database import init_db
from app.models import Base  # This loads all models so they register on Base
from app.routers import auth, documents, analysis, chat, reports

import logging
import re

logger = logging.getLogger(__name__)

# ---------- Production CORS origins ----------
# Explicit list of allowed origins (deduplicated, stripped)
_RAW_ORIGINS = [
    settings.FRONTEND_URL,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://rag-data-analyser.vercel.app",
]
ALLOWED_ORIGINS = list(set(o.strip().rstrip("/") for o in _RAW_ORIGINS if o and o.strip()))
# Regex to match any Vercel preview/branch deploy (e.g. https://<slug>.vercel.app)
ORIGIN_REGEX = re.compile(r"^https://[\w\-]+\.vercel\.app$")

logger.info(f"CORS allowed origins: {ALLOWED_ORIGINS}")


class CORSPreflight(BaseHTTPMiddleware):
    """
    Explicit preflight handler that runs *before* Starlette's CORSMiddleware.

    On Render (and similar PaaS), the built-in CORSMiddleware sometimes fails
    to attach headers when running behind a reverse-proxy that alters the Host
    header. This middleware catches every incoming request and ensures the
    correct `Access-Control-*` headers are present on both preflight (OPTIONS)
    and actual responses.
    """

    def _origin_allowed(self, origin: str | None) -> bool:
        if not origin:
            return False
        origin = origin.strip().rstrip("/")
        if origin in ALLOWED_ORIGINS:
            return True
        if ORIGIN_REGEX.match(origin):
            return True
        return False

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "")

        if not self._origin_allowed(origin):
            # Not an allowed origin — let the request through without CORS headers
            return await call_next(request)

        # Handle preflight OPTIONS request directly
        if request.method == "OPTIONS":
            response = JSONResponse(content={"detail": "OK"}, status_code=200)
        else:
            try:
                response = await call_next(request)
            except Exception:
                # If the app crashes (e.g. DB down), still return CORS headers
                # so the browser shows the real error instead of "CORS blocked"
                response = JSONResponse(
                    content={"detail": "Internal server error"},
                    status_code=500
                )

        # Attach CORS headers
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = (
            "Authorization, Content-Type, Accept, Origin, X-Requested-With, "
            "X-Groq-Api-Key, X-Groq-Model, X-HuggingFace-Api-Key"
        )
        response.headers["Access-Control-Expose-Headers"] = (
            "Content-Length, Content-Type, X-Request-Id"
        )
        response.headers["Access-Control-Max-Age"] = "600"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create dirs + test DB (falls back to SQLite if PostgreSQL is down)
    import os
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.REPORTS_DIR, exist_ok=True)
    await init_db()
    yield
    # Shutdown
    await database.engine.dispose()

app = FastAPI(
    title="AnalystAI API",
    description="Production-grade, Multi-Agent RAG-powered Data Analysis Platform backend service.",
    version="1.0.0",
    lifespan=lifespan
)

# Custom CORS handler (must be added first so it runs outermost)
app.add_middleware(CORSPreflight)

# Starlette's built-in CORSMiddleware as a secondary layer (belt-and-suspenders)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https://[\w\-]+\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Type", "X-Request-Id"],
    max_age=600,
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
