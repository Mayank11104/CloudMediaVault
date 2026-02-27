import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse  # ✅ ADD THIS
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.routers import auth, files, albums, recycle_bin

# ── Rate Limiter ───────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

# ── FastAPI App ────────────────────────────────────────────
app = FastAPI(title="CloudMediaVault API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── CORS ───────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",                    # Vite dev
        "https://d1wujzujzktfpn.cloudfront.net/login",  # Production frontend
                   # Replace with YOUR domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Body Size Limit Middleware ─────────────────────────────
MAX_UPLOAD_SIZE = 100 * 1024 * 1024  # 100 MB

@app.middleware("http")
async def limit_body_size(request: Request, call_next):
    if request.method in ["POST", "PUT", "PATCH"]:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_UPLOAD_SIZE:
            return JSONResponse(
                status_code=413,
                content={"detail": "File too large. Max size is 100MB"}
            )
    return await call_next(request)

# ── Health Check ───────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok"}

# ── Routers ────────────────────────────────────────────────
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(files.router, prefix="/files", tags=["files"])
app.include_router(albums.router, prefix="/albums", tags=["albums"])
app.include_router(recycle_bin.router, prefix="/recycle-bin", tags=["recycle-bin"])
