import type {
  ApiEnvelope,
  DeduplicateResult,
  LLMConfig,
  LLMConfigActivateResult,
  LLMConfigDeleteResult,
  LLMConfigListData,
  LLMConfigPayload,
  LLMConfigTestPayload,
  LLMConfigTestResult,
  Pagination,
  Question,
  QuestionDeleteResult,
  QuestionFilters,
  QuestionImageCandidateSearchResult,
  QuestionImageRecognitionResult,
  QuestionListData,
  QuestionPayload
} from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api/v1";
const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return "";
  }
})();

export class APIError extends Error {
  status: number;
  code?: number;
  detail?: unknown;

  constructor(message: string, status: number, code?: number, detail?: unknown) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

function toQueryString(params: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

async function parseJsonSafely(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as ApiEnvelope<unknown> | Record<string, unknown>;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    const envelope = payload as Partial<ApiEnvelope<unknown>> | null;
    throw new APIError(
      envelope?.message || `请求失败 (${response.status})`,
      response.status,
      typeof envelope?.code === "number" ? envelope.code : undefined,
      envelope?.data
    );
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}

async function requestFormData<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    method: init?.method ?? "POST",
    body: formData,
    cache: "no-store"
  });

  const payload = await parseJsonSafely(response);

  if (!response.ok) {
    const envelope = payload as Partial<ApiEnvelope<unknown>> | null;
    throw new APIError(
      envelope?.message || `请求失败 (${response.status})`,
      response.status,
      typeof envelope?.code === "number" ? envelope.code : undefined,
      envelope?.data
    );
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}

function normalizePagination(pagination?: Partial<Pagination>): Pagination {
  return {
    page: pagination?.page ?? 1,
    page_size: pagination?.page_size ?? 20,
    total: pagination?.total ?? 0,
    total_pages: pagination?.total_pages ?? 1
  };
}

export async function listQuestions(filters: QuestionFilters): Promise<QuestionListData> {
  const data = await request<QuestionListData | { items?: Question[]; pagination?: Partial<Pagination> }>(
    `/questions${toQueryString({
      page: filters.page,
      page_size: filters.page_size,
      main_subject: filters.main_subject,
      sub_subject: filters.sub_subject,
      is_wrong: filters.is_wrong,
      keyword: filters.keyword?.trim(),
      sort: filters.sort
    })}`
  );

  return {
    items: data.items ?? [],
    pagination: normalizePagination(data.pagination)
  };
}

export function getQuestion(id: string | number) {
  return request<Question>(`/questions/${id}`);
}

export function createQuestion(payload: QuestionPayload) {
  return request<Question>("/questions", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateQuestion(id: string | number, payload: QuestionPayload) {
  return request<Question>(`/questions/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteQuestion(id: string | number) {
  return request<QuestionDeleteResult>(`/questions/${id}`, {
    method: "DELETE"
  });
}

export function deduplicateQuestion(question_text: string) {
  return request<DeduplicateResult>("/questions/deduplicate", {
    method: "POST",
    body: JSON.stringify({ question_text })
  });
}

export function recognizeQuestionImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return requestFormData<QuestionImageRecognitionResult>("/questions/search/image", formData);
}

export function searchQuestionCandidatesByImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return requestFormData<QuestionImageCandidateSearchResult>("/questions/search/image-candidates", formData);
}

export function resolveAssetUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (!API_ORIGIN) {
    return url;
  }

  return `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
}

export async function listLLMConfigs(): Promise<LLMConfig[]> {
  const data = await request<LLMConfigListData | { items?: LLMConfig[] }>("/llm-configs");
  return data.items ?? [];
}

export function createLLMConfig(payload: LLMConfigPayload) {
  return request<LLMConfig>("/llm-configs", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateLLMConfig(id: string | number, payload: LLMConfigPayload) {
  return request<LLMConfig>(`/llm-configs/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function activateLLMConfig(id: string | number) {
  return request<LLMConfigActivateResult>(`/llm-configs/${id}/activate`, {
    method: "POST"
  });
}

export function deleteLLMConfig(id: string | number) {
  return request<LLMConfigDeleteResult>(`/llm-configs/${id}`, {
    method: "DELETE"
  });
}

export function testLLMConfig(payload: LLMConfigTestPayload) {
  return request<LLMConfigTestResult>("/llm-configs/test", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}
