from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

MODULE_TYPES = ("ocr", "question_analysis")


class LLMConfigBase(BaseModel):
    config_name: str = Field(min_length=1, max_length=128)
    module_type: str = "question_analysis"
    provider_type: str = "openai"
    base_url: HttpUrl
    model_name: str = Field(min_length=1, max_length=128)
    is_active: bool = False

    @field_validator("config_name", "model_name")
    @classmethod
    def strip_text_fields(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("字段不能为空")
        return stripped

    @field_validator("provider_type")
    @classmethod
    def validate_provider_type(cls, value: str) -> str:
        if value != "openai":
            raise ValueError("当前仅支持 openai")
        return value

    @field_validator("module_type")
    @classmethod
    def validate_module_type(cls, value: str) -> str:
        if value not in MODULE_TYPES:
            raise ValueError("模块类型非法")
        return value


class LLMConfigCreateRequest(LLMConfigBase):
    api_key: str = Field(min_length=1)


class LLMConfigUpdateRequest(LLMConfigBase):
    api_key: str | None = None


class LLMConfigResponse(LLMConfigBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    api_key_masked: str
    created_at: datetime
    updated_at: datetime


class LLMConfigActivateResponse(BaseModel):
    id: int
    is_active: bool


class LLMConfigTestRequest(BaseModel):
    module_type: str = "question_analysis"
    provider_type: str = "openai"
    base_url: HttpUrl
    api_key: str = Field(min_length=1)
    model_name: str = Field(min_length=1, max_length=128)

    @field_validator("module_type")
    @classmethod
    def validate_module_type(cls, value: str) -> str:
        if value not in MODULE_TYPES:
            raise ValueError("模块类型非法")
        return value

    @field_validator("provider_type")
    @classmethod
    def validate_provider_type(cls, value: str) -> str:
        if value != "openai":
            raise ValueError("当前仅支持 openai")
        return value


class LLMConfigTestResponse(BaseModel):
    success: bool
    module_type: str
    provider_type: str
    model_name: str
    detail: str
