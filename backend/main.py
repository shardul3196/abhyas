from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

try:
    from backend.database import UPLOADS_DIR, init_db
    from backend.routers import admin, analytics, attempts, exams, questions
except ImportError:
    from database import UPLOADS_DIR, init_db
    from routers import admin, analytics, attempts, exams, questions


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="SSC CGL Local-First Mock Test & Analytics API",
    version="1.0.0",
    lifespan=lifespan,
)

# Open CORS for local LAN tablet access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded question images statically from /uploads
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Register Phase 1 & Phase 2 routers
app.include_router(exams.router)
app.include_router(admin.router)
app.include_router(questions.router)
app.include_router(attempts.router)
app.include_router(analytics.router)


@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok"}
