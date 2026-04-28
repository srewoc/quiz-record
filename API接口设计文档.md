# 做题记录系统 API 接口设计文档

## 1. 文档说明

### 1.1 文档目的
本文档用于定义做题记录系统后端 REST API 的接口规范，供前端、后端和测试在开发与联调阶段统一使用。

### 1.2 技术约束
- 后端框架：FastAPI
- 数据格式：JSON
- 字符编码：UTF-8
- 时间格式：ISO 8601，统一使用带时区时间字符串

### 1.3 设计原则
- 接口语义清晰，资源路径采用 REST 风格。
- 成功响应结构尽量统一，便于前端通用处理。
- 参数校验尽量在后端集中处理，返回明确错误信息。
- 本期为单用户系统，不设计认证鉴权接口。

## 2. 通用约定

### 2.1 基础路径
建议统一前缀：

```text
/api/v1
```

以下文档中的路径均以该前缀为默认基础路径，例如 `GET /questions` 实际可实现为 `GET /api/v1/questions`。

### 2.2 通用响应结构

#### 2.2.1 成功响应
```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

#### 2.2.2 失败响应
```json
{
  "code": 4001,
  "message": "参数校验失败",
  "data": null
}
```

### 2.3 通用分页结构
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 58,
      "total_pages": 3
    }
  }
}
```

### 2.4 通用状态码
- `200 OK`：查询、更新、删除成功
- `201 Created`：创建成功
- `400 Bad Request`：参数错误或业务校验失败
- `404 Not Found`：资源不存在
- `409 Conflict`：业务冲突，例如重复题阻断、启用配置冲突
- `500 Internal Server Error`：服务内部异常
- `502 Bad Gateway`：外部 OCR 或 LLM 服务异常

### 2.5 通用错误码建议

| 错误码 | 含义 |
| --- | --- |
| 4001 | 请求参数校验失败 |
| 4002 | 主科目与子科目不匹配 |
| 4003 | 图片 URL 格式非法 |
| 4004 | LLM 配置参数非法 |
| 4041 | 题目不存在 |
| 4042 | LLM 配置不存在 |
| 4091 | 题目已存在，禁止新增 |
| 4092 | 启用配置冲突 |
| 4093 | 当前配置不可删除或不可变更 |
| 5021 | OCR 服务调用失败 |
| 5022 | LLM 服务调用失败 |
| 5023 | LLM 未配置 |

## 3. 枚举定义

### 3.1 主科目枚举
- `数学`
- `408`

### 3.2 子科目枚举
- `高数`
- `线代`
- `概率论`
- `数据结构`
- `计组`
- `操作系统`
- `计网`

### 3.3 LLM 供应商枚举
- `openai`

## 4. 数据对象定义

### 4.1 Question 对象
```json
{
  "id": 1,
  "question_text": "设函数 f(x) = ...",
  "main_subject": "数学",
  "sub_subject": "高数",
  "is_wrong": true,
  "image_url": "https://example.com/question.png",
  "reference_answer": "## 解答\n\n先求导...",
  "created_at": "2026-04-22T10:00:00+08:00",
  "updated_at": "2026-04-22T11:00:00+08:00"
}
```

### 4.2 LLMConfig 对象
```json
{
  "id": 1,
  "config_name": "default-openai",
  "provider_type": "openai",
  "base_url": "https://api.openai.com/v1",
  "api_key_masked": "sk-****abcd",
  "model_name": "gpt-4o-mini",
  "is_active": true,
  "created_at": "2026-04-22T10:00:00+08:00",
  "updated_at": "2026-04-22T10:30:00+08:00"
}
```

### 4.3 DeduplicateResult 对象
```json
{
  "exists": true,
  "matched_question_id": 10,
  "main_subject": "数学",
  "sub_subject": "高数",
  "reason": "与题库中第 10 题语义一致"
}
```

## 5. 题目管理接口

### 5.1 获取题目列表

#### 接口定义
- 方法：`GET /questions`
- 用途：分页查询题目列表

#### Query 参数

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| page | int | 否 | 1 | 页码，从 1 开始 |
| page_size | int | 否 | 20 | 每页条数，建议最大 100 |
| main_subject | string | 否 | - | 主科目筛选 |
| sub_subject | string | 否 | - | 子科目筛选 |
| is_wrong | bool | 否 | - | 是否错题 |
| keyword | string | 否 | - | 题目文本关键词 |
| sort | string | 否 | `updated_at_desc` | 排序方式 |

#### 成功响应示例
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "question_text": "设函数 f(x) = ...",
        "main_subject": "数学",
        "sub_subject": "高数",
        "is_wrong": true,
        "image_url": "https://example.com/question.png",
        "reference_answer": "## 解答\n\n先求导...",
        "created_at": "2026-04-22T10:00:00+08:00",
        "updated_at": "2026-04-22T11:00:00+08:00"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  }
}
```

#### 业务规则
- 仅返回当前数据库中存在的题目记录。
- 默认按 `updated_at desc` 排序。

### 5.2 获取题目详情

#### 接口定义
- 方法：`GET /questions/{id}`
- 用途：查询单个题目详情

#### Path 参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | int | 是 | 题目 ID |

#### 成功响应
- `data` 返回完整 `Question` 对象。

#### 失败场景
- 题目不存在返回 `4041`。

### 5.3 新增题目

#### 接口定义
- 方法：`POST /questions`
- 用途：新增题目

#### 请求体
```json
{
  "question_text": "设函数 f(x) = ...",
  "main_subject": "数学",
  "sub_subject": "高数",
  "is_wrong": true,
  "image_url": "https://example.com/question.png",
  "reference_answer": "## 解答\n\n先求导..."
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| question_text | string | 是 | 题目文本 |
| main_subject | string | 是 | 主科目 |
| sub_subject | string | 是 | 子科目 |
| is_wrong | bool | 是 | 是否错题 |
| image_url | string | 否 | 图片 URL |
| reference_answer | string | 否 | Markdown 格式答案 |

#### 成功响应
- `201 Created`
- `data` 返回创建后的 `Question` 对象

#### 失败场景
- 题目文本为空返回 `4001`
- 科目不匹配返回 `4002`
- 图片 URL 非法返回 `4003`
- 若后端在提交前再次校验发现重复，可返回 `4091`

### 5.4 修改题目

#### 接口定义
- 方法：`PUT /questions/{id}`
- 用途：修改题目

#### Path 参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | int | 是 | 题目 ID |

#### 请求体
与新增题目接口一致。

#### 成功响应
- `200 OK`
- `data` 返回更新后的 `Question` 对象

#### 业务规则
- 修改时默认不自动触发 OCR。
- 修改时默认不自动触发完整查重流程。
- 可在服务端增加弱校验提示逻辑，但本接口以保存成功为主。

### 5.5 删除题目

#### 接口定义
- 方法：`DELETE /questions/{id}`
- 用途：删除题目

#### Path 参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | int | 是 | 题目 ID |

#### 成功响应示例
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "deleted": true
  }
}
```

#### 业务规则
- 实际执行数据库物理删除。
- 删除后同题干可重新新增为新记录。

## 6. 题目检索与查重接口

### 6.1 文本查询

#### 接口定义
- 方法：`POST /questions/search/text`
- 用途：基于文本执行候选检索和 LLM 匹配

#### 请求体
```json
{
  "question_text": "设函数 f(x) = ..."
}
```

#### 成功响应示例
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "input_text": "设函数 f(x) = ...",
    "candidates": [
      {
        "id": 10,
        "question_text": "设函数 f(x) = ...",
        "main_subject": "数学",
        "sub_subject": "高数",
        "is_wrong": false,
        "image_url": null,
        "reference_answer": null,
        "created_at": "2026-04-22T10:00:00+08:00",
        "updated_at": "2026-04-22T10:00:00+08:00"
      }
    ],
    "deduplicate_result": {
      "exists": true,
      "matched_question_id": 10,
      "main_subject": "数学",
      "sub_subject": "高数",
      "reason": "与题库中第 10 题语义一致"
    },
    "matched_question": {
      "id": 10,
      "question_text": "设函数 f(x) = ...",
      "main_subject": "数学",
      "sub_subject": "高数",
      "is_wrong": false,
      "image_url": null,
      "reference_answer": null,
      "created_at": "2026-04-22T10:00:00+08:00",
      "updated_at": "2026-04-22T10:00:00+08:00"
    }
  }
}
```

#### 业务规则
- 仅返回当前数据库中存在的题目候选。
- `candidates` 最多 20 条。
- 若 LLM 未配置，返回 `5023`。

### 6.2 图片查询

#### 接口定义
- 方法：`POST /questions/search/image`
- 用途：上传图片，先 OCR，再检索与匹配

#### 请求格式
建议使用 `multipart/form-data`

#### 表单字段

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| file | binary | 是 | 题目图片文件 |

#### 成功响应字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| ocr_text | string | OCR 输出文本 |
| candidates | array | 候选题目列表 |
| deduplicate_result | object | LLM 判定结果 |
| matched_question | object/null | 命中题目详情 |

#### 失败场景
- OCR 失败返回 `5021`
- LLM 失败返回 `5022`
- 未配置 LLM 返回 `5023`

### 6.3 重复题检测

#### 接口定义
- 方法：`POST /questions/deduplicate`
- 用途：在新增流程中独立调用查重与科目识别

#### 请求体
```json
{
  "question_text": "设函数 f(x) = ..."
}
```

#### 成功响应
- `data` 返回 `DeduplicateResult` 对象

#### 业务规则
- 内部流程为：`pg_trgm` 候选检索 -> 统一 LLM 模块调用 -> 返回判定结果
- 若 `exists = true`，前端应阻断新增

## 7. LLM 配置管理接口

### 7.1 获取 LLM 配置列表

#### 接口定义
- 方法：`GET /llm-configs`
- 用途：查询全部 LLM 配置

#### 成功响应
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [
      {
        "id": 1,
        "config_name": "default-openai",
        "provider_type": "openai",
        "base_url": "https://api.openai.com/v1",
        "api_key_masked": "sk-****abcd",
        "model_name": "gpt-4o-mini",
        "is_active": true,
        "created_at": "2026-04-22T10:00:00+08:00",
        "updated_at": "2026-04-22T10:30:00+08:00"
      }
    ]
  }
}
```

#### 业务规则
- 不返回明文 API Key
- 默认按 `updated_at desc` 或 `created_at desc` 排序

### 7.2 新增 LLM 配置

#### 接口定义
- 方法：`POST /llm-configs`
- 用途：新增 LLM 配置

#### 请求体
```json
{
  "config_name": "default-openai",
  "provider_type": "openai",
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-xxxxx",
  "model_name": "gpt-4o-mini",
  "is_active": true
}
```

#### 业务规则
- 本期 `provider_type` 仅允许 `openai`
- 若 `is_active = true`，则需将其他配置自动置为 `false`
- 保存时必须对 API Key 做安全存储处理

#### 成功响应
- `201 Created`
- `data` 返回脱敏后的 `LLMConfig` 对象

### 7.3 修改 LLM 配置

#### 接口定义
- 方法：`PUT /llm-configs/{id}`
- 用途：修改指定配置

#### Path 参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | int | 是 | 配置 ID |

#### 请求体
与新增配置接口一致。

#### 业务规则
- 若未传新 API Key，可在实现中支持“保持原值”，但响应中仍只返回脱敏值
- 修改为启用配置时，需自动关闭其他启用配置

### 7.4 启用 LLM 配置

#### 接口定义
- 方法：`POST /llm-configs/{id}/activate`
- 用途：将指定配置切换为当前启用配置

#### 成功响应示例
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 2,
    "is_active": true
  }
}
```

#### 业务规则
- 该操作需保证事务一致性
- 成功后系统只能存在一个 `is_active = true` 的配置

### 7.5 测试 LLM 配置连接

#### 接口定义
- 方法：`POST /llm-configs/test`
- 用途：验证给定配置是否可以完成一次最小化模型调用

#### 请求体
```json
{
  "provider_type": "openai",
  "base_url": "https://api.openai.com/v1",
  "api_key": "sk-xxxxx",
  "model_name": "gpt-4o-mini"
}
```

#### 成功响应示例
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "success": true,
    "provider_type": "openai",
    "model_name": "gpt-4o-mini",
    "detail": "连接测试成功"
  }
}
```

#### 失败响应示例
```json
{
  "code": 5022,
  "message": "LLM 服务调用失败",
  "data": {
    "success": false,
    "detail": "401 Unauthorized"
  }
}
```

## 8. FastAPI Pydantic 模型建议

### 8.1 题目相关
- `QuestionListQuery`
- `QuestionCreateRequest`
- `QuestionUpdateRequest`
- `QuestionResponse`
- `QuestionListResponse`
- `QuestionSearchTextRequest`
- `QuestionDeduplicateRequest`
- `DeduplicateResultResponse`

### 8.2 LLM 配置相关
- `LLMConfigCreateRequest`
- `LLMConfigUpdateRequest`
- `LLMConfigResponse`
- `LLMConfigListResponse`
- `LLMConfigTestRequest`
- `LLMConfigTestResponse`

### 8.3 通用
- `APIResponse[T]`
- `Pagination`

## 9. 联调与测试关注点

### 9.1 题目接口
- 列表分页、筛选、排序是否正确
- 修改后更新时间是否刷新
- 删除后是否不可见且数据库记录已移除

### 9.2 检索接口
- `pg_trgm` 候选是否最多返回 20 条
- OCR 文本是否原样回传给前端
- LLM 未配置时是否返回明确错误
- 重复题命中时前端是否可据此阻断新增

### 9.3 LLM 配置接口
- API Key 是否全链路脱敏
- 启用切换是否保持唯一激活
- 测试连接是否不会污染正式业务数据

## 10. 实现建议
- FastAPI 路由按 `questions`、`question_search`、`llm_configs` 分模块组织。
- 统一异常处理中间件负责将业务异常映射到标准错误码。
- 统一响应封装函数负责输出一致结构。
- LLM 调用应集中在独立 service 层，例如 `services/llm_client.py`。
- OCR 调用可单独放在 `services/ocr.py`。
