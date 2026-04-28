from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.security import decrypt_secret, encrypt_secret, mask_secret
from app.models.llm_config import LLMConfig
from app.schemas.llm_config import (
    LLMConfigActivateResponse,
    LLMConfigCreateRequest,
    LLMConfigResponse,
    LLMConfigTestRequest,
    LLMConfigTestResponse,
    LLMConfigUpdateRequest,
)
from app.services.llm_client import LLMClient


class LLMConfigService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_configs(self) -> list[LLMConfigResponse]:
        configs = self.db.scalars(
            select(LLMConfig).order_by(LLMConfig.module_type.asc(), LLMConfig.updated_at.desc())
        ).all()
        return [self._to_response(item) for item in configs]

    def create_config(self, payload: LLMConfigCreateRequest) -> LLMConfigResponse:
        if payload.is_active:
            self._deactivate_all(payload.module_type)
        config = LLMConfig(
            config_name=payload.config_name,
            module_type=payload.module_type,
            provider_type=payload.provider_type,
            base_url=str(payload.base_url),
            api_key_encrypted=encrypt_secret(payload.api_key),
            model_name=payload.model_name,
            is_active=payload.is_active,
        )
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return self._to_response(config)

    def update_config(self, config_id: int, payload: LLMConfigUpdateRequest) -> LLMConfigResponse:
        config = self._get_model(config_id)
        if payload.is_active:
            self._deactivate_all(payload.module_type, exclude_id=config_id)
        config.config_name = payload.config_name
        config.module_type = payload.module_type
        config.provider_type = payload.provider_type
        config.base_url = str(payload.base_url)
        config.model_name = payload.model_name
        config.is_active = payload.is_active
        if payload.api_key:
            config.api_key_encrypted = encrypt_secret(payload.api_key)
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return self._to_response(config)

    def activate_config(self, config_id: int) -> LLMConfigActivateResponse:
        config = self._get_model(config_id)
        self._deactivate_all(config.module_type, exclude_id=config_id)
        config.is_active = True
        self.db.add(config)
        self.db.commit()
        return LLMConfigActivateResponse(id=config.id, is_active=True)

    def delete_config(self, config_id: int) -> dict[str, object]:
        config = self._get_model(config_id)
        self.db.delete(config)
        self.db.commit()
        return {"id": config_id, "deleted": True}

    def get_active_config(self, module_type: str) -> LLMConfig | None:
        return self.db.scalar(
            select(LLMConfig).where(
                LLMConfig.module_type == module_type,
                LLMConfig.is_active.is_(True),
            )
        )

    def test_connection(self, payload: LLMConfigTestRequest) -> LLMConfigTestResponse:
        client = LLMClient(self.db)
        detail = client.test_connection(
            provider_type=payload.provider_type,
            base_url=str(payload.base_url),
            api_key=payload.api_key,
            model_name=payload.model_name,
        )
        return LLMConfigTestResponse(
            success=True,
            module_type=payload.module_type,
            provider_type=payload.provider_type,
            model_name=payload.model_name,
            detail=detail,
        )

    def _get_model(self, config_id: int) -> LLMConfig:
        config = self.db.scalar(select(LLMConfig).where(LLMConfig.id == config_id))
        if config is None:
            raise NotFoundError("LLM 配置不存在", code=4042)
        return config

    def _deactivate_all(self, module_type: str, exclude_id: int | None = None) -> None:
        configs = self.db.scalars(
            select(LLMConfig).where(
                LLMConfig.module_type == module_type,
                LLMConfig.is_active.is_(True),
            )
        ).all()
        for config in configs:
            if exclude_id is not None and config.id == exclude_id:
                continue
            config.is_active = False
            self.db.add(config)
        self.db.flush()

    def _to_response(self, config: LLMConfig) -> LLMConfigResponse:
        return LLMConfigResponse(
            id=config.id,
            config_name=config.config_name,
            module_type=config.module_type,
            provider_type=config.provider_type,
            base_url=config.base_url,
            api_key_masked=mask_secret(decrypt_secret(config.api_key_encrypted)),
            model_name=config.model_name,
            is_active=config.is_active,
            created_at=config.created_at,
            updated_at=config.updated_at,
        )
