from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from app.core.config import settings
from app.core.exceptions import ValidationAppError

IMAGE_CONTENT_TYPE_SUFFIX = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


class ImageStorageService:
    def __init__(self, base_dir: Path | None = None) -> None:
        self.base_dir = base_dir or settings.uploads_dir_path

    def save_question_image(
        self,
        *,
        filename: str | None,
        content: bytes,
        content_type: str | None,
    ) -> str:
        if not content:
            raise ValidationAppError("上传图片不能为空", code=4005)

        normalized_content_type = (content_type or "").lower()
        if not normalized_content_type.startswith("image/"):
            raise ValidationAppError("仅支持上传图片文件", code=4006)

        suffix = Path(filename or "").suffix.lower() or IMAGE_CONTENT_TYPE_SUFFIX.get(
            normalized_content_type, ".png"
        )
        relative_path = Path("question-images") / f"{uuid4().hex}{suffix}"
        absolute_path = self.base_dir / relative_path
        absolute_path.parent.mkdir(parents=True, exist_ok=True)
        absolute_path.write_bytes(content)
        return f"{settings.uploads_url_prefix}/{relative_path.as_posix()}"

    def delete_by_url(self, image_url: str | None) -> None:
        if not image_url:
            return

        prefix = f"{settings.uploads_url_prefix}/"
        if not image_url.startswith(prefix):
            return

        relative_path = image_url.removeprefix(prefix)
        target = self.base_dir / relative_path
        if target.exists():
            target.unlink()
