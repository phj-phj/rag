# CONTEXT.md — Papier 文档分享平台

## 项目简介

Papier 是一个团队文档管理与分享平台，提供文档上传、分类管理、标签筛选、搜索、收藏等功能。

## 核心概念

| 术语 | 说明 |
|------|------|
| 文档 (Document) | 用户上传的文件，支持 PDF、DOC、PPT、SHEET 类型 |
| 分类 (Category) | 文档的归类，如技术文档、产品需求、会议纪要等 |
| 标签 (Tag) | 文档的关键词标记，一个文档可有多个标签 |
| 收藏 (Favorite) | 用户收藏的文档 |
| 精选 (Featured) | 置顶推荐的文档 |
| 文档库 (Library) | 所有文档的集合视图 |

## 技术栈

- **Frontend**: Vue 3 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + MySQL
- **3D 可视化**: Three.js（后台分类占比图）
- **图表**: ECharts（上传趋势折线图）

## 项目结构

```
frontend/          — Vue 3 前端应用
  src/views/       — 页面组件
  src/components/  — 公共组件
  src/router/      — 路由配置
backend/           — Node.js 后端服务
  config/          — 数据库配置
  routes/          — API 路由
  controllers/     — 控制器
  models/          — 数据模型
docs/              — 项目文档
  agents/          — Agent skills 配置
  adr/             — 架构决策记录
```

## 页面

- `/` — 文档库首页（文档列表、统计、精选文档）
- `/admin` — 后台管理（数据概览、分类占比、上传趋势）
