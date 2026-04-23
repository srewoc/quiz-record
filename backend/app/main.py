from fastapi import FastAPI

from app.api.main import api_router
from app.core.config import settings

app = FastAPI(
    title="Problem Record API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    return {"message": "Problem Record API is running"}

