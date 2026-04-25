from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

SUBJECT_MAPPING = {
    "数学": {"数学-高数", "数学-线代", "数学-概率论"},
    "408": {"408-数据结构", "408-计组", "408-操作系统", "408-计网"},
}


class QuestionBase(BaseModel):
    question_text: str = Field(min_length=1)
    main_subject: str
    sub_subject: str
    is_wrong: bool = False
    image_url: str | None = None
    reference_answer: str | None = None

    @field_validator("question_text")
    @classmethod
    def validate_question_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("题目文本不能为空")
        return stripped

    @field_validator("main_subject")
    @classmethod
    def validate_main_subject(cls, value: str) -> str:
        if value not in SUBJECT_MAPPING:
            raise ValueError("主科目非法")
        return value

    @field_validator("sub_subject")
    @classmethod
    def validate_sub_subject(cls, value: str) -> str:
        valid_sub_subjects = {item for values in SUBJECT_MAPPING.values() for item in values}
        if value not in valid_sub_subjects:
            raise ValueError("子科目非法")
        return value

    @field_validator("reference_answer")
    @classmethod
    def normalize_reference_answer(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("image_url")
    @classmethod
    def normalize_image_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("sub_subject")
    @classmethod
    def validate_subject_pair(cls, value: str, info) -> str:
        main_subject = info.data.get("main_subject")
        if main_subject and value not in SUBJECT_MAPPING.get(main_subject, set()):
            raise ValueError("主科目与子科目不匹配")
        return value


class QuestionCreateRequest(QuestionBase):
    image_url: str = Field(min_length=1)


class QuestionUpdateRequest(QuestionBase):
    pass


class QuestionResponse(QuestionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


class QuestionListQuery(BaseModel):
    page: int = 1
    page_size: int = 20
    main_subject: str | None = None
    sub_subject: str | None = None
    is_wrong: bool | None = None
    keyword: str | None = None
    sort: str = "updated_at_desc"


class QuestionSearchTextRequest(BaseModel):
    question_text: str = Field(min_length=1)


class QuestionDeduplicateRequest(QuestionSearchTextRequest):
    pass


class DeduplicateResultResponse(BaseModel):
    exists: bool
    matched_question_id: int | None = None
    main_subject: str | None = None
    sub_subject: str | None = None
    reason: str


class QuestionSearchResponse(BaseModel):
    input_text: str
    candidates: list[QuestionResponse]
    deduplicate_result: DeduplicateResultResponse
    matched_question: QuestionResponse | None = None


class QuestionImageSearchResponse(BaseModel):
    image_url: str | None = None
    ocr_text: str
    candidates: list[QuestionResponse]
    deduplicate_result: DeduplicateResultResponse
    matched_question: QuestionResponse | None = None
