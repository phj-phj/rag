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

## 2026-05-15

### MySQL 环境重建

- 彻底卸载旧版 MySQL（8.0.28 便携版 + 9.7 安装版双服务冲突，同时开机自启）
- 安装 MySQL 8.0.36 至 `C:\mysql\mysql-8.0.36-winx64\`，端口 3306
- 创建管理员 `phj`（全部权限），数据库 `papier`（utf8mb4）
- 更新 `backend/.env` 数据库连接配置
- 运行 `npm run seed` 初始化表及种子数据（默认分类/用户/标签）

### 依赖修复

- **uuid@14 ESM 不兼容修复**：`uuid@14` 为纯 ESM 模块，与项目 CommonJS（tsconfig `module: commonjs`）冲突
  - `backend/src/middlewares/upload.ts`：`import { v4 as uuidv4 } from 'uuid'` → `import crypto from 'crypto'`，`uuidv4()` → `crypto.randomUUID()`
  - `backend/package.json`：移除 `uuid`、`@types/uuid` 依赖

### 后台仪表盘改造

- **恢复 AdminDashboard.vue**：上次提交误删，现重新作为主仪表盘页面
  - 接入 Three.js 3D 旋转柱状图（CategoryChart.vue）— 分类占比，场景自动旋转
  - 接入 ECharts 折线图（UploadTrend.vue）— 7 日上传趋势，渐变填充
  - 最近活动流从硬编码数据改为从 `adminStore.fetchStats()` 获取真实数据
  - 彩色头像渐变（用户名哈希分配）+ 文件类型标签 + 相对时间格式化
- 修复图表无数据时不渲染的问题：移除 `v-if="adminStore.stats"` 条件，图表组件自行处理空状态
- **后端 `admin.controller.ts`**：`getStats` 接口最近活动新增 `file_type` 字段

### 状态管理更新

- `frontend/src/stores/admin.ts`：扩展 `AdminStats` 接口，包含 `categoryStats`、`uploadTrend`、`recentActivities` 完整类型

### 后台管理页面重设计（frontend-design skill）

- **DocManage.vue 重写**：
  - 统一 Header 导航栏（与 AdminDashboard 一致）
  - 搜索栏卡片式设计（SVG 图标 + 焦点 amber 边框）
  - 表格增强：彩色文件类型标签（PDF红/DOC绿等）、用户头像渐变色、标签琥珀色调
  - 操作按钮 hover 显示、加载旋转动画、空状态插画
  - 编辑弹窗：毛玻璃背景 + 缩放动画
- **UserManage.vue 重写**：
  - 统计小卡片（平台用户/管理员/普通用户）
  - 用户列表：头像渐变色 + 角色指示器（admin 琥珀/user 蓝，带圆点）
  - 修改密码弹窗：用户头像 + 成功反馈动画
  - 统一风格 Header

### 路由重构

- 移除 AdminLayout 包裹：三页面各自拥有独立 Header，不再通过 sidebar 嵌套
- 路由简化为 5 条：
  - `/` → DocumentLibrary
  - `/login` → Login
  - `/admin` → AdminDashboard（独立页）
  - `/admin/docs` → DocManage（独立页）
  - `/admin/users` → UserManage（独立页）
- 修复旧路由引用：`/admin/dashboard` → `/admin`（DocumentLibrary.vue、Login.vue）

### 文件清理

- 删除 `frontend/src/views/admin/Dashboard.vue`（被 AdminDashboard.vue 替代）
- 删除 `frontend/src/components/HelloWorld.vue`（Vite 模板残留，无任何引用）
- 保留 `frontend/src/layouts/AdminLayout.vue`（后续可能复用）

### 退出登录功能

- 全部 4 个页面添加头像下拉退出菜单：
  - DocumentLibrary、AdminDashboard、DocManage、UserManage
  - 点击头像 → 弹出下拉（用户名 + 角色 + 退出按钮）
  - 点击页面空白处自动关闭
  - 调用 `authStore.logout()` 清除 token，跳转 `/login`
- 新增点击外部关闭指令逻辑（`onClickOutside` + `document.addEventListener`）
