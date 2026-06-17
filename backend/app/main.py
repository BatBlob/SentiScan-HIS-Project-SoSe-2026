from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.client import close_client, get_client
from app.routers import analysis, datasets


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_client()
    yield
    await close_client()


app = FastAPI(
    title="SentiScan API",
    description="Backend orchestration layer for the SentiScan sentiment analysis platform.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router, prefix="/api/v1")
app.include_router(analysis.router, prefix="/api/v1")


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "sentiscan-backend"}
