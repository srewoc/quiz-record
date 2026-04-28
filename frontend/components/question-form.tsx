"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import {
  APIError,
  createQuestion,
  getQuestion,
  recognizeQuestionImage,
  resolveAssetUrl,
  updateQuestion
} from "@/lib/api";
import {
  MAIN_SUBJECT_OPTIONS,
  SUB_SUBJECT_OPTIONS,
  type MainSubject,
  type QuestionImageRecognitionResult,
  type QuestionPayload,
  type SubSubject
} from "@/lib/types";

type QuestionFormProps = {
  mode: "create" | "edit";
  questionId?: string;
};

type FormState = {
  question_text: string;
  main_subject: MainSubject;
  sub_subject: SubSubject;
  is_wrong: boolean;
  image_url: string;
  reference_answer: string;
};

type CreateStage = "upload" | "confirm" | "duplicate";

const DEFAULT_MAIN_SUBJECT: MainSubject = "数学";
const DEFAULT_SUB_SUBJECT: SubSubject = SUB_SUBJECT_OPTIONS[DEFAULT_MAIN_SUBJECT][0];

const EMPTY_FORM: FormState = {
  question_text: "",
  main_subject: DEFAULT_MAIN_SUBJECT,
  sub_subject: DEFAULT_SUB_SUBJECT,
  is_wrong: false,
  image_url: "",
  reference_answer: ""
};

function getErrorMessage(error: unknown) {
  if (error instanceof APIError) {
    return error.code ? `${error.message}（错误码 ${error.code}）` : error.message;
  }

  return error instanceof Error ? error.message : "提交失败，请稍后重试";
}

function getDefaultSubSubject(mainSubject: MainSubject): SubSubject {
  return SUB_SUBJECT_OPTIONS[mainSubject][0];
}

function isSubSubjectValid(mainSubject: MainSubject, subSubject: string | null): subSubject is SubSubject {
  if (!subSubject) {
    return false;
  }

  return (SUB_SUBJECT_OPTIONS[mainSubject] as readonly string[]).includes(subSubject);
}

export function QuestionForm({ mode, questionId }: QuestionFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [createStage, setCreateStage] = useState<CreateStage>("upload");
  const [recognitionResult, setRecognitionResult] = useState<QuestionImageRecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const availableSubSubjects = useMemo(
    () => SUB_SUBJECT_OPTIONS[form.main_subject],
    [form.main_subject]
  );
  const resolvedImageUrl = resolveAssetUrl(form.image_url);
  const matchedQuestionId = recognitionResult?.deduplicate_result.matched_question_id ?? null;
  const showEditableForm = mode === "edit" || createStage === "confirm";

  useEffect(() => {
    if (!selectedFile) {
      setSelectedFilePreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(selectedFile);
    setSelectedFilePreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    if (mode !== "edit" || !questionId) {
      return;
    }

    const currentQuestionId = questionId;
    let cancelled = false;

    async function loadQuestion() {
      setLoading(true);
      setError(null);

      try {
        const question = await getQuestion(currentQuestionId);

        if (!cancelled) {
          setForm({
            question_text: question.question_text,
            main_subject: question.main_subject,
            sub_subject: question.sub_subject,
            is_wrong: question.is_wrong,
            image_url: question.image_url ?? "",
            reference_answer: question.reference_answer ?? ""
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(getErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadQuestion();

    return () => {
      cancelled = true;
    };
  }, [mode, questionId]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetCreateFlow() {
    setSelectedFile(null);
    setRecognitionResult(null);
    setCreateStage("upload");
    setForm(EMPTY_FORM);
    setSuccess(null);
    setError(null);
    setFileInputKey((current) => current + 1);
  }

  function normalizePayload(): QuestionPayload {
    return {
      question_text: form.question_text.trim(),
      main_subject: form.main_subject,
      sub_subject: form.sub_subject,
      is_wrong: form.is_wrong,
      image_url: form.image_url.trim() || null,
      reference_answer: form.reference_answer.trim() || null
    };
  }

  async function handleRecognizeImage() {
    if (!selectedFile) {
      setError("请先上传题目图片，再开始识别匹配。");
      return;
    }

    setRecognizing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await recognizeQuestionImage(selectedFile);
      const nextMainSubject = result.deduplicate_result.main_subject ?? DEFAULT_MAIN_SUBJECT;
      const nextSubSubject = isSubSubjectValid(
        nextMainSubject,
        result.deduplicate_result.sub_subject
      )
        ? result.deduplicate_result.sub_subject
        : getDefaultSubSubject(nextMainSubject);

      setRecognitionResult(result);

      if (result.deduplicate_result.exists) {
        setCreateStage("duplicate");
        setForm((current) => ({
          ...current,
          question_text: result.ocr_text
        }));
        setSuccess("系统已完成识别和匹配，并检测到题目已存在。");
        return;
      }

      setCreateStage("confirm");
      setForm({
        question_text: result.ocr_text,
        main_subject: nextMainSubject,
        sub_subject: nextSubSubject,
        is_wrong: false,
        image_url: result.image_url ?? "",
        reference_answer: ""
      });
      setSuccess("自动识别和匹配完成，请确认题目文本、科目和答案后再提交。");
    } catch (recognizeError) {
      setRecognitionResult(null);
      setCreateStage("upload");
      setError(getErrorMessage(recognizeError));
    } finally {
      setRecognizing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = normalizePayload();

      if (mode === "create") {
        if (createStage !== "confirm") {
          throw new Error("请先完成题图识别与匹配，再提交题目。");
        }

        if (!payload.image_url) {
          throw new Error("题图尚未保存，请重新上传图片并完成识别。");
        }

        const created = await createQuestion(payload);
        setSuccess(`题目 #${created.id} 已创建。`);
        router.push(`/questions/${created.id}/edit`);
        router.refresh();
        return;
      }

      if (!questionId) {
        throw new Error("缺少题目 ID");
      }

      await updateQuestion(questionId, payload);
      setSuccess(`题目 #${questionId} 已保存。`);
      router.refresh();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      title={mode === "create" ? "新增题目" : `编辑题目 #${questionId}`}
      description={
        mode === "create"
          ? "先上传题目图片完成 OCR、pg_trgm 候选匹配与 LLM 判重，再进入人工确认阶段。"
          : "按题目 ID 加载详情并保存修改。"
      }
      actions={
        <button type="button" className="button" onClick={() => router.push("/")}>
          返回列表
        </button>
      }
    >
      <section className="page-block form-page">
        <div className="section-heading">
          <div>
            <h2>{mode === "create" ? "题目录入" : "题目编辑"}</h2>
            <p>
              {mode === "create"
                ? "创建题目必须先上传图片，系统会自动识别题目文本并判断是否重复。"
                : "编辑页允许修改题目文本、科目信息、错题标记和参考答案。"}
            </p>
          </div>
        </div>

        {loading ? <div className="empty-state">正在加载题目详情...</div> : null}
        {error ? <div className="status-banner status-error">{error}</div> : null}
        {success ? <div className="status-banner status-success">{success}</div> : null}

        {!loading && mode === "create" ? (
          <section className="assist-panel upload-workflow-panel">
            <div className="section-heading">
              <div>
                <h3>自动识别匹配阶段</h3>
                <p>上传题图后，系统会自动执行 OCR、pg_trgm 候选检索和题目存在性判断。</p>
              </div>
              {(createStage === "confirm" || createStage === "duplicate") && !recognizing ? (
                <button type="button" className="button" onClick={resetCreateFlow}>
                  重新上传图片
                </button>
              ) : null}
            </div>

            <div className="stack-form">
              <label className="field">
                <span>题目图片</span>
                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/*"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <small>
                  当前选择：{selectedFile?.name ?? "尚未选择图片"}。图片会保存到本地项目目录，`image_url`
                  由系统自动生成。
                </small>
              </label>

              {selectedFilePreviewUrl ? (
                <div className="upload-preview-layout">
                  <div className="upload-preview-frame">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedFilePreviewUrl}
                      alt="待上传题目图片预览"
                      className="upload-preview-image"
                    />
                  </div>
                  <div className="readonly-block">
                    已选择图片：{selectedFile?.name}
                  </div>
                </div>
              ) : null}

              <div className="form-actions">
                <button
                  type="button"
                  className="button button-primary"
                  disabled={!selectedFile || recognizing}
                  onClick={() => void handleRecognizeImage()}
                >
                  {recognizing ? "识别匹配中..." : "开始识别匹配"}
                </button>
              </div>

              {recognitionResult ? (
                <div className="deduplicate-box deduplicate-safe">
                  <strong>识别结果</strong>
                  <p>OCR 已返回题目文本，候选匹配数量：{recognitionResult.candidates.length}。</p>
                  <p>{recognitionResult.deduplicate_result.reason}</p>
                </div>
              ) : (
                <p className="muted-text">完成图片上传后，系统才会进入用户确认阶段。</p>
              )}
            </div>
          </section>
        ) : null}

        {!loading && mode === "create" && createStage === "duplicate" && recognitionResult ? (
          <section className="assist-panel">
            <div className="section-heading">
              <div>
                <h3>匹配结果</h3>
                <p>系统检测到题目已存在，已按流程跳过用户确认阶段。</p>
              </div>
            </div>

            <div className="deduplicate-box deduplicate-hit">
              <strong>题目已存在</strong>
              <p>{recognitionResult.deduplicate_result.reason}</p>
              {matchedQuestionId ? <p>命中题目 ID：{matchedQuestionId}</p> : null}
            </div>

            <div className="field">
              <span>OCR 识别文本</span>
              <div className="readonly-block">{recognitionResult.ocr_text}</div>
            </div>

            <div className="form-actions">
              {matchedQuestionId ? (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => router.push(`/questions/${matchedQuestionId}/edit`)}
                >
                  查看原题
                </button>
              ) : null}
              <button type="button" className="button" onClick={resetCreateFlow}>
                重新上传图片
              </button>
            </div>
          </section>
        ) : null}

        {!loading && showEditableForm ? (
          <form className="stack-form" onSubmit={handleSubmit}>
            {form.image_url ? (
              <section className="assist-panel">
                <div className="section-heading">
                  <div>
                    <h3>题图信息</h3>
                    <p>图片已经保存到本地项目目录，下面展示系统生成的题图地址。</p>
                  </div>
                </div>

                <div className="upload-preview-layout">
                  <div className="upload-preview-frame">
                    {resolvedImageUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolvedImageUrl}
                          alt="题目图片预览"
                          className="upload-preview-image"
                        />
                      </>
                    ) : (
                      <div className="empty-state compact-empty-state">暂无题图预览</div>
                    )}
                  </div>

                  <div className="stack-form">
                    <div className="field">
                      <span>图片路径</span>
                      <div className="readonly-block">{form.image_url}</div>
                    </div>
                    {resolvedImageUrl ? (
                      <a href={resolvedImageUrl} target="_blank" rel="noreferrer" className="inline-link">
                        打开原图
                      </a>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            <label className="field">
              <span>题目文本</span>
              <textarea
                value={form.question_text}
                onChange={(event) => updateForm("question_text", event.target.value)}
                rows={8}
                placeholder="请输入完整题干"
                required
              />
            </label>

            <div className="two-column-grid">
              <label className="field">
                <span>主科目</span>
                <select
                  value={form.main_subject}
                  onChange={(event) => {
                    const mainSubject = event.target.value as MainSubject;
                    setForm((current) => ({
                      ...current,
                      main_subject: mainSubject,
                      sub_subject: getDefaultSubSubject(mainSubject)
                    }));
                  }}
                >
                  {MAIN_SUBJECT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>子科目</span>
                <select
                  value={form.sub_subject}
                  onChange={(event) => updateForm("sub_subject", event.target.value as SubSubject)}
                >
                  {availableSubSubjects.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="two-column-grid">
              <label className="field field-checkbox">
                <span>错题标记</span>
                <input
                  type="checkbox"
                  checked={form.is_wrong}
                  onChange={(event) => updateForm("is_wrong", event.target.checked)}
                />
                <small>用户确认阶段选择是否错题。</small>
              </label>

              <div className="field">
                <span>当前流程</span>
                <div className="readonly-block">
                  {mode === "create"
                    ? "自动识别匹配已完成，当前处于用户确认阶段。"
                    : "编辑现有题目，可直接保存修改。"}
                </div>
              </div>
            </div>

            <label className="field">
              <span>参考答案</span>
              <textarea
                value={form.reference_answer}
                onChange={(event) => updateForm("reference_answer", event.target.value)}
                rows={8}
                placeholder="支持保存 Markdown 文本"
              />
            </label>

            <div className="form-actions">
              <button type="submit" className="button button-primary" disabled={saving}>
                {saving ? "保存中..." : mode === "create" ? "确定并创建题目" : "保存修改"}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => router.push("/")}
                disabled={saving}
              >
                取消
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </AppShell>
  );
}
