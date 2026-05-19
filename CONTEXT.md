# CONTEXT.md — Papier 文档分享平台 (Development Spec)

## 1. 项目概述
Papier 是一个前后端分离的团队文档管理平台。核心诉求是实现文档的安全存储、多维度分类筛选、以及后台精细化管理。
**注意：本文档旨在指导 AI 助手进行代码生成，请严格遵循以下技术栈与业务逻辑。**

## 2. 技术栈与核心依赖
- **Frontend**: Vue 3 (Composition API, `<script setup>`), TypeScript, Vite, Tailwind CSS, Vue Router, Pinia (状态管理), Axios.
- **Backend**: Node.js, Express, TypeScript, MySQL 8.0, Sequelize ORM.
- **文件存储**: 本地磁盘 (`uploads/` 目录), Express 静态文件服务.
- **鉴权**: JWT (`jsonwebtoken`), 密码加密 (`bcryptjs`).
- **文件上传**: `multer`.
- **文档解析**: `unpdf` (PDF 文字提取 + 内嵌图片), `jszip` (DOCX 文字 + 内嵌图片提取).

## 3. 数据库设计 (MySQL Schema)
系统包含以下核心实体及关系，请在生成后端模型时参考：

- **Users (用户表)**
  - `id`: PK
  - `username`: String, Unique
  - `password`: String (Bcrypt Hash)
  - `role`: Enum ('user', 'admin') // 核心权限字段
  - `created_at`, `updated_at`

- **Categories (分类表)**
  - `id`: PK
  - `name`: String (如：技术文档、会议纪要)

- **Tags (标签表)**
  - `id`: PK
  - `name`: String, Unique

- **Documents (文档表)**
  - `id`: PK
  - `title`: String
  - `file_type`: String (pdf, doc, docx, txt, png, jpg, jpeg, gif, webp, bmp)
  - `file_size`: Integer (bytes)
  - `file_path`: String (本地存储路径: `uploads/{uuid}.{ext}`)
  - `uploader_id`: FK -> Users.id
  - `category_id`: FK -> Categories.id
  - `is_featured`: Boolean (是否精选)
  - `created_at`, `updated_at`

- **Document_Tags (文档-标签关联表 - 多对多)**
  - `document_id`: FK
  - `tag_id`: FK

- **Favorites (用户收藏表)**
  - `user_id`: FK
  - `document_id`: FK

## 4. 核心业务逻辑与规范

### 4.1 鉴权与角色 (Auth & RBAC)
- 登录接口校验成功后颁发 JWT，前端统一存储。
- 请求拦截器：除了 `/login`、`/register` 和公开的静态资源，所有 API 请求需在 Header 携带 `Authorization: Bearer <token>`。
- **Admin 权限**：后台 `/admin` 前缀的路由和对应的 API 只有 `role === 'admin'` 的用户可访问。
- **密码管理**：Admin 有权限调用特定接口，强制修改任意 User 的密码（直接覆盖更新 Hash）。
- **用户注册**：`POST /api/auth/register` 公开接口，注册后自动签发 JWT（自动登录）。

### 4.2 文件上传机制
- **上传限制**：前端和后端（Multer）均需校验，单次请求最多 **10** 个文件，单个文件最大 **10MB**。前端 `UploadDialog.vue` 的 `addFiles()` 先验后加（预扫描全部文件，超量/超大列出具体文件名）。
- **支持的文件类型**：PDF (.pdf)、Word (.doc/.docx)、TXT (.txt)、图片 (.png/.jpg/.jpeg/.gif/.webp/.bmp)
- **上传流程**：
  1. 客户端通过 `multipart/form-data` 将文件传给 Node.js 后端。
  2. 后端 `multer` 中间件校验 MIME 类型和文件大小，写入 `uploads/` 目录。
  3. 文件以 `{uuid}.{ext}` 命名存储，结合前端传来的 `title`, `category_id`, `tags` 等信息，写入 `Documents` 表。
  4. 文件通过 Express 静态文件服务 `/uploads/` 路径对外提供访问。

### 4.3 文档内容解析与预览
- **TXT**：直接读取原始文件返回文本。
- **PDF**：使用 `unpdf.extractText` 提取文字，`unpdf.extractImages` 提取内嵌图片（base64）。
- **DOCX**：使用 `jszip` 解压 ZIP，解析 `word/document.xml` 提取文字段落，提取 `word/media/` 中的内嵌图片。
- **图片**：直接通过 `<img>` 展示，不做 OCR。
- **内容 API**：`GET /api/documents/:id/content` 返回 `{ text, file_type, images }`。
- **DocViewer 页面**：`/docs/:id` 路由，根据文件类型渲染文字 + 内嵌图片，或直接展示图片。

### 4.4 后台文档管理 (Admin Document Management)
- **多条件检索**：后端需实现组合查询 API，支持通过 `title` (模糊搜索 LIKE)、`category_id`、`tags` 进行筛选过滤。
- **修改元数据**：Admin 可以更改已有文档的 `title`, `category_id`, 和关联的 `tags`。
- **替换源文件 (覆盖上传)**：
  - 业务逻辑：Admin 针对已有的一条 Document 记录，上传一个新的文件。
  - 后端操作：将新文件保存至 `uploads/` 目录；在 `Documents` 表中更新该行的 `file_path`, `file_size`, `file_type` 字段，并删除旧文件。

### 4.5 响应式设计
- **DocumentLibrary**：900px 以下显示汉堡菜单 + 移动导航覆盖层（slide-down 动画）、侧边栏滑入切换、640px 以下侧边栏 FAB 圆形浮动按钮。
- **DocViewer**：768px / 640px 双断点，内边距和字号递减。
- **UploadDialog**：640px 以下弹窗边距收紧。
- **AdminLayout**：768px 以下隐藏侧边栏。

## 5. API 路由设计 (RESTful 规范)

| 方法 | 路径 | 角色 | 描述 |
|---|---|---|---|
| POST | `/api/auth/login` | 公开 | 登录获取 JWT |
| POST | `/api/auth/register` | 公开 | 注册新用户（自动签发 JWT） |
| GET | `/api/documents` | 公开 | 获取文档列表（支持 title/category_id/tags/is_featured/uploader_id 筛选 + 分页） |
| GET | `/api/documents/:id` | 公开 | 获取单个文档详情 |
| GET | `/api/documents/:id/content` | 公开 | 获取文档解析内容（文字 + 内嵌图片） |
| POST | `/api/documents` | User/Admin | 上传新文档 (支持多文件) |
| DELETE | `/api/documents/:id` | User/Admin | 删除文档（本人或管理员） |
| GET | `/api/favorites` | User/Admin | 获取收藏列表 |
| POST | `/api/favorites/toggle/:documentId` | User/Admin | 切换收藏状态 |
| GET | `/api/categories` | 公开 | 获取分类列表（含文档计数） |
| GET | `/api/tags` | 公开 | 获取标签列表 |
| GET | `/api/admin/stats` | 公开 | 获取仪表盘统计数据 |
| GET | `/api/admin/documents` | Admin | 后台文档列表 |
| PUT | `/api/admin/documents/:id` | Admin | 修改文档元数据 (标题/分类/标签) |
| POST | `/api/admin/documents/:id/replace` | Admin | 替换文档文件 |
| DELETE | `/api/admin/documents/:id` | Admin | 删除文档 |
| GET | `/api/admin/users` | Admin | 获取用户列表 |
| PUT | `/api/admin/users/:id/password` | Admin | 修改用户密码 |

## 6. 项目结构体系

```text
frontend/
  src/
    api/           # Axios 实例及按业务划分的 API 请求函数
      client.ts    # Axios 实例（JWT 拦截器、401 处理）
      auth.ts      # 登录、注册
      document.ts  # 文档列表、详情、内容、上传、删除
      admin.ts     # 后台管理（统计、文档、用户、分类、标签）
      favorite.ts  # 收藏（列表、切换、删除）
    components/    # 公用组件
      UploadDialog.vue  # 上传对话框（前端大小/数量校验）
      TagSelector.vue   # 标签选择器
      CategoryChart.vue # Three.js 3D 分类柱状图
      StatsCards.vue    # 统计卡片
      UploadTrend.vue   # ECharts 上传趋势折线图
    stores/        # Pinia stores
      auth.ts      # 认证状态（token/user/isAdmin）
      document.ts  # 文档列表/筛选/分页
      admin.ts     # 后台统计数据
    views/         # 页面
      DocumentLibrary.vue  # 前台文档库首页（侧边栏 + 网格）
      DocViewer.vue        # 文档内容查看器（支持 txt/pdf/word/image）
      RecentDocs.vue       # "最近文档"页面（仅当前用户文档）
      auth/
        Login.vue          # 登录页
        Register.vue       # 注册页
      admin/
        DocManage.vue      # 后台文档管理（查询/修改/替换）
        UserManage.vue     # 后台用户管理（列表/改密）
      AdminDashboard.vue   # 后台数据概览（3D图表 + 趋势图）
    layouts/       # 布局组件
      AdminLayout.vue  # 后台侧边栏布局（可选）
    router/        # 路由配置（含 beforeEach 守卫：JWT + admin 检查）
    stores/        # Pinia 状态管理

backend/
  src/
    config/        # DB 连接 (database.ts) 与环境变量 (env.ts)
    middlewares/   # auth.ts (JWT 验证 + admin 角色), upload.ts (Multer 配置)
    controllers/   # auth / document / admin / favorite 业务逻辑
    routes/        # auth / document / admin / favorite / category / tag 路由分发
    models/        # Sequelize ORM 实体 (User / Document / Category / Tag / DocumentTag / Favorite)
    services/      # file.service.ts (文件删除), extraction.service.ts (PDF/DOCX 文字+图片提取)
    seed.ts        # 种子数据（默认分类/用户/标签）
    app.ts         # Express 入口
```
