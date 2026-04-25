from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.core.response import success_response
from app.db.deps import get_db
from app.services.image_storage import ImageStorageService
from app.services.ocr import OCRService
from app.services.question_service import QuestionService

router = APIRouter(prefix="/questions/search", tags=["question-search"])


@router.post("/image")
async def search_questions_by_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    image_content = await file.read()
    storage_service = ImageStorageService()
    image_url = storage_service.save_question_image(
        filename=file.filename,
        content=image_content,
        content_type=file.content_type,
    )

    try:
        await file.seek(0)
        ocr_text = await OCRService(db).extract_markdown(file.file, file.content_type)
        result = QuestionService(db).search_by_text(ocr_text)
    except Exception:
        storage_service.delete_by_url(image_url)
        raise

    if result.deduplicate_result.exists:
        storage_service.delete_by_url(image_url)
        image_url = None

    return success_response(
        {
            "image_url": image_url,
            "ocr_text": ocr_text,
            "candidates": [item.model_dump(mode="json") for item in result.candidates],
            "deduplicate_result": result.deduplicate_result.model_dump(mode="json"),
            "matched_question": result.matched_question.model_dump(mode="json")
            if result.matched_question
            else None,
        }
    )
