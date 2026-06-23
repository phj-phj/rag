# Papier 使用指南

团队文档管理与 AI 学习平台，基于 Vue 3 + Node.js + MySQL + LanceDB 架构。

---

## 快速开始（Docker）

### 前提

安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。

国内用户建议在 Docker Desktop → Settings → Docker Engine 中添加镜像加速：

```json
{
  "registry-mirrors": [
    "https://registry.cn-hangzhou.aliyuncs.com",
    "https://docker.m.daocloud.io"
  ]
}
```

### 三步启动

```bash
# 1. 进入项目
cd AI-web

# 2. 配置 API Key
copy backend\.env.example backend\.env
# 编辑 backend\.env，至少填入：
#   - JWT_SECRET（随便打一串随机字符）
#   - EMBED_API_KEY（向量化用，免费注册）
#   - MIMO_API_KEY（AI 对话/出题用，DeepSeek 充值 10 元够用数月）

# 3. 启动
docker compose up -d
```

浏览器打开 `http://localhost`，用 `.env` 中配置的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录（默认 `admin` / `change_me_admin`，**首次使用务必修改**）。

> **安全提示**：`docker-compose.yml` 中的 MySQL 密码也是默认值，部署到公网前请一并修改。

### 常用命令

| 命令 | 作用 |
|------|------|
| `docker compose up -d` | 启动（有缓存） |
| `docker compose up -d --build` | 启动 + 重建镜像 |
| `docker compose down` | 停止 |
| `docker compose logs -f` | 查看实时日志 |
| `docker compose logs backend --tail 50` | 查看后端最近日志 |

### 数据持久化

数据存储在 Docker 命名卷中：`mysql_data`（数据库）、`uploads_data`（上传文件）、`lancedb_data`（向量索引）。`docker compose down` 不会丢失数据，只有 `docker compose down -v` 会清空。

---

## 手动安装（开发）

### 环境要求

| 组件 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥20 | 运行时 |
| MySQL | 8.0 | 数据库 |

### 1. 安装 Node.js

去 [nodejs.org](https://nodejs.org/) 下载 LTS 版本（v20 或更高）。

```powershell
node --version   # 确认 ≥ v20
npm --version
```

### 2. 安装 MySQL 8.0

**Windows 便携版（推荐）**

下载 [MySQL 8.0 ZIP](https://dev.mysql.com/downloads/mysql/8.0.html)，解压到 `C:\mysql\mysql-8.0.36-winx64\`，创建 `my.ini`：

```ini
[mysqld]
basedir=C:/mysql/mysql-8.0.36-winx64
datadir=C:/mysql/mysql-8.0.36-winx64/data
port=3306
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci

[client]
port=3306
default-character-set=utf8mb4
```

初始化并启动：

```powershell
C:\mysql\mysql-8.0.36-winx64\bin\mysqld --initialize-insecure
C:\mysql\mysql-8.0.36-winx64\bin\mysqld --console   # 保持窗口打开
```

另开终端，创建数据库和用户：

```sql
mysql -u root --host=127.0.0.1

CREATE DATABASE papier CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'your_user'@'localhost' IDENTIFIED BY '你的密码';
CREATE USER 'your_user'@'127.0.0.1' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON papier.* TO 'your_user'@'localhost';
GRANT ALL PRIVILEGES ON papier.* TO 'your_user'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

### 3. 配置环境变量

```powershell
cd backend
copy .env.example .env
```

编辑 `.env`，必填项：

```ini
# 数据库
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=你的密码
DB_NAME=papier

# JWT（必填，随便打一串随机字符）
JWT_SECRET=你的随机密钥

# 默认账号（仅首次 seed 生效，之后修改无效）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=改成你自己的密码
USER_USERNAME=user
USER_PASSWORD=改成你自己的密码

# AI 配置（不填则 AI 功能不可用）
MIMO_API_KEY=你的 DeepSeek API Key
EMBED_API_KEY=你的智谱 API Key

# Rerank 配置（可选，不可用时自动降级为纯向量检索）
RERANK_API_KEY=你的 SiliconFlow API Key
```

完整变量说明见下方 [AI 配置](#ai-配置) 章节。

### 4. 安装依赖

```powershell
cd backend
npm install

cd ../frontend
npm install
```

如果下载慢，配淘宝镜像：

```powershell
npm config set registry https://registry.npmmirror.com
```

### 5. 初始化数据库

确保 MySQL 已启动，然后：

```powershell
cd backend
npm run seed
```

输出：

```
数据库表已重新创建
默认分类已创建
默认用户已创建
默认标签已创建
种子数据初始化完成
```

### 6. 启动

需要两个终端：

```powershell
# 终端 1 — 后端 (端口 3000)
cd backend
npm run dev

# 终端 2 — 前端 (端口 5173)
cd frontend
npm run dev
```

验证：

```powershell
curl http://localhost:3000/    # → {"message":"Papier API 服务运行中"}
```

浏览器访问 `http://localhost:5173`。

### 7. 构建生产版本

```powershell
cd backend && npm run build     # 编译 TypeScript
cd frontend && npm run build    # 打包前端
```

---

## 默认账号

`npm run seed` 时根据 `.env` 中的配置创建两个账号：

| 角色 | 用户名 | 密码 | 来源变量 |
|------|--------|------|----------|
| 管理员 | `admin` | `change_me_admin` | `ADMIN_USERNAME` / `ADMIN_PASSWORD` |
| 普通用户 | `user` | `change_me_user` | `USER_USERNAME` / `USER_PASSWORD` |

**首次部署务必修改 `.env` 中的这些默认值**。seed 只在数据库为空时执行一次，之后修改 `.env` 不会更新已有账号密码。

---

## AI 配置

项目使用三个 AI 服务（均为 OpenAI 兼容 API）：

| 配置变量 | 用途 | 推荐服务 | 获取方式 |
|----------|------|----------|----------|
| `MIMO_API_KEY` + `MIMO_BASE_URL` + `MIMO_MODEL` | AI 对话、出题、摘要 | DeepSeek | [platform.deepseek.com](https://platform.deepseek.com) |
| `EMBED_API_KEY` + `EMBED_BASE_URL` + `EMBED_MODEL` | 文本向量化 | 智谱 embedding-2 | [open.bigmodel.cn](https://open.bigmodel.cn) |
| `RERANK_API_KEY` + `RERANK_BASE_URL` + `RERANK_MODEL` | 检索结果重排序（可选） | SiliconFlow | [siliconflow.cn](https://siliconflow.cn) |

- DeepSeek 充值 10 元够用数月
- 智谱 embedding-2 免费
- Rerank 可选，API 不可用时系统自动降级为纯向量检索

完整 `.env` 变量一览：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 后端端口 |
| `CORS_ORIGIN` | `http://localhost:5173` | 允许的前端地址 |
| `DB_HOST` | `localhost` | MySQL 地址 |
| `DB_PORT` | `3306` | MySQL 端口 |
| `DB_USER` | — | MySQL 用户名 |
| `DB_PASSWORD` | — | MySQL 密码 |
| `DB_NAME` | `papier` | 数据库名 |
| `JWT_SECRET` | — | **必填**，JWT 签名密钥 |
| `JWT_EXPIRES_IN` | `7d` | Token 有效期 |
| `ADMIN_USERNAME` | `admin` | seed 管理员用户名 |
| `ADMIN_PASSWORD` | `change_me_admin` | seed 管理员密码 |
| `USER_USERNAME` | `user` | seed 普通用户名 |
| `USER_PASSWORD` | `change_me_user` | seed 普通用户密码 |
| `MIMO_BASE_URL` | `https://api.deepseek.com/v1` | LLM API 地址 |
| `MIMO_API_KEY` | — | LLM API Key |
| `MIMO_MODEL` | `deepseek-chat` | LLM 模型名 |
| `EMBED_BASE_URL` | `https://open.bigmodel.cn/api/paas/v4` | Embedding API 地址 |
| `EMBED_API_KEY` | — | Embedding API Key |
| `EMBED_MODEL` | `embedding-2` | Embedding 模型名 |
| `RERANK_BASE_URL` | `https://api.siliconflow.cn/v1` | Rerank API 地址 |
| `RERANK_API_KEY` | — | Rerank API Key |
| `RERANK_MODEL` | `Qwen/Qwen3-Reranker-0.6B` | Rerank 模型名 |
| `DEBUG_AI` | `false` | AI 调试日志开关 |

---

## 功能页面

| 路由 | 说明 | 需要登录 |
|------|------|----------|
| `/` | 文档库首页（浏览、搜索、上传） | 否 |
| `/login` | 登录 | 否 |
| `/register` | 注册 | 否 |
| `/docs/:id` | 文档阅读器（PDF/Word/TXT/图片） | 否 |
| `/chat` | AI 助手（基于文档问答） | 否 |
| `/recent` | 我上传的文档 | 是 |
| `/training` | 每日训练（AI 出题练习） | 否 |
| `/collected` | 已收录题库 | 否 |
| `/admin` | 后台数据概览 | 管理员 |
| `/admin/docs` | 文档管理 | 管理员 |
| `/admin/questions` | 题库管理 | 管理员 |
| `/admin/users` | 用户管理 | 管理员 |

---

## 后端脚本速查

```bash
npm run dev              # 开发模式（nodemon 热重载）
npm run build            # 编译 TypeScript → dist/
npm start                # 生产模式启动
npm run seed             # 初始化数据库（清空并重建表 + 默认数据）
npm run migrate          # 执行数据库迁移（增量升级）
npm run reindex          # 重建 LanceDB 向量索引
npm run rebuild          # 重建全部数据
npm run reprocess        # 重新处理所有文档
npm test                 # 运行全部测试（vitest）
npm run test:watch       # 测试监视模式
npm run eval:retrieval   # 运行检索质量评估
npm run eval:generation  # 运行生成质量评估
```

---

## 目录结构

```
AI-web/
├── frontend/              # Vue 3 前端（Vite 5）
│   ├── src/
│   │   ├── api/           # Axios 请求封装
│   │   ├── components/    # 公共组件
│   │   ├── router/        # 路由配置
│   │   ├── stores/        # Pinia 状态管理
│   │   ├── types/         # TypeScript 类型
│   │   └── views/         # 页面组件
│   ├── Dockerfile
│   └── nginx-docker.conf
├── backend/               # Node.js 后端（Express 5）
│   ├── src/
│   │   ├── config/        # 数据库、环境变量、Swagger 配置
│   │   ├── controllers/   # 业务逻辑
│   │   ├── middlewares/   # 中间件（认证、上传、限流等）
│   │   ├── models/        # Sequelize ORM 模型
│   │   ├── routes/        # 路由（auth、document、chat、training、admin 等）
│   │   ├── services/      # AI 调用、文本提取、分块、向量检索
│   │   ├── utils/         # 日志、错误处理
│   │   └── validators/    # Zod 参数校验
│   ├── check-db.js        # Docker 首次启动检测
│   ├── Dockerfile
│   └── vitest.config.ts
├── deploy/                # 生产部署
│   ├── DEPLOY.md          # 部署指南
│   ├── ecosystem.config.js # PM2 配置
│   ├── nginx.conf         # Nginx 配置
│   └── setup.sh           # 一键部署脚本
├── docs/                  # 项目文档（API 文档、RAG 评估方案等）
├── docker-compose.yml
└── .dockerignore
```

---

## 常见问题

### Docker 版 PDF 无法显示

Mac/Windows 的 Docker Desktop 已处理 `.mjs` MIME 类型问题。如仍有问题，检查浏览器控制台 `[PDF]` 日志。

### 启动报 "Access denied for user"

检查 `.env` 的 `DB_USER` 和 `DB_PASSWORD` 是否正确，确认 MySQL 用户存在：

```sql
SELECT User, Host FROM mysql.user WHERE User='your_user';
```

### 前端构建卡住（Vite rendering chunks）

2G 内存机器可能不够，添加 swap：

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
```

### AI 接口返回 429

智谱免费版限 1 个请求/秒，代码内置自动重试。如频繁遇到，建议切换 DeepSeek。

### LanceDB 报 MODULE_NOT_FOUND

Docker 使用 `node:20-slim` 避免 musl 兼容问题。手动安装需确保系统为 glibc 环境（Windows/macOS/Linux 均可，Alpine 需额外处理）。

### pdfjs-dist 警告

控制台提示 Node 版本不够，v20 能正常运行，可以忽略。
