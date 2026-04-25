from __future__ import annotations

import base64
from typing import BinaryIO

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ServiceUnavailableError, ValidationAppError
from app.core.security import decrypt_secret
from app.models.llm_config import LLMConfig


class OCRService:
    OCR_MODULE = "ocr"

    def __init__(self, db: Session) -> None:
        self.db = db

    async def extract_markdown(self, file_obj: BinaryIO, content_type: str | None = None) -> str:
        """
        Receive an image file object, call the vision model for OCR,
        and return the recognized text content.
        """
        image_bytes = self._read_file_bytes(file_obj)
        if not image_bytes:
            raise ValidationAppError("上传图片不能为空", code=4005)

        active_config = self.db.scalar(
            select(LLMConfig).where(
                LLMConfig.module_type == self.OCR_MODULE,
                LLMConfig.is_active.is_(True),
            )
        )
        if active_config is None:
            raise ServiceUnavailableError(
                "OCR 模块未配置可用 LLM，请先在管理页面启用 OCR 配置",
                code=5021,
            )

        client = OpenAI(
            base_url=active_config.base_url,
            api_key=decrypt_secret(active_config.api_key_encrypted),
            timeout=30.0,
        )
        encoded_image = base64.b64encode(image_bytes).decode("utf-8")
        mime_type = content_type or "image/png"
        image_url = f"data:{mime_type};base64,{encoded_image}"

        try:
            response = client.chat.completions.create(
                model=active_config.model_name,
                temperature=0,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": (
                                    "你的任务是从图片(包含中英文、数学公式)中提取文本信息并结构化输出。"
                                    "请严格遵守以下规则："
                                    "1. 文本保持原顺序，不添加、删减任何内容。"
                                    "2. 数学公式使用 LaTeX 格式：$公式$。"
                                    "3. 中英文混合内容按原样保留。"
                                    "4. 只返回识别结果，不要附加解释。"
                                ),
                            },
                            {"type": "image_url", "image_url": {"url": image_url}},
                        ],
                    },
                ],
            )
        except Exception as exc:  # noqa: BLE001
            raise ServiceUnavailableError(f"OCR 服务调用失败：{exc}", code=5021) from exc

        content = (response.choices[0].message.content or "").strip()
        if not content:
            raise ServiceUnavailableError("OCR 未返回可用结果", code=5021)
        return content

    @staticmethod
    def _read_file_bytes(file_obj: BinaryIO) -> bytes:
        if hasattr(file_obj, "seek"):
            file_obj.seek(0)
        content = file_obj.read()
        if isinstance(content, str):
            return content.encode("utf-8")
        return content
