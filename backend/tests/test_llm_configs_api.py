def test_create_list_update_and_activate_llm_config(client) -> None:
    create_response = client.post(
        "/api/v1/llm-configs",
        json={
            "config_name": "default-openai",
            "module_type": "question_analysis",
            "provider_type": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-test-key",
            "model_name": "gpt-4o-mini",
            "is_active": True,
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()["data"]
    assert created["is_active"] is True
    assert "****" in created["api_key_masked"]

    list_response = client.get("/api/v1/llm-configs")
    assert list_response.status_code == 200
    assert len(list_response.json()["data"]["items"]) == 1

    update_response = client.put(
        "/api/v1/llm-configs/1",
        json={
            "config_name": "default-openai-updated",
            "module_type": "question_analysis",
            "provider_type": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-new-test-key",
            "model_name": "gpt-4.1-mini",
            "is_active": False,
        },
    )
    assert update_response.status_code == 200
    assert update_response.json()["data"]["model_name"] == "gpt-4.1-mini"

    second_response = client.post(
        "/api/v1/llm-configs",
        json={
            "config_name": "backup-openai",
            "module_type": "question_analysis",
            "provider_type": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-second-key",
            "model_name": "gpt-4o-mini",
            "is_active": False,
        },
    )
    assert second_response.status_code == 201

    activate_response = client.post("/api/v1/llm-configs/2/activate")
    assert activate_response.status_code == 200
    assert activate_response.json()["data"]["is_active"] is True

    list_after_activate = client.get("/api/v1/llm-configs")
    items = list_after_activate.json()["data"]["items"]
    active_items = [item for item in items if item["is_active"]]
    assert len(active_items) == 1
    assert active_items[0]["id"] == 2


def test_activate_only_deactivates_configs_in_same_module(client) -> None:
    question_response = client.post(
        "/api/v1/llm-configs",
        json={
            "config_name": "question-openai",
            "module_type": "question_analysis",
            "provider_type": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-question-key",
            "model_name": "gpt-4o-mini",
            "is_active": True,
        },
    )
    assert question_response.status_code == 201

    ocr_response = client.post(
        "/api/v1/llm-configs",
        json={
            "config_name": "ocr-openai",
            "module_type": "ocr",
            "provider_type": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-ocr-key",
            "model_name": "gpt-4.1-mini",
            "is_active": True,
        },
    )
    assert ocr_response.status_code == 201

    standby_response = client.post(
        "/api/v1/llm-configs",
        json={
            "config_name": "question-openai-backup",
            "module_type": "question_analysis",
            "provider_type": "openai",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-question-backup",
            "model_name": "gpt-4.1-mini",
            "is_active": False,
        },
    )
    assert standby_response.status_code == 201

    activate_response = client.post("/api/v1/llm-configs/3/activate")
    assert activate_response.status_code == 200

    list_response = client.get("/api/v1/llm-configs")
    items = list_response.json()["data"]["items"]
    active_items = [item for item in items if item["is_active"]]
    assert len(active_items) == 2

    question_active = [item for item in active_items if item["module_type"] == "question_analysis"]
    ocr_active = [item for item in active_items if item["module_type"] == "ocr"]
    assert len(question_active) == 1
    assert question_active[0]["id"] == 3
    assert len(ocr_active) == 1
    assert ocr_active[0]["id"] == 2
