"use client";

import Link from "next/link";
import Image from "next/image";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  APIError,
  deleteQuestion,
  listQuestions,
  resolveAssetUrl,
  searchQuestionCandidatesByImage
} from "@/lib/api";
import {
  MAIN_SUBJECT_OPTIONS,
  SUB_SUBJECT_OPTIONS,
  type MainSubject,
  type Question,
  type QuestionCandidate,
  type QuestionFilters,
  type SubSubject
} from "@/lib/types";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
type SearchMode = "filters" | "image";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getErrorMessage(error: unknown) {
  if (error instanceof APIError) {
    return error.code ? `${error.message}（错误码 ${error.code}）` : error.message;
  }

  return error instanceof Error ? error.message : "请求失败，请稍后重试";
}

export function QuestionsDashboard() {
  const [searchMode, setSearchMode] = useState<SearchMode>("filters");
  const [keywordInput, setKeywordInput] = useState("");
  const deferredKeyword = useDeferredValue(keywordInput.trim());
  const [filters, setFilters] = useState<QuestionFilters>({
    page: 1,
    page_size: 10,
    sort: "updated_at_desc"
  });
  const [items, setItems] = useState<Question[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    page_size: 10,
    total: 0,
    total_pages: 1
  });
  const [imageCandidates, setImageCandidates] = useState<QuestionCandidate[]>([]);
  const [imageSearchOcrText, setImageSearchOcrText] = useState("");
  const [imageSearchFileName, setImageSearchFileName] = useState("");
  const [imageSearching, setImageSearching] = useState(false);
  const [imageSearchInputKey, setImageSearchInputKey] = useState(0);
  const [expandedAnswerId, setExpandedAnswerId] = useState<number | null>(null);
  const [expandedTextId, setExpandedTextId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await listQuestions({
          ...filters,
          keyword: deferredKeyword || undefined
        });

        if (!cancelled) {
          setItems(data.items);
          setPagination(data.pagination);
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

    void load();

    return () => {
      cancelled = true;
    };
  }, [deferredKeyword, filters]);

  const subSubjectOptions = useMemo(() => {
    if (!filters.main_subject) {
      return Object.values(SUB_SUBJECT_OPTIONS).flat();
    }

    return SUB_SUBJECT_OPTIONS[filters.main_subject];
  }, [filters.main_subject]);

  const visibleItems = searchMode === "filters" ? items : imageCandidates;

  async function handleDelete(id: number) {
    if (!window.confirm(`确认删除题目 #${id} 吗？删除后将从数据库中移除。`)) {
      return;
    }

    setDeletingId(id);
    setError(null);

    try {
      await deleteQuestion(id);
      const nextPage = items.length === 1 && filters.page > 1 ? filters.page - 1 : filters.page;
      setExpandedAnswerId((current) => (current === id ? null : current));
      setExpandedTextId((current) => (current === id ? null : current));
      setImageCandidates((current) => current.filter((item) => item.id !== id));
      setFilters((current) => ({ ...current, page: nextPage }));
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeletingId(null);
    }
  }

  function updateFilter<K extends keyof QuestionFilters>(key: K, value: QuestionFilters[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      page: key === "page" ? (value as number) : 1
    }));
  }

  function switchSearchMode(nextMode: SearchMode) {
    setSearchMode(nextMode);
    setError(null);
    setExpandedAnswerId(null);
    setExpandedTextId(null);
  }

  async function handleImageSearch(file: File | null) {
    if (!file) {
      return;
    }

    setImageSearching(true);
    setImageSearchFileName(file.name);
    setImageSearchOcrText("");
    setImageCandidates([]);
    setExpandedAnswerId(null);
    setExpandedTextId(null);
    setError(null);

    try {
      const result = await searchQuestionCandidatesByImage(file);
      setImageSearchOcrText(result.ocr_text);
      setImageCandidates(result.candidates);
    } catch (searchError) {
      setError(getErrorMessage(searchError));
    } finally {
      setImageSearching(false);
      setImageSearchInputKey((current) => current + 1);
    }
  }

  return (
    <AppShell
      title="题目列表"
      description="在首页集中完成分页浏览、筛选、删除和答案查看，保持后续 OCR/查重能力的接入空间。"
      actions={
        <>
          <Link href="/questions/new" className="button button-primary">
            新增题目
          </Link>
          <Link href="/llm-configs" className="button">
            管理 LLM
          </Link>
        </>
      }
    >
      <section className="page-block">
        <div className="section-heading">
          <div>
            <h2>{searchMode === "filters" ? "筛选与检索" : "图片搜索"}</h2>
            <p>
              {searchMode === "filters"
                ? "默认按最近更新时间倒序。"
                : "上传题图后执行 OCR，并按 pg_trgm 相似度返回最多 20 个候选结果。"}
            </p>
          </div>
          <div className="segmented-control" aria-label="搜索方式">
            <button
              type="button"
              className={searchMode === "filters" ? "segmented-active" : ""}
              onClick={() => switchSearchMode("filters")}
            >
              筛选搜索
            </button>
            <button
              type="button"
              className={searchMode === "image" ? "segmented-active" : ""}
              onClick={() => switchSearchMode("image")}
            >
              图片搜索
            </button>
          </div>
        </div>

        {searchMode === "filters" ? (
          <div className="filters-grid">
            <label className="field">
              <span>关键词</span>
              <input
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                placeholder="按题目文本搜索"
              />
            </label>

            <label className="field">
              <span>主科目</span>
              <select
                value={filters.main_subject ?? ""}
                onChange={(event) => {
                  const nextSubject = (event.target.value || undefined) as MainSubject | undefined;
                  setFilters((current) => ({
                    ...current,
                    main_subject: nextSubject,
                    sub_subject: undefined,
                    page: 1
                  }));
                }}
              >
                <option value="">全部</option>
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
                value={filters.sub_subject ?? ""}
                onChange={(event) => updateFilter("sub_subject", (event.target.value || undefined) as SubSubject | undefined)}
              >
                <option value="">全部</option>
                {subSubjectOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>错题状态</span>
              <select
                value={
                  filters.is_wrong === undefined ? "" : filters.is_wrong ? "true" : "false"
                }
                onChange={(event) => {
                  const value = event.target.value;
                  updateFilter(
                    "is_wrong",
                    value === "" ? undefined : value === "true"
                  );
                }}
              >
                <option value="">全部</option>
                <option value="true">仅错题</option>
                <option value="false">仅非错题</option>
              </select>
            </label>

            <label className="field">
              <span>每页数量</span>
              <select
                value={filters.page_size}
                onChange={(event) => updateFilter("page_size", Number(event.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} 条
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="image-search-panel">
            <label className="button button-primary image-search-upload">
              上传图片搜索
              <input
                key={imageSearchInputKey}
                type="file"
                accept="image/*"
                onChange={(event) => void handleImageSearch(event.target.files?.[0] ?? null)}
              />
            </label>
            {imageSearchFileName ? <span className="muted-text">当前图片：{imageSearchFileName}</span> : null}
          </div>
        )}

        {error ? <div className="status-banner status-error">{error}</div> : null}

        <div className="table-meta">
          {searchMode === "filters" ? (
            <>
              <strong>共 {pagination.total} 题</strong>
              <span>第 {pagination.page} / {Math.max(pagination.total_pages, 1)} 页</span>
            </>
          ) : (
            <>
              <strong>候选结果 {imageCandidates.length} 题</strong>
              <span>{imageSearchOcrText ? "已完成 OCR 与相似度排序" : "上传图片后开始搜索"}</span>
            </>
          )}
        </div>

        {searchMode === "filters" && loading ? <div className="empty-state">正在加载题目列表...</div> : null}
        {searchMode === "image" && imageSearching ? <div className="empty-state">正在识别图片并检索候选题...</div> : null}

        {searchMode === "image" && imageSearchOcrText ? (
          <div className="readonly-block image-search-ocr-text">{imageSearchOcrText}</div>
        ) : null}

        {searchMode === "filters" && !loading && visibleItems.length === 0 ? (
          <div className="empty-state">当前筛选条件下还没有题目。</div>
        ) : null}
        {searchMode === "image" && !imageSearching && imageSearchOcrText && visibleItems.length === 0 ? (
          <div className="empty-state">没有找到相似候选题。</div>
        ) : null}

        {((searchMode === "filters" && !loading) || (searchMode === "image" && !imageSearching)) && visibleItems.length > 0 ? (
          <div className="question-list">
            {visibleItems.map((item) => {
              const imageHref = resolveAssetUrl(item.image_url);
              const similarityScore =
                "similarity_score" in item ? Number(item.similarity_score) : null;

              return (
                <article className="question-card" key={item.id}>
                <div className="question-card-head">
                  <div className="question-meta">
                    <span className="badge">{item.main_subject}</span>
                    <span className="badge badge-muted">{item.sub_subject}</span>
                    {item.is_wrong ? <span className="badge badge-warn">错题</span> : null}
                    {similarityScore !== null ? (
                      <span className="badge badge-success">
                        相似度 {(similarityScore * 100).toFixed(1)}%
                      </span>
                    ) : null}
                  </div>

                  <div className="row-actions">
                    <button
                      type="button"
                      className="button button-ghost"
                      onClick={() =>
                        setExpandedAnswerId((current) => (current === item.id ? null : item.id))
                      }
                    >
                      {expandedAnswerId === item.id ? "收起答案" : "查看答案"}
                    </button>
                    <Link href={`/questions/${item.id}/edit`} className="button button-ghost">
                      编辑
                    </Link>
                    <button
                      type="button"
                      className="button button-danger"
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item.id)}
                    >
                      {deletingId === item.id ? "删除中..." : "删除"}
                    </button>
                  </div>
                </div>

                <h3>题目 #{item.id}</h3>
                {imageHref ? (
                  <div className="question-image-frame">
                    <Image
                      src={imageHref}
                      alt={`题目 #${item.id} 题图`}
                      width={1200}
                      height={800}
                      unoptimized
                      className="question-image-content"
                    />
                  </div>
                ) : (
                  <p className="question-text">{item.question_text}</p>
                )}

                <div className="question-foot">
                  <span>更新时间：{formatDate(item.updated_at)}</span>
                  {imageHref ? (
                    <button
                      type="button"
                      className="inline-link inline-button"
                      onClick={() =>
                        setExpandedTextId((current) => (current === item.id ? null : item.id))
                      }
                    >
                      {expandedTextId === item.id ? "收起文本" : "展示文本"}
                    </button>
                  ) : (
                    <span className="muted-text">无题图</span>
                  )}
                </div>

                {imageHref && expandedTextId === item.id ? (
                  <div className="answer-panel">
                    <strong>题目文本</strong>
                    <p className="question-text">{item.question_text}</p>
                  </div>
                ) : null}

                {expandedAnswerId === item.id ? (
                  <div className="answer-panel">
                    <strong>参考答案</strong>
                    <p>{item.reference_answer?.trim() || "暂无参考答案。"}</p>
                  </div>
                ) : null}
                </article>
              );
            })}
          </div>
        ) : null}

        {searchMode === "filters" ? <div className="pagination-bar">
          <button
            type="button"
            className="button"
            disabled={filters.page <= 1}
            onClick={() => updateFilter("page", filters.page - 1)}
          >
            上一页
          </button>
          <button
            type="button"
            className="button"
            disabled={filters.page >= pagination.total_pages}
            onClick={() => updateFilter("page", filters.page + 1)}
          >
            下一页
          </button>
        </div> : null}
      </section>
    </AppShell>
  );
}
