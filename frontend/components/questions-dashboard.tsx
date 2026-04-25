"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { APIError, deleteQuestion, listQuestions, resolveAssetUrl } from "@/lib/api";
import { MAIN_SUBJECT_OPTIONS, SUB_SUBJECT_OPTIONS, type MainSubject, type Question, type QuestionFilters, type SubSubject } from "@/lib/types";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

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
  const [expandedAnswerId, setExpandedAnswerId] = useState<number | null>(null);
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

  async function handleDelete(id: number) {
    if (!window.confirm(`确认删除题目 #${id} 吗？此操作会走逻辑删除。`)) {
      return;
    }

    setDeletingId(id);
    setError(null);

    try {
      await deleteQuestion(id);
      const nextPage = items.length === 1 && filters.page > 1 ? filters.page - 1 : filters.page;
      setExpandedAnswerId((current) => (current === id ? null : current));
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
            <h2>筛选与检索</h2>
            <p>默认按最近更新时间倒序，删除操作为逻辑删除。</p>
          </div>
        </div>

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

        {error ? <div className="status-banner status-error">{error}</div> : null}

        <div className="table-meta">
          <strong>共 {pagination.total} 题</strong>
          <span>第 {pagination.page} / {Math.max(pagination.total_pages, 1)} 页</span>
        </div>

        {loading ? <div className="empty-state">正在加载题目列表...</div> : null}

        {!loading && items.length === 0 ? (
          <div className="empty-state">当前筛选条件下还没有题目。</div>
        ) : null}

        {!loading && items.length > 0 ? (
          <div className="question-list">
            {items.map((item) => {
              const imageHref = resolveAssetUrl(item.image_url);

              return (
                <article className="question-card" key={item.id}>
                <div className="question-card-head">
                  <div className="question-meta">
                    <span className="badge">{item.main_subject}</span>
                    <span className="badge badge-muted">{item.sub_subject}</span>
                    {item.is_wrong ? <span className="badge badge-warn">错题</span> : null}
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
                <p className="question-text">{item.question_text}</p>

                <div className="question-foot">
                  <span>更新时间：{formatDate(item.updated_at)}</span>
                  {imageHref ? (
                    <a href={imageHref} target="_blank" rel="noreferrer" className="inline-link">
                      查看题图
                    </a>
                  ) : (
                    <span className="muted-text">无题图</span>
                  )}
                </div>

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

        <div className="pagination-bar">
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
        </div>
      </section>
    </AppShell>
  );
}
