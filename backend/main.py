"""NyayaAI — FastAPI entry point."""
import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from .models.database import init_db
from .routers import auth, cases, courtroom, evaluation, evidence, leaderboard, demeanor
from .services.rag_service import IndianLawRAG

# Resolve frontend path — works both locally and in Docker
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend-dist")
if not os.path.isdir(FRONTEND_DIR):
    # Docker: /app/frontend-dist
    FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "../../frontend-dist")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    rag = IndianLawRAG()
    data_dir = os.path.join(os.path.dirname(__file__), "data/new_criminal_laws")
    full_files = ["bns_full.txt", "bnss_full.txt", "bsa_full.txt"]
    full_files_exist = all(os.path.exists(os.path.join(data_dir, f)) for f in full_files)
    # Re-index if empty OR if full corpus files exist but index is small (key-sections only)
    needs_reindex = not rag.is_indexed() or (full_files_exist and rag.collection.count() < 200)
    if needs_reindex:
        print("Indexing BNS/BNSS/BSA full corpus into ChromaDB...")
        rag.index_laws()
    else:
        print(f"RAG index ready ({rag.collection.count()} sections).")
    yield
    # Shutdown (nothing needed)


app = FastAPI(
    title="NyayaAI API",
    description="AI-powered courtroom simulation — BNS/BNSS/BSA compliant",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_legal_framework_header(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Legal-Framework"] = "BNS-BNSS-BSA"
    return response


# Mount routers
PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(cases.router, prefix=PREFIX)
app.include_router(courtroom.router, prefix=PREFIX)
app.include_router(evaluation.router, prefix=PREFIX)
app.include_router(evidence.router, prefix=PREFIX)
app.include_router(leaderboard.router, prefix=PREFIX)
app.include_router(demeanor.router, prefix=PREFIX)


@app.get("/health")
async def health():
    rag = IndianLawRAG()
    return {
        "status": "ok",
        "legal_framework": "BNS/BNSS/BSA",
        "rag_indexed": rag.is_indexed(),
        "version": "2.0.0"
    }


@app.get("/")
async def root():
    return RedirectResponse(url="/pages/landing.html")


@app.exception_handler(404)
async def not_found(request: Request, exc):
    return JSONResponse(status_code=404, content={"detail": "Not found"})


@app.exception_handler(500)
async def server_error(request: Request, exc):
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


# Mount frontend static files AFTER all API routes (only if built)
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
