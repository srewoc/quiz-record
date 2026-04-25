from __future__ import annotations

from sqlalchemy import Select, func, literal, or_, select
from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.models.question import Question
from app.schemas.question import (
    SUBJECT_MAPPING,
    DeduplicateResultResponse,
    QuestionCreateRequest,
    QuestionListQuery,
    QuestionResponse,
    QuestionSearchResponse,
    QuestionUpdateRequest,
)
from app.services.llm_client import LLMClient


class QuestionService:
    def __init__(self, db: Session, llm_client: LLMClient | None = None) -> None:
        self.db = db
        self.llm_client = llm_client or LLMClient(db)

    def list_questions(self, query: QuestionListQuery) -> tuple[list[Question], int]:
        statement: Select[tuple[Question]] = select(Question).where(Question.is_deleted.is_(False))
        count_statement = select(func.count(Question.id)).where(Question.is_deleted.is_(False))

        if query.main_subject:
            statement = statement.where(Question.main_subject == query.main_subject)
            count_statement = count_statement.where(Question.main_subject == query.main_subject)
        if query.sub_subject:
            statement = statement.where(Question.sub_subject == query.sub_subject)
            count_statement = count_statement.where(Question.sub_subject == query.sub_subject)
        if query.is_wrong is not None:
            statement = statement.where(Question.is_wrong.is_(query.is_wrong))
            count_statement = count_statement.where(Question.is_wrong.is_(query.is_wrong))
        if query.keyword:
            keyword = f"%{query.keyword.strip()}%"
            statement = statement.where(
                or_(
                    Question.question_text.ilike(keyword),
                    Question.reference_answer.ilike(keyword),
                )
            )
            count_statement = count_statement.where(
                or_(
                    Question.question_text.ilike(keyword),
                    Question.reference_answer.ilike(keyword),
                )
            )

        if query.sort == "updated_at_desc":
            statement = statement.order_by(Question.updated_at.desc())
        else:
            statement = statement.order_by(Question.updated_at.desc())

        total = self.db.scalar(count_statement) or 0
        offset = (query.page - 1) * query.page_size
        items = self.db.scalars(statement.offset(offset).limit(query.page_size)).all()
        return items, total

    def get_question(self, question_id: int) -> Question:
        question = self.db.scalar(
            select(Question).where(Question.id == question_id, Question.is_deleted.is_(False))
        )
        if question is None:
            raise NotFoundError("题目不存在", code=4041)
        return question

    def create_question(self, payload: QuestionCreateRequest) -> Question:
        self._validate_subject_pair(payload.main_subject, payload.sub_subject)
        self.ensure_not_duplicate(payload.question_text)
        question = Question(**payload.model_dump(mode="json"))
        self.db.add(question)
        self.db.commit()
        self.db.refresh(question)
        return question

    def update_question(self, question_id: int, payload: QuestionUpdateRequest) -> Question:
        self._validate_subject_pair(payload.main_subject, payload.sub_subject)
        question = self.get_question(question_id)
        for key, value in payload.model_dump(mode="json").items():
            setattr(question, key, value)
        self.db.add(question)
        self.db.commit()
        self.db.refresh(question)
        return question

    def delete_question(self, question_id: int) -> dict[str, object]:
        question = self.get_question(question_id)
        question.is_deleted = True
        self.db.add(question)
        self.db.commit()
        return {"id": question_id, "deleted": True}

    def search_by_text(self, question_text: str) -> QuestionSearchResponse:
        candidates = self.find_candidates(question_text)
        deduplicate_result = self.llm_client.analyze_question(question_text, candidates)
        matched_question = None
        if deduplicate_result.matched_question_id is not None:
            matched_question = self.db.scalar(
                select(Question).where(
                    Question.id == deduplicate_result.matched_question_id,
                    Question.is_deleted.is_(False),
                )
            )
        return QuestionSearchResponse(
            input_text=question_text,
            candidates=[QuestionResponse.model_validate(item) for item in candidates],
            deduplicate_result=deduplicate_result,
            matched_question=QuestionResponse.model_validate(matched_question)
            if matched_question
            else None,
        )

    def deduplicate(self, question_text: str) -> DeduplicateResultResponse:
        candidates = self.find_candidates(question_text)
        return self.llm_client.analyze_question(question_text, candidates)

    def find_candidates(self, question_text: str, limit: int = 20) -> list[Question]:
        if not question_text.strip():
            raise ValidationAppError("题目文本不能为空")

        safe_limit = min(limit, 20)
        dialect_name = self.db.bind.dialect.name if self.db.bind is not None else ""
        if dialect_name == "postgresql":
            similarity_score = func.similarity(Question.question_text, question_text)
            statement = (
                select(Question, similarity_score.label("similarity_score"))
                .where(Question.is_deleted.is_(False))
                .order_by(similarity_score.desc(), Question.updated_at.desc())
                .limit(safe_limit)
            )
            rows = self.db.execute(statement).all()
        else:
            statement = (
                select(Question, literal(0.0).label("similarity_score"))
                .where(Question.is_deleted.is_(False))
                .order_by(Question.updated_at.desc())
                .limit(safe_limit)
            )
            rows = self.db.execute(statement).all()

        candidates: list[Question] = []
        for question, similarity_score in rows:
            question.similarity_score = float(similarity_score or 0.0)  # type: ignore[attr-defined]
            candidates.append(question)
        return candidates

    def check_existing_question(self, question_text: str) -> Question | None:
        candidates = self.find_candidates(question_text, limit=5)
        normalized = "".join(question_text.split())
        for candidate in candidates:
            if "".join(candidate.question_text.split()) == normalized:
                return candidate
        return None

    def ensure_not_duplicate(self, question_text: str) -> None:
        existing = self.check_existing_question(question_text)
        if existing:
            raise ConflictError(f"题目已存在，ID={existing.id}", code=4091)

    @staticmethod
    def _validate_subject_pair(main_subject: str, sub_subject: str) -> None:
        if sub_subject not in SUBJECT_MAPPING.get(main_subject, set()):
            raise ValidationAppError("主科目与子科目不匹配", code=4002)
