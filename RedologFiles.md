# RedologFiles — 开发日志

## 2026-05-07

### 项目初始化

- 使用 Vite + Vue 3 创建前端项目（`frontend/`）
- 使用 Node.js + Express 创建后端项目骨架（`backend/`）

### TypeScript 配置

- 安装 typescript、vue-tsc、@types/three
- 创建 tsconfig.json、tsconfig.app.json、tsconfig.node.json
- 创建 vite-env.d.ts Vue 类型声明
- 将 vite.config.js 转换为 vite.config.ts
- 将 main.js 转换为 main.ts
- 将 router/index.js 转换为 router/index.ts

### 前端页面

- **文档库页面**（DocumentLibrary.vue）：将原 index.html 设计稿转换为 Vue 组件
  - 顶部导航栏（Logo、导航菜单、搜索框、后台页面跳转、上传按钮、头像）
  - 侧边栏（浏览区、分类区、标签区）
  - 统计卡片（总文档数、活跃分享、团队成员、存储用量）
  - 精选文档区域
  - 文档卡片列表（类型标识、标题、摘要、作者、时间）

- **后台管理页面**（AdminDashboard.vue）：数据概览页面
  - 统计卡片组件（StatsCards.vue）
  - Three.js 3D 柱状图组件（CategoryChart.vue）：文档分类占比可视化
  - ECharts 折线图组件（UploadTrend.vue）：最近 7 天上传趋势
  - 最近活动列表

### 路由配置

- `/` → 文档库页面（DocumentLibrary.vue）
- `/admin` → 后台管理页面（AdminDashboard.vue）

### 后端骨架

- 创建 backend 目录结构：config、routes、controllers、models、middleware
- 创建 app.js（Express 入口）
- 创建 .env（数据库连接配置）
- 创建 config/db.js（MySQL 连接池）

### 样式方案

- 前端使用 Tailwind CSS
- 文档库页面保留原设计稿的自定义 CSS 变量体系

## 2026-05-14

### 后端重构：JS → TypeScript

- 删除旧的 `backend/app.js` 和 `backend/config/db.js`
- 新建 TypeScript 项目结构：`backend/src/`
  - `app.ts` — Express 入口
  - `config/` — DB 连接与 OSS 配置
  - `controllers/` — 业务逻辑处理
  - `middlewares/` — authMiddleware、uploadMiddleware
  - `models/` — ORM 实体定义（Users, Documents, Categories, Tags, Favorites）
  - `routes/` — 路由分发
  - `services/` — OSS 上传等服务
  - `seed.ts` — 种子数据
- 更新 `backend/package.json`（添加 TypeScript 相关依赖）

### 前端架构搭建

- **API 层**（`frontend/src/api/`）：
  - `client.ts` — Axios 实例（JWT 拦截器、错误处理）
  - `auth.ts`、`document.ts`、`admin.ts`、`favorite.ts` — 按业务划分的请求函数
- **状态管理**（`frontend/src/stores/`）：Pinia stores — `auth.ts`、`admin.ts`、`document.ts`
- **路由守卫**：更新 `router/index.ts`，JWT 校验 + admin 角色检查
- **布局组件**：新建 `AdminLayout.vue`

### 页面开发

- **登录页**：`views/auth/Login.vue`
- **后台管理页**：
  - `views/admin/Dashboard.vue` — 数据概览
  - `views/admin/DocManage.vue` — 文档查询、修改元数据、替换上传
  - `views/admin/UserManage.vue` — 用户管理与密码重置
- 删除旧的 `AdminDashboard.vue`

### 组件更新

- 新建 `TagSelector.vue`（标签选择器）、`UploadDialog.vue`（上传对话框，含大小/数量限制）
- 重构 `DocumentLibrary.vue`（820 行变更，整合 API 与状态管理）
- 更新图表组件：`CategoryChart.vue`、`StatsCards.vue`、`UploadTrend.vue`
- 更新 `main.ts`、`vite.config.ts`

### 文档

- 更新 `CONTEXT.md`（项目规格说明，151 行变更）
