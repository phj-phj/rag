# CLAUDE.md

## Project Overview

Papier — 团队文档管理与分享平台，基于 Vue 3 + Node.js + MySQL 架构。

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Tailwind CSS + Three.js + ECharts
- **Backend**: Node.js + Express + MySQL
- **Package Manager**: cnpm

## Commands

- `cd frontend && npm run dev` — 启动前端开发服务器
- `cd frontend && npm run lint` — ESLint 检查
- `cd frontend && npm run lint:fix` — ESLint 自动修复
- `cd frontend && npm run build` — 构建前端
- `cd backend && npm run dev` — 启动后端开发服务器

## Project Structure

```
frontend/          — Vue 3 前端
backend/           — Node.js 后端
docs/              — 项目文档
```

## Agent skills

### Issue tracker

GitHub Issues (phj-phj/AI-web). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.
