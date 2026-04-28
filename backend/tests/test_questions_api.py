from pathlib import Path

from app.core.config import settings
from app.core.security import encrypt_secret
from app.models.llm_config import LLMConfig
from app.models.question import Question
from app.schemas.question import DeduplicateResultResponse
from app.services.llm_client import LLMClient
from app.services.ocr import OCRService
from app.services.question_service import QuestionService


def test_analysis_prompt_uses_ranked_tuple_candidates_and_caps_at_twenty(db_session) -> None:
    from app.models.question import Question

    questions = []
    for index in range(25):
        item = Question(
            id=index + 1,
            question_text=f"题目 {index + 1}",
            main_subject="数学",
            sub_subject="高数",
            is_wrong=index % 2 == 0,
            image_url=None,
            reference_answer=None,
        )
        item.similarity_score = 1 - index * 0.01  # type: ignore[attr-defined]
        questions.append(item)

    prompt = LLMClient(db_session)._build_analysis_prompt("测试题目", questions)
    assert "(题目ID,题目内容,错题标记,主科目,子科目,题目相似度)" in prompt
    assert '"题目 21"' not in prompt
    assert '"题目 20"' in prompt
    assert "[1, \"题目 1\", true, \"数学\", \"高数\", 1.0]" in prompt


def test_create_list_update_and_delete_question(client) -> None:
    create_response = client.post(
        "/api/v1/questions",
        json={
            "question_text": "求极限 lim x->0 sinx/x",
            "main_subject": "数学",
            "sub_subject": "高数",
            "is_wrong": True,
            "image_url": "/uploads/question-images/test-question.png",
            "reference_answer": "答案内容",
        },
    )

    assert create_response.status_code == 201
    created = create_response.json()["data"]
    assert created["id"] == 1

    list_response = client.get("/api/v1/questions")
    assert list_response.status_code == 200
    assert list_response.json()["data"]["pagination"]["total"] == 1

    update_response = client.put(
        "/api/v1/questions/1",
        json={
            "question_text": "求极限 lim x->0 sinx/x",
            "main_subject": "数学",
            "sub_subject": "高数",
            "is_wrong": False,
            "image_url": "/uploads/question-images/test-question.png",
            "reference_answer": "更新后的答案",
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["data"]["is_wrong"] is False

    delete_response = client.delete("/api/v1/questions/1")
    assert delete_response.status_code == 200
    assert delete_response.json()["data"]["deleted"] is True

    list_after_delete = client.get("/api/v1/questions")
    assert list_after_delete.status_code == 200
    assert list_after_delete.json()["data"]["pagination"]["total"] == 0


def test_create_question_rejects_duplicates(client) -> None:
    payload = {
        "question_text": "重复题目",
        "main_subject": "数学",
        "sub_subject": "高数",
        "is_wrong": False,
        "image_url": "/uploads/question-images/test-question.png",
        "reference_answer": None,
    }
    first_response = client.post("/api/v1/questions", json=payload)
    assert first_response.status_code == 201

    duplicate_response = client.post("/api/v1/questions", json=payload)
    assert duplicate_response.status_code == 409
    assert duplicate_response.json()["code"] == 4091


def test_create_question_rejects_prefixed_sub_subject(client) -> None:
    response = client.post(
        "/api/v1/questions",
        json={
            "question_text": "旧子科目格式",
            "main_subject": "数学",
            "sub_subject": "数学-高数",
            "is_wrong": False,
            "image_url": "/uploads/question-images/test-question.png",
            "reference_answer": None,
        },
    )

    assert response.status_code == 400
    assert response.json()["code"] == 4001


def test_delete_question_removes_record(client) -> None:
    client.post(
        "/api/v1/questions",
        json={
            "question_text": "待删除题目",
            "main_subject": "数学",
            "sub_subject": "高数",
            "is_wrong": False,
            "image_url": "/uploads/question-images/test-question.png",
            "reference_answer": None,
        },
    )
    client.delete("/api/v1/questions/1")
    response = client.get("/api/v1/questions/1")
    assert response.status_code == 404
    assert response.json()["code"] == 4041

    recreate_response = client.post(
        "/api/v1/questions",
        json={
            "question_text": "待删除题目",
            "main_subject": "数学",
            "sub_subject": "高数",
            "is_wrong": False,
            "image_url": "/uploads/question-images/test-question.png",
            "reference_answer": None,
        },
    )
    assert recreate_response.status_code == 201
    assert recreate_response.json()["data"]["question_text"] == "待删除题目"

    list_response = client.get("/api/v1/questions")
    assert list_response.status_code == 200
    assert list_response.json()["data"]["pagination"]["total"] == 1


def test_deduplicate_requires_active_llm_config(client, db_session) -> None:
    db_session.add(
        LLMConfig(
            config_name="inactive",
            module_type="question_analysis",
            provider_type="openai",
            base_url="https://api.openai.com/v1",
            api_key_encrypted=encrypt_secret("sk-test-key"),
            model_name="gpt-4o-mini",
            is_active=False,
        )
    )
    db_session.commit()

    response = client.post("/api/v1/questions/deduplicate", json={"question_text": "测试题目"})
    assert response.status_code == 502
    assert response.json()["code"] == 5023


def test_search_question_by_image_returns_local_image_url(client, monkeypatch, tmp_path) -> None:
    async def fake_extract_markdown(self, file_obj, content_type: str | None = None) -> str:
        assert file_obj.read() == b"fake-image-content"
        assert content_type == "image/png"
        return "识别得到的题目文本"

    def fake_analyze_question(self, question_text: str, candidates) -> DeduplicateResultResponse:
        assert question_text == "识别得到的题目文本"
        assert candidates == []
        return DeduplicateResultResponse(
            exists=False,
            matched_question_id=None,
            main_subject="数学",
            sub_subject="高数",
            reason="未发现重复题",
        )

    monkeypatch.setattr(settings, "uploads_dir", str(tmp_path / "uploads"))
    monkeypatch.setattr(OCRService, "extract_markdown", fake_extract_markdown)
    monkeypatch.setattr(LLMClient, "analyze_question", fake_analyze_question)

    response = client.post(
        "/api/v1/questions/search/image",
        files={"file": ("question.png", b"fake-image-content", "image/png")},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["ocr_text"] == "识别得到的题目文本"
    assert data["image_url"].startswith("/uploads/question-images/")

    saved_file = settings.uploads_dir_path / data["image_url"].removeprefix("/uploads/")
    assert saved_file.exists()


def test_search_question_candidates_by_image_returns_ranked_candidates_without_llm(
    client,
    db_session,
    monkeypatch,
) -> None:
    db_session.add_all(
        [
            Question(
                question_text="求极限 sinx/x",
                main_subject="数学",
                sub_subject="高数",
                is_wrong=True,
                image_url="/uploads/question-images/limit.png",
                reference_answer="1",
            ),
            Question(
                question_text="线性代数矩阵特征值",
                main_subject="数学",
                sub_subject="线代",
                is_wrong=False,
                image_url="/uploads/question-images/matrix.png",
                reference_answer="特征方程",
            ),
        ]
    )
    db_session.commit()

    async def fake_extract_markdown(self, file_obj, content_type: str | None = None) -> str:
        assert file_obj.read() == b"fake-image-content"
        assert content_type == "image/png"
        return "识别出的题干"

    def fake_find_candidates(self, question_text: str, limit: int = 20):
        assert question_text == "识别出的题干"
        assert limit == 20
        candidates = db_session.query(Question).order_by(Question.id.asc()).all()
        for candidate, score in zip(candidates, [0.918273, 0.421], strict=True):
            candidate.similarity_score = score
        return candidates

    def fail_analyze_question(self, question_text: str, candidates) -> DeduplicateResultResponse:
        raise AssertionError("图片候选搜索不应调用 LLM 题目分析")

    monkeypatch.setattr(OCRService, "extract_markdown", fake_extract_markdown)
    monkeypatch.setattr(QuestionService, "find_candidates", fake_find_candidates)
    monkeypatch.setattr(LLMClient, "analyze_question", fail_analyze_question)

    response = client.post(
        "/api/v1/questions/search/image-candidates",
        files={"file": ("question.png", b"fake-image-content", "image/png")},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["ocr_text"] == "识别出的题干"
    assert [item["id"] for item in data["candidates"]] == [1, 2]
    assert data["candidates"][0]["similarity_score"] == 0.918273
    assert data["candidates"][1]["similarity_score"] == 0.421


def test_search_question_by_image_deletes_local_file_when_duplicate(
    client,
    monkeypatch,
    tmp_path,
) -> None:
    async def fake_extract_markdown(self, file_obj, content_type: str | None = None) -> str:
        return "重复题文本"

    def fake_analyze_question(self, question_text: str, candidates) -> DeduplicateResultResponse:
        return DeduplicateResultResponse(
            exists=True,
            matched_question_id=12,
            main_subject="数学",
            sub_subject="高数",
            reason="命中已有题目",
        )

    uploads_root = tmp_path / "uploads"
    monkeypatch.setattr(settings, "uploads_dir", str(uploads_root))
    monkeypatch.setattr(OCRService, "extract_markdown", fake_extract_markdown)
    monkeypatch.setattr(LLMClient, "analyze_question", fake_analyze_question)

    response = client.post(
        "/api/v1/questions/search/image",
        files={"file": ("question.png", b"fake-image-content", "image/png")},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert data["image_url"] is None

    image_directory = Path(settings.uploads_dir_path) / "question-images"
    assert not image_directory.exists() or not any(image_directory.iterdir())
