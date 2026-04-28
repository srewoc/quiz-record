export const MAIN_SUBJECT_OPTIONS = ["数学", "408"] as const;

export const SUB_SUBJECT_OPTIONS = {
  数学: ["高数", "线代", "概率论"],
  "408": ["数据结构", "计组", "操作系统", "计网"]
} as const;

export const PROVIDER_OPTIONS = ["openai"] as const;
export const LLM_MODULE_OPTIONS = ["question_analysis", "ocr"] as const;
export const LLM_MODULE_LABELS = {
  question_analysis: "题目匹配与科目识别模块",
  ocr: "OCR 模块"
} as const;
export const LLM_MODULE_DESCRIPTIONS = {
  question_analysis: "用于题目存在性判断、重复题匹配和主子科目识别。",
  ocr: "用于识别题目图片中的题干文本并输出 Markdown。"
} as const;

export type MainSubject = (typeof MAIN_SUBJECT_OPTIONS)[number];
export type SubSubject =
  | (typeof SUB_SUBJECT_OPTIONS)["数学"][number]
  | (typeof SUB_SUBJECT_OPTIONS)["408"][number];
export type ProviderType = (typeof PROVIDER_OPTIONS)[number];
export type LLMModuleType = (typeof LLM_MODULE_OPTIONS)[number];

export type Pagination = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

export type ApiEnvelope<T> = {
  code: number;
  message: string;
  data: T;
};

export type Question = {
  id: number;
  question_text: string;
  main_subject: MainSubject;
  sub_subject: SubSubject;
  is_wrong: boolean;
  image_url: string | null;
  reference_answer: string | null;
  created_at: string;
  updated_at: string;
};

export type QuestionPayload = {
  question_text: string;
  main_subject: MainSubject;
  sub_subject: SubSubject;
  is_wrong: boolean;
  image_url: string | null;
  reference_answer?: string | null;
};

export type QuestionFilters = {
  page: number;
  page_size: number;
  main_subject?: MainSubject;
  sub_subject?: SubSubject;
  is_wrong?: boolean;
  keyword?: string;
  sort?: string;
};

export type QuestionListData = {
  items: Question[];
  pagination: Pagination;
};

export type QuestionCandidate = Question & {
  similarity_score: number;
};

export type QuestionDeleteResult = {
  id: number;
  deleted: boolean;
};

export type DeduplicateResult = {
  exists: boolean;
  matched_question_id: number | null;
  main_subject: MainSubject | null;
  sub_subject: SubSubject | null;
  reason: string;
};

export type QuestionImageRecognitionResult = {
  image_url: string | null;
  ocr_text: string;
  candidates: Question[];
  deduplicate_result: DeduplicateResult;
  matched_question: Question | null;
};

export type QuestionImageCandidateSearchResult = {
  ocr_text: string;
  candidates: QuestionCandidate[];
};

export type LLMConfig = {
  id: number;
  config_name: string;
  module_type: LLMModuleType;
  provider_type: ProviderType;
  base_url: string;
  api_key_masked: string;
  model_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LLMConfigPayload = {
  config_name: string;
  module_type: LLMModuleType;
  provider_type: ProviderType;
  base_url: string;
  api_key?: string;
  model_name: string;
  is_active: boolean;
};

export type LLMConfigListData = {
  items: LLMConfig[];
};

export type LLMConfigActivateResult = {
  id: number;
  is_active: boolean;
};

export type LLMConfigDeleteResult = {
  id: number;
  deleted: boolean;
};

export type LLMConfigTestPayload = {
  module_type: LLMModuleType;
  provider_type: ProviderType;
  base_url: string;
  api_key: string;
  model_name: string;
};

export type LLMConfigTestResult = {
  success: boolean;
  module_type?: LLMModuleType;
  provider_type?: ProviderType;
  model_name?: string;
  detail: string;
};
