# CLAUDE.md

## Project Overview

Papier — 团队文档管理与 AI 学习平台。核心链路：文档上传 → 自动解析 → AI 生成题目 → 每日练习。

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Tailwind CSS + Three.js + ECharts + Pinia
- **Backend**: Node.js + Express + TypeScript + Sequelize ORM + Zod
- **Database**: MySQL 8.0 + LanceDB (向量检索)
- **AI**: DeepSeek (LLM) · 智谱 embedding-2 · SiliconFlow (Rerank)
- **Deploy**: Docker Compose + Nginx

## Commands

- `cd frontend && npm run dev` — 启动前端开发服务器
- `cd frontend && npm run build` — 构建前端
- `cd backend && npm run dev` — 启动后端开发服务器
- `cd backend && npm run build` — 编译后端 TypeScript
- `cd backend && npm test` — 运行全部测试（90 用例：74 单元 + 16 集成）
- `docker compose up -d --build` — Docker 构建启动

## Project Structure

```
frontend/          — Vue 3 前端
backend/           — Node.js 后端
docs/              — 项目文档
deploy/            — 生产部署配置
```

## Agent skills

### Issue tracker

GitHub Issues (phj-phj/AI-web). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
