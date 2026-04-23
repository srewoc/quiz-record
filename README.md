# 做题记录系统

基于以下技术栈的单仓库项目骨架：

- 前端：Next.js + TypeScript + npm
- 后端：FastAPI + SQLAlchemy 2.0 + Alembic + uv
- 数据库：PostgreSQL
- 本地基础设施：Docker Compose

## 目录结构

```text
.
├── frontend/
├── backend/
├── docker-compose.yml
├── API接口设计文档.md
├── 数据库设计文档.md
└── 需求文档.md
```

## 环境要求

- Python 3.12
- `uv`
- Node.js 22 LTS
- npm
- Docker
- Docker Compose

## 本地初始化

### 1. 启动 PostgreSQL

```bash
docker compose up -d postgres
```

### 2. 初始化后端虚拟环境

```bash
cd backend
uv python install 3.12
uv venv
uv sync
cp .env.example .env
```

说明：

- Python 虚拟环境只在 `backend/.venv` 中创建。
- 不在仓库根目录创建第二套 Python 虚拟环境。
- 后端依赖统一通过 `uv` 管理，不混用全局 Python 依赖。

### 3. 初始化前端依赖

```bash
cd frontend
cp .env.local.example .env.local
npm install
```

## 数据库迁移

```bash
cd backend
uv run alembic upgrade head
```

迁移会：

- 创建 `questions` 表
- 创建 `llm_configs` 表
- 启用 `pg_trgm` 扩展
- 创建相似检索和筛选相关索引

## 启动开发服务

### 后端

```bash
cd backend
uv run uvicorn app.main:app --reload
```

默认地址：

- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`

### 前端

```bash
cd frontend
npm run dev
```

默认地址：

- Web: `http://127.0.0.1:3000`

## 常用命令

### 后端

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
uv run pytest
uv run ruff check .
```

### 前端

```bash
cd frontend
npm run dev
npm run lint
npm run build
```

### Docker

```bash
docker compose up -d postgres
docker compose down
```

## 环境变量

### 根目录

根目录 `.env.example` 仅用于描述数据库容器默认值，不作为应用运行时配置。

### 后端

复制 `backend/.env.example` 为 `backend/.env`。

关键变量：

- `APP_ENV`
- `APP_HOST`
- `APP_PORT`
- `DATABASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_PORT`
- `SECRET_KEY`

### 前端

复制 `frontend/.env.local.example` 为 `frontend/.env.local`。

关键变量：

- `NEXT_PUBLIC_API_BASE_URL`

## 当前初始化范围

当前仓库已完成：

- 根目录工程文件
- Docker Compose PostgreSQL 环境
- FastAPI 工程骨架
- SQLAlchemy 2.0 模型基线
- Alembic 初始化和首个迁移脚本
- Next.js App Router 页面骨架
- 健康检查接口与基础 API 路由前缀

当前尚未完成：

- OCR 业务实现
- 题目管理业务接口实现
- LLM 管理业务接口实现
- 前端真实表单和列表交互

