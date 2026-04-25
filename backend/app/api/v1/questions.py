from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.response import paginated_response, success_response
from app.db.deps import get_db
from app.schemas.question import (
    QuestionCreateRequest,
    QuestionDeduplicateRequest,
    QuestionListQuery,
    QuestionResponse,
    QuestionSearchTextRequest,
    QuestionUpdateRequest,
)
from app.services.question_service import QuestionService

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("")
def list_questions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    main_subject: str | None = None,
    sub_subject: str | None = None,
    is_wrong: bool | None = None,
    keyword: str | None = None,
    sort: str = "updated_at_desc",
    db: Session = Depends(get_db),
) -> dict[str, object]:
    service = QuestionService(db)
    query = QuestionListQuery(
        page=page,
        page_size=page_size,
        main_subject=main_subject,
        sub_subject=sub_subject,
        is_wrong=is_wrong,
        keyword=keyword,
        sort=sort,
    )
    items, total = service.list_questions(query)
    response_items = [
        QuestionResponse.model_validate(item).model_dump(mode="json")
        for item in items
    ]
    return paginated_response(items=response_items, page=page, page_size=page_size, total=total)


@router.get("/{question_id}")
def get_question(question_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    question = QuestionService(db).get_question(question_id)
    return success_response(QuestionResponse.model_validate(question).model_dump(mode="json"))


@router.post("", status_code=201)
def create_question(
    payload: QuestionCreateRequest,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    service = QuestionService(db)
    question = service.create_question(payload)
    return success_response(QuestionResponse.model_validate(question).model_dump(mode="json"))


@router.put("/{question_id}")
def update_question(
    question_id: int,
    payload: QuestionUpdateRequest,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    question = QuestionService(db).update_question(question_id, payload)
    return success_response(QuestionResponse.model_validate(question).model_dump(mode="json"))


@router.delete("/{question_id}")
def delete_question(question_id: int, db: Session = Depends(get_db)) -> dict[str, object]:
    return success_response(QuestionService(db).delete_question(question_id))


@router.post("/search/text")
def search_questions_by_text(
    payload: QuestionSearchTextRequest,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    result = QuestionService(db).search_by_text(payload.question_text)
    return success_response(result.model_dump(mode="json"))


@router.post("/deduplicate")
def deduplicate_questions(
    payload: QuestionDeduplicateRequest,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    result = QuestionService(db).deduplicate(payload.question_text)
    return success_response(result.model_dump(mode="json"))
