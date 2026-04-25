"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  APIError,
  activateLLMConfig,
  createLLMConfig,
  listLLMConfigs,
  testLLMConfig,
  updateLLMConfig
} from "@/lib/api";
import {
  LLM_MODULE_DESCRIPTIONS,
  LLM_MODULE_LABELS,
  LLM_MODULE_OPTIONS,
  type LLMConfig,
  type LLMConfigPayload,
  type LLMModuleType,
  type ProviderType
} from "@/lib/types";

type FormState = {
  id: number | null;
  config_name: string;
  module_type: LLMModuleType;
  provider_type: ProviderType;
  base_url: string;
  api_key: string;
  model_name: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  id: null,
  config_name: "",
  module_type: "question_analysis",
  provider_type: "openai",
  base_url: "https://api.openai.com/v1",
  api_key: "",
  model_name: "gpt-4o-mini",
  is_active: false
};

function getErrorMessage(error: unknown) {
  if (error instanceof APIError) {
    return error.code ? `${error.message}（错误码 ${error.code}）` : error.message;
  }

  return error instanceof Error ? error.message : "请求失败，请稍后重试";
}

export function LLMConfigsManager() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activatingId, setActivatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function refreshConfigs() {
    setLoading(true);
    setError(null);

    try {
      const nextConfigs = await listLLMConfigs();
      setConfigs(nextConfigs);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshConfigs();
  }, []);

  const editingLabel = useMemo(() => {
    if (!form.id) {
      return "新增配置";
    }

    return `编辑配置 #${form.id}`;
  }, [form.id]);

  const groupedConfigs = useMemo(() => {
    return LLM_MODULE_OPTIONS.map((moduleType) => ({
      moduleType,
      items: configs.filter((config) => config.module_type === moduleType)
    }));
  }, [configs]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setTestResult(null);
    setSuccess(null);
    setError(null);
  }

  function fillForm(config: LLMConfig) {
    setForm({
      id: config.id,
      config_name: config.config_name,
      module_type: config.module_type,
      provider_type: config.provider_type,
      base_url: config.base_url,
      api_key: "",
      model_name: config.model_name,
      is_active: config.is_active
    });
    setTestResult(null);
    setSuccess(null);
    setError(null);
  }

  function buildPayload(): LLMConfigPayload {
    return {
      config_name: form.config_name.trim(),
      module_type: form.module_type,
      provider_type: form.provider_type,
      base_url: form.base_url.trim(),
      model_name: form.model_name.trim(),
      is_active: form.is_active,
      ...(form.api_key.trim() ? { api_key: form.api_key.trim() } : {})
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = buildPayload();

      if (form.id) {
        await updateLLMConfig(form.id, payload);
        setSuccess(`配置 #${form.id} 已更新。`);
      } else {
        const created = await createLLMConfig(payload);
        setSuccess(`配置 #${created.id} 已创建。`);
        setForm((current) => ({ ...current, id: created.id }));
      }

      await refreshConfigs();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  async function handleActivate(id: number) {
    setActivatingId(id);
    setError(null);
    setSuccess(null);

    try {
      await activateLLMConfig(id);
      setSuccess(`配置 #${id} 已启用。`);
      await refreshConfigs();
      setForm((current) => ({ ...current, is_active: current.id === id }));
    } catch (activateError) {
      setError(getErrorMessage(activateError));
    } finally {
      setActivatingId(null);
    }
  }

  async function handleTest() {
    if (!form.api_key.trim()) {
      setError("测试连接时需要填写 API Key。");
      return;
    }

    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await testLLMConfig({
        module_type: form.module_type,
        provider_type: form.provider_type,
        base_url: form.base_url.trim(),
        api_key: form.api_key.trim(),
        model_name: form.model_name.trim()
      });
      setTestResult(result.detail);
      setSuccess(result.success ? "连接测试通过。" : null);
    } catch (testError) {
      setError(getErrorMessage(testError));
    } finally {
      setTesting(false);
    }
  }

  return (
    <AppShell
      title="LLM 配置"
      description="按功能模块管理 LLM 配置。每个模块允许保存多条 Provider 配置，但同一模块只允许启用一条。"
    >
      <div className="panel-grid">
        <section className="page-block">
          <div className="section-heading">
            <div>
              <h2>配置列表</h2>
              <p>配置按功能模块分组展示，列表仅展示脱敏后的 API Key。</p>
            </div>
            <button type="button" className="button" onClick={resetForm}>
              新增配置
            </button>
          </div>

          {loading ? <div className="empty-state">正在加载配置列表...</div> : null}
          {!loading && configs.length === 0 ? (
            <div className="empty-state">当前还没有 LLM 配置。</div>
          ) : null}

          {!loading && configs.length > 0 ? (
            <div className="config-list">
              {groupedConfigs.map((group) => (
                <section className="assist-panel" key={group.moduleType}>
                  <div className="section-heading">
                    <div>
                      <h3>{LLM_MODULE_LABELS[group.moduleType]}</h3>
                      <p>{LLM_MODULE_DESCRIPTIONS[group.moduleType]}</p>
                    </div>
                  </div>

                  {group.items.length === 0 ? (
                    <div className="empty-state compact-empty-state">当前模块还没有配置。</div>
                  ) : (
                    <div className="config-list">
                      {group.items.map((config) => (
                        <article className="config-card" key={config.id}>
                          <div className="config-card-head">
                            <div>
                              <h3>{config.config_name}</h3>
                              <p>{config.model_name}</p>
                            </div>
                            {config.is_active ? <span className="badge badge-success">已启用</span> : null}
                          </div>

                          <dl className="meta-list">
                            <div>
                              <dt>Provider</dt>
                              <dd>{config.provider_type}</dd>
                            </div>
                            <div>
                              <dt>Base URL</dt>
                              <dd>{config.base_url}</dd>
                            </div>
                            <div>
                              <dt>API Key</dt>
                              <dd>{config.api_key_masked}</dd>
                            </div>
                          </dl>

                          <div className="row-actions">
                            <button type="button" className="button" onClick={() => fillForm(config)}>
                              编辑
                            </button>
                            <button
                              type="button"
                              className="button button-primary"
                              disabled={config.is_active || activatingId === config.id}
                              onClick={() => void handleActivate(config.id)}
                            >
                              {activatingId === config.id
                                ? "启用中..."
                                : config.is_active
                                  ? "当前启用"
                                  : "启用"}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : null}
        </section>

        <section className="page-block">
          <div className="section-heading">
            <div>
              <h2>{editingLabel}</h2>
              <p>先选择所属功能模块。编辑已有配置时，API Key 留空表示沿用后端现存值。</p>
            </div>
          </div>

          {error ? <div className="status-banner status-error">{error}</div> : null}
          {success ? <div className="status-banner status-success">{success}</div> : null}
          {testResult ? <div className="status-banner status-info">{testResult}</div> : null}

          <form className="stack-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>配置名称</span>
              <input
                value={form.config_name}
                onChange={(event) => updateForm("config_name", event.target.value)}
                placeholder="default-openai"
                required
              />
            </label>

            <div className="two-column-grid">
              <label className="field">
                <span>所属模块</span>
                <select
                  value={form.module_type}
                  onChange={(event) => updateForm("module_type", event.target.value as LLMModuleType)}
                >
                  {LLM_MODULE_OPTIONS.map((moduleType) => (
                    <option key={moduleType} value={moduleType}>
                      {LLM_MODULE_LABELS[moduleType]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Provider</span>
                <select
                  value={form.provider_type}
                  onChange={(event) => updateForm("provider_type", event.target.value as ProviderType)}
                >
                  <option value="openai">openai</option>
                </select>
              </label>
            </div>

            <div className="two-column-grid">
              <label className="field">
                <span>模型名称</span>
                <input
                  value={form.model_name}
                  onChange={(event) => updateForm("model_name", event.target.value)}
                  placeholder="gpt-4o-mini"
                  required
                />
              </label>

              <div className="field">
                <span>模块说明</span>
                <div className="readonly-block">{LLM_MODULE_DESCRIPTIONS[form.module_type]}</div>
              </div>
            </div>

            <label className="field">
              <span>Base URL</span>
              <input
                type="url"
                value={form.base_url}
                onChange={(event) => updateForm("base_url", event.target.value)}
                placeholder="https://api.openai.com/v1"
                required
              />
            </label>

            <label className="field">
              <span>{form.id ? "新 API Key（可留空）" : "API Key"}</span>
              <input
                type="password"
                value={form.api_key}
                onChange={(event) => updateForm("api_key", event.target.value)}
                placeholder={form.id ? "留空则保持原值" : "sk-..."}
                required={!form.id}
              />
            </label>

            <label className="field field-checkbox">
              <span>保存后立即启用</span>
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => updateForm("is_active", event.target.checked)}
              />
              <small>只会停用当前模块下的其它已启用配置。</small>
            </label>

            <div className="form-actions">
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? "保存中..." : form.id ? "保存配置" : "创建配置"}
              </button>
              <button type="button" className="button" disabled={testing} onClick={() => void handleTest()}>
                {testing ? "测试中..." : "测试连接"}
              </button>
              <button type="button" className="button" onClick={resetForm}>
                重置
              </button>
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
