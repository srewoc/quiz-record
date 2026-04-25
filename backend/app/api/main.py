from fastapi import APIRouter

from app.api.v1.health import router as health_router
from app.api.v1.llm_configs import router as llm_config_router
from app.api.v1.question_search import router as question_search_router
from app.api.v1.questions import router as question_router

api_router = APIRouter()
api_router.include_router(health_router, prefix="/health", tags=["health"])
api_router.include_router(question_router)
api_router.include_router(question_search_router)
api_router.include_router(llm_config_router)
