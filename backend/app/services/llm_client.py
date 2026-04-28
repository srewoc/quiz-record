from __future__ import annotations

import json
import re

from openai import OpenAI
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import ServiceUnavailableError
from app.core.security import decrypt_secret
from app.models.llm_config import LLMConfig
from app.models.question import Question
from app.schemas.question import SUBJECT_MAPPING, DeduplicateResultResponse


class LLMClient:
    QUESTION_ANALYSIS_MODULE = "question_analysis"

    def __init__(self, db: Session) -> None:
        self.db = db

    def analyze_question(
        self,
        question_text: str,
        candidates: list[Question],
    ) -> DeduplicateResultResponse:
        active_config = self._get_active_config(self.QUESTION_ANALYSIS_MODULE)
        if active_config is None:
            raise ServiceUnavailableError(
                "题目匹配与科目识别模块未配置可用 LLM，请先前往管理页面完成配置",
                code=5023,
            )

        prompt = self._build_analysis_prompt(question_text, candidates)
        client = self._build_client(
            base_url=active_config.base_url,
            api_key=decrypt_secret(active_config.api_key_encrypted),
        )

        try:
            response = client.chat.completions.create(
                model=active_config.model_name,
                temperature=0,
                messages=[
                    {
                        "role": "system",
                        "content": self._build_system_prompt(),
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                extra_body={"thinking": {"type": "disabled"}},
            )
        except Exception as exc:  # noqa: BLE001
            raise ServiceUnavailableError(f"LLM 服务调用失败：{exc}", code=5022) from exc

        payload = self._parse_analysis_response(response.choices[0].message.content)

        return DeduplicateResultResponse(
            exists=bool(payload.get("exists", False)),
            matched_question_id=payload.get("matched_question_id"),
            main_subject=self._normalize_main_subject(payload.get("main_subject")),
            sub_subject=self._normalize_sub_subject(payload.get("sub_subject")),
            reason=payload.get("reason", "LLM 未返回说明"),
        )

    def test_connection(
        self,
        *,
        provider_type: str,
        base_url: str,
        api_key: str,
        model_name: str,
    ) -> str:
        if provider_type != "openai":
            raise ServiceUnavailableError("当前仅支持 openai", code=4004)

        client = self._build_client(base_url=base_url, api_key=api_key)
        try:
            response = client.chat.completions.create(
                model=model_name,
                temperature=0,
                messages=[{"role": "user", "content": "Reply with OK only."}],
                max_tokens=5,
            )
        except Exception as exc:  # noqa: BLE001
            raise ServiceUnavailableError(f"LLM 服务调用失败：{exc}", code=5022) from exc

        content = response.choices[0].message.content or ""
        return f"连接测试成功：{content.strip() or 'OK'}"

    @staticmethod
    def _build_client(*, base_url: str, api_key: str) -> OpenAI:
        return OpenAI(base_url=base_url, api_key=api_key, timeout=20.0)

    def _get_active_config(self, module_type: str) -> LLMConfig | None:
        return self.db.scalar(
            select(LLMConfig).where(
                LLMConfig.module_type == module_type,
                LLMConfig.is_active.is_(True),
            )
        )

    @staticmethod
    def _build_analysis_prompt(question_text: str, candidates: list[Question]) -> str:
        candidate_payload = [
            (
                item.id,
                item.question_text,
                item.is_wrong,
                item.main_subject,
                item.sub_subject,
                round(float(getattr(item, "similarity_score", 0.0)), 6),
            )
            for item in candidates[:20]
        ]
        return (
            "请根据输入题目与候选题目判断是否已存在完全相同或语义等价的题目。"
            "如果已存在，返回 exists=true 和 matched_question_id。"
            "如果不存在，请识别主科目与子科目。"
            f"主科目只能是：{', '.join(SUBJECT_MAPPING.keys())}。"
            "子科目只能是：高数、线代、概率论、数据结构、计组、操作系统、计网。"
            '返回 JSON 格式：{"exists": boolean, "matched_question_id": number|null, '
            '"main_subject": string|null, "sub_subject": string|null, "reason": string}。'
            f"\n输入题目：{question_text}"
            "\n候选题目列表结构为：(题目ID,题目内容,错题标记,主科目,子科目,题目相似度)。"
            "候选题目已按题目相似度从高到低排序，最多提供 20 条。"
            "\n候选题目："
            f"{json.dumps(candidate_payload, ensure_ascii=False)}"
        )

    @staticmethod
    def _build_system_prompt() -> str:
        return (
            "你是题目去重与学科分类助手。"
            "你必须只返回 JSON，不要输出 Markdown、代码块或解释。"
            '返回字段必须使用内部字段名：{"exists": boolean, "matched_question_id": number|null, '
            '"main_subject": string|null, "sub_subject": string|null, "reason": string}。'
            'main_subject 只能取值 "数学" 或 "408"。'
            "sub_subject 只能取值：高数、线代、概率论、数据结构、计组、操作系统、计网。"
            "当 exists 为 true 时，必须返回 matched_question_id。"
            "当 exists 为 false 时，matched_question_id 返回 null。"
        )

    @staticmethod
    def _parse_analysis_response(content: str | None) -> dict[str, object]:
        if content is None:
            raise ServiceUnavailableError("LLM 返回内容为空", code=5022)

        content_str = str(content).strip()
        content_str = re.sub(r"^```json\s*", "", content_str)
        content_str = re.sub(r"^```\s*", "", content_str)
        content_str = re.sub(r"\s*```$", "", content_str)
        content_str = content_str.strip()

        json_match = re.search(r"\{.*\}", content_str, re.DOTALL)
        if json_match:
            content_str = json_match.group()

        try:
            parsed = json.loads(content_str)
        except json.JSONDecodeError as exc:
            raise ServiceUnavailableError("LLM 返回格式非法", code=5022) from exc

        if not isinstance(parsed, dict):
            raise ServiceUnavailableError("LLM 返回 JSON 结构非法", code=5022)

        return parsed

    @staticmethod
    def _normalize_main_subject(value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized if normalized in SUBJECT_MAPPING else None

    @staticmethod
    def _normalize_sub_subject(value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        valid_sub_subjects = {item for values in SUBJECT_MAPPING.values() for item in values}
        return normalized if normalized in valid_sub_subjects else None
