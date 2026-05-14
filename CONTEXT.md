# CONTEXT.md — Papier 文档分享平台 (Development Spec)

## 1. 项目概述
Papier 是一个前后端分离的团队文档管理平台。核心诉求是实现文档的安全存储、多维度分类筛选、以及后台精细化管理。
**注意：本文档旨在指导 AI 助手进行代码生成，请严格遵循以下技术栈与业务逻辑。**

## 2. 技术栈与核心依赖
- **Frontend**: Vue 3 (Composition API, `<script setup>`), TypeScript, Vite, Tailwind CSS, Vue Router, Pinia (状态管理), Axios.
- **Backend**: Node.js, Express, TypeScript (推荐), MySQL 8.0, Sequelize 或 TypeORM (推荐使用 ORM).
- **存储服务**: 阿里云 OSS (使用 `ali-oss` SDK).
- **鉴权**: JWT (`jsonwebtoken`), 密码加密 (`bcryptjs`).
- **文件上传**: `multer`.

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
  - `file_type`: String (pdf, doc, ppt, sheet)
  - `file_size`: Integer (bytes)
  - `oss_url`: String (阿里云 OSS 访问地址)
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
- 请求拦截器：除了 `/login` 和公开的静态资源，所有 API 请求需在 Header 携带 `Authorization: Bearer <token>`。
- **Admin 权限**：后台 `/admin` 前缀的路由和对应的 API 只有 `role === 'admin'` 的用户可访问。
- **密码管理**：Admin 有权限调用特定接口，强制修改任意 User 的密码（直接覆盖更新 Hash）。

### 4.2 文件上传机制 (限制与 OSS)
- **上传限制**：前端和后端（Multer）均需校验，单次请求最多 **10** 个文件，单个文件最大 **10MB**。
- **OSS 流转**：
  1. 客户端通过 `multipart/form-data` 将文件传给 Node.js 后端。
  2. 后端基于 `multer` 接收到内存中或临时目录，调用阿里云 OSS SDK 上传至 Bucket。
  3. 获取 OSS 返回的 URL 后，结合前端传来的 `title`, `category_id`, `tags` 等信息，写入 `Documents` 表。

### 4.3 后台文档管理 (Admin Document Management)
- **多条件检索**：后端需实现组合查询 API，支持通过 `title` (模糊搜索 LIKE)、`category_id`、`tags` 进行筛选过滤。
- **修改元数据**：Admin 可以更改已有文档的 `title`, `category_id`, 和关联的 `tags`。
- **替换源文件 (覆盖上传)**：
  - 业务逻辑：Admin 针对已有的一条 Document 记录，上传一个新的文件。
  - 后端操作：将新文件上传至 OSS，获取新的 URL；在 `Documents` 表中更新该行的 `oss_url`, `file_size`, `file_type` 字段；（可选：调用 OSS API 删除旧文件以释放空间）。

## 5. API 路由设计草案 (RESTful 规范)

| 方法 | 路径 | 角色 | 描述 |
|---|---|---|---|
| POST | `/api/auth/login` | 公开 | 登录获取 JWT |
| GET | `/api/documents` | User/Admin | 获取文档列表（带搜索/分页） |
| POST | `/api/documents` | User/Admin | 上传新文档 (支持多文件) |
| PUT | `/api/admin/documents/:id` | Admin | 修改文档元数据 (标题/分类/标签) |
| POST | `/api/admin/documents/:id/replace`| Admin | 重新上传文件替换原有 OSS 文件 |
| PUT | `/api/admin/users/:id/password` | Admin | 管理员修改指定用户密码 |

## 6. 项目结构体系

```text
frontend/
  src/
    api/         # Axios 实例及按业务划分的 API 请求函数
    components/  # 公用组件 (Uploader[带大小限制], TagSelector)
    stores/      # Pinia stores (auth.ts, document.ts)
    views/       # 页面
      Home.vue   # 前台文档库首页
      admin/     # 后台管理页面集
        Dashboard.vue
        DocManage.vue # 查询、修改元数据、覆盖上传均在此页
        UserManage.vue
    router/      # 包含路由守卫 (检查 JWT 和 admin 角色)
backend/
  src/
    config/      # DB 连接与 OSS 配置
    middlewares/ # authMiddleware.ts, uploadMiddleware.ts (Multer 配置)
    controllers/ # 业务逻辑处理
    routes/      # 路由分发
    models/      # ORM 实体定义
    services/    # 封装的 OSS 上传、数据库复杂操作方法