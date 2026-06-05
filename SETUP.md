# Papier 使用指南

团队文档管理与分享平台，基于 Vue 3 + Node.js + MySQL + LanceDB 架构。

---

## 快速开始（Docker）

### 前提

安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。

国内用户需要在 Docker Desktop → Settings → Docker Engine 中添加镜像加速：

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

# 2. 配置 API Key（重要）
copy backend\.env.example backend\.env
# 编辑 backend\.env，至少填入 EMBED_API_KEY（向量化用）

# 3. 启动
docker compose up -d
```

浏览器打开 `http://localhost`，用 `admin / admin123` 登录。

### 常用命令

| 命令 | 作用 |
|------|------|
| `docker compose up -d` | 启动（有缓存） |
| `docker compose up -d --build` | 启动 + 重建镜像 |
| `docker compose down` | 停止 |
| `docker compose logs -f` | 查看实时日志 |
| `docker compose logs backend --tail 50` | 查看后端最近日志 |

### 数据持久化

Docker 卷自动保存数据，`docker compose down` 不会丢失。只有 `docker compose down -v` 会清空所有数据。

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
CREATE USER 'phj'@'localhost' IDENTIFIED BY '你的密码';
CREATE USER 'phj'@'127.0.0.1' IDENTIFIED BY '你的密码';
GRANT ALL PRIVILEGES ON papier.* TO 'phj'@'localhost';
GRANT ALL PRIVILEGES ON papier.* TO 'phj'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

### 3. 配置环境变量

```powershell
cd backend
copy .env.example .env
```

编辑 `.env`，修改以下配置：

```ini
# 必填
DB_HOST=localhost
DB_PASSWORD=你的MySQL密码
JWT_SECRET=随便打一串随机字符

# AI 配置（可选，不填则 AI 功能不可用）
MIMO_API_KEY=你的DeepSeek或兼容OpenAI的API Key
EMBED_API_KEY=你的智谱API Key（向量化用）
```

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
默认用户已创建 (admin/admin123, user/user123)
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

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | `admin` | `admin123` |
| 普通用户 | `user` | `user123` |

---

## AI 配置

项目使用了两个 AI 服务：

| 配置变量 | 用途 | 推荐服务 | 获取方式 |
|----------|------|----------|----------|
| `MIMO_API_KEY` + `MIMO_BASE_URL` + `MIMO_MODEL` | AI 对话、出题、提取、改写 | DeepSeek | [platform.deepseek.com](https://platform.deepseek.com) |
| `EMBED_API_KEY` + `EMBED_BASE_URL` + `EMBED_MODEL` | 文本向量化 | 智谱 | [open.bigmodel.cn](https://open.bigmodel.cn) |

DeepSeek 充值 10 元够用数月。智谱 embedding-2 免费。

两个服务都是 OpenAI 兼容 API，可以用其他兼容服务替换。

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

## 完整 API 文档

详见 [docs/API文档.md](docs/API文档.md)，覆盖全部 36 个接口的请求参数和响应格式。

---

## 目录结构

```
AI-web/
├── frontend/              # Vue 3 前端（Vite）
│   ├── src/
│   │   ├── api/           # Axios 请求封装
│   │   ├── components/    # 公共组件
│   │   ├── router/        # 路由配置
│   │   ├── stores/        # Pinia 状态管理
│   │   ├── types/         # TypeScript 类型
│   │   └── views/         # 页面组件
│   ├── Dockerfile
│   └── nginx-docker.conf
├── backend/               # Node.js 后端（Express）
│   ├── src/
│   │   ├── config/        # 数据库 & 环境配置
│   │   ├── controllers/   # 业务逻辑
│   │   ├── middlewares/   # 中间件
│   │   ├── models/        # ORM 模型
│   │   ├── routes/        # 路由
│   │   ├── services/      # AI/提取/分块/检索服务
│   │   ├── utils/         # 工具（日志、错误类）
│   │   └── validators/    # Zod 参数校验
│   ├── Dockerfile
│   └── check-db.js        # Docker 数据库初始化检查
├── deploy/                # 生产部署配置（pm2 + Nginx）
├── docs/                  # 项目文档
├── docker-compose.yml     # Docker 编排
└── .dockerignore
```

---

## 常见问题

### Docker 版 PDF 无法显示

Mac/Windows 的 Docker Desktop 已处理 `.mjs` MIME 类型问题。如仍有问题，检查浏览器控制台 `[PDF]` 日志。

### 启动报 "Access denied for user"

检查 `.env` 的 `DB_PASSWORD` 是否正确，确认 MySQL 用户存在：

```sql
SELECT User, Host FROM mysql.user WHERE User='phj';
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

Docker 使用 `node:20-slim` 避免 musl 兼容问题。手动安装需确保系统 glibc 环境。

### pdfjs-dist 警告

控制台提示 Node 版本不够，v20 能正常运行，可以忽略。
