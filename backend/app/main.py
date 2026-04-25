from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.main import api_router
from app.core.config import settings
from app.core.exceptions import AppError
from app.core.response import success_response

app = FastAPI(
    title="Problem Record API",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings.uploads_dir_path.mkdir(parents=True, exist_ok=True)
app.mount(
    settings.uploads_url_prefix,
    StaticFiles(directory=str(settings.uploads_dir_path), check_dir=False),
    name="uploads",
)

app.include_router(api_router, prefix=settings.api_v1_prefix)


@app.exception_handler(AppError)
async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.code, "message": exc.message, "data": None},
    )


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"code": 4001, "message": "参数校验失败", "data": exc.errors()},
    )


@app.get("/", tags=["system"])
def root() -> dict[str, object]:
    return success_response({"message": "Problem Record API is running"})
