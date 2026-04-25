from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.response import success_response
from app.db.deps import get_db
from app.schemas.llm_config import (
    LLMConfigCreateRequest,
    LLMConfigTestRequest,
    LLMConfigUpdateRequest,
)
from app.services.llm_config_service import LLMConfigService

router = APIRouter(prefix="/llm-configs", tags=["llm-configs"])


@router.get("")
def list_llm_configs(db: Session = Depends(get_db)) -> dict[str, object]:
    items = [item.model_dump(mode="json") for item in LLMConfigService(db).list_configs()]
    return success_response({"items": items})


@router.post("", status_code=201)
def create_llm_config(
    payload: LLMConfigCreateRequest,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    config = LLMConfigService(db).create_config(payload)
    return success_response(config.model_dump(mode="json"))


@router.put("/{config_id}")
def update_llm_config(
    config_id: int,
    payload: LLMConfigUpdateRequest,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    config = LLMConfigService(db).update_config(config_id, payload)
    return success_response(config.model_dump(mode="json"))


@router.post("/{config_id}/activate")
def activate_llm_config(config_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    result = LLMConfigService(db).activate_config(config_id)
    return success_response(result.model_dump(mode="json"))


@router.post("/test")
def test_llm_config(
    payload: LLMConfigTestRequest,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    result = LLMConfigService(db).test_connection(payload)
    return success_response(result.model_dump(mode="json"))
