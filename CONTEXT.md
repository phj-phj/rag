# Papier — 团队文档管理与 AI 学习平台

![](https://img.shields.io/badge/Vue-3-4fc08d?logo=vue.js) ![](https://img.shields.io/badge/Node-20-339933?logo=node.js) ![](https://img.shields.io/badge/MySQL-8.0-4479a1?logo=mysql) ![](https://img.shields.io/badge/Docker-ready-2496ed?logo=docker)

Papier 是一个前后端分离的文档管理平台，核心在**文档上传 → 自动解析 → AI 生成题目 → 每日练习**这条链路。把团队资料变成可检索、可测验的知识库。

---

## 核心功能

### 文档管理
- 支持 PDF / Word / TXT / 图片上传，单次最多 10 个文件
- 自动提取文件内容（`unpdf` 解析 PDF、`jszip` 解析 DOCX）
- 多维度筛选：标题模糊搜索、分类、标签、上传者
- 收藏系统、后台管理（文档 CRUD、用户管理、统计仪表盘）

### AI 检索问答（RAG）
- 文档上传后自动语义切块、向量化（embedding-2 1024维）、索引入 LanceDB
- 双路检索：向量相似度 + BM25 全文索引 → RRF 融合 → Rerank 精排 → MMR 去重
- **Text2SQL**：自然语言查 MySQL 元数据（"admin 上传了多少文档"）
- 流式输出（SSE），支持深度思考模式

### 题目提取与训练
- 文档自动分类（题库文档 vs 知识文档）
- 题库文档：LLM 提取题目 + 答案
- 知识文档：LLM 根据内容预生成论述题
- AI 训练页面：从题库抽题练习，已掌握的题目自动排除
- 已收录页面：选题、筛选（全部/已掌握/需复习）、难度投票（众数算法）

### 安全
- JWT httpOnly Cookie 鉴权，防 XSS 令牌窃取
- RBAC 角色控制（user / admin）
- AI 助手、训练、题库页面均需登录

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 (Composition API) · TypeScript · Vite · Pinia · Vue Router · Tailwind CSS · Three.js · ECharts |
| 后端 | Node.js · Express · TypeScript · Sequelize ORM · Zod |
| 数据库 | MySQL 8.0（结构化数据）· LanceDB（向量检索） |
| AI | DeepSeek（LLM）· 智谱 embedding-2（向量化）· SiliconFlow（Rerank） |
| 部署 | Docker Compose · Nginx · pm2 |

---

## 快速开始

### Docker（推荐）

```bash
git clone https://github.com/phj-phj/AI-web.git
cd AI-web
cp backend/.env.example backend/.env   # 编辑填入 API Key
docker compose up -d
```

浏览器打开 `http://localhost`。

默认账号：`13691620597` / `qweasdzxc05811`（管理员），`user` / `user123`（普通用户）。

### 手动安装

详见 [SETUP.md](SETUP.md)。

---

## 架构

```
用户浏览器
    │
    ▼
┌─────────────┐     ┌──────────────────────────────────────┐
│   Nginx     │────▶│  Express API Server (Node.js)          │
│  前端静态文件 │     │                                      │
└─────────────┘     │  POST /api/documents → 文件上传         │
                    │  → extractText (PDF/DOCX/TXT)          │
                    │  → splitIntoChunks (语义/段落)           │
                    │  → embedTexts (embedding-2)             │
                    │  → indexChunks (LanceDB 向量库)          │
                    │  → classifyDocument (题库/知识)          │
                    │  → extract/generate Questions           │
                    │                                        │
                    │  POST /api/chat/ask → RAG 问答          │
                    │  → rewriteQuery → retrieve (双路+RRF)    │
                    │  → rerank → MMR → LLM 生成              │
                    │                                        │
                    │  POST /api/training/generate → 出题      │
                    │  → 题库查询 + AI 即时生成                 │
                    │                                        │
                    │  MySQL ←───→ LanceDB                    │
                    │  (结构数据)   (向量检索)                   │
                    └──────────────────────────────────────┘
```

---

## 项目结构

```
AI-web/
├── frontend/                 # Vue 3 前端
│   └── src/
│       ├── api/              # Axios + fetch 封装
│       ├── components/       # 组件（UploadDialog、DocumentReader、QuestionCard 等）
│       ├── router/           # 路由 + beforeEach 鉴权守卫
│       ├── stores/           # Pinia (auth、document、admin)
│       ├── types/            # TypeScript 类型
│       └── views/            # 页面（文库、文档阅读、AI 助手、训练、已收录、后台）
├── backend/                  # Node.js 后端
│   └── src/
│       ├── config/           # 数据库连接、环境变量、Swagger
│       ├── controllers/      # 控制器 (auth、document、admin、chat、training)
│       ├── middlewares/      # 鉴权、上传、错误处理、请求 ID
│       ├── models/           # Sequelize ORM (User、Document、Question、PracticeRecord 等)
│       ├── routes/           # 路由
│       ├── services/         # AI 服务 (chat、chunking、retrieval、rerank、rewrite、text2sql、
│       │                     #            extraction、question-extraction、question-generation)
│       ├── utils/            # 日志 (Winston)、错误类 (AppError)、AI Debug
│       └── validators/       # Zod 参数校验
├── docs/                     # API 文档、架构文档
├── deploy/                   # 生产部署 (pm2 + Nginx)
├── docker-compose.yml
└── SETUP.md                  # 详细安装指南
```

---

## API 文档

启动后端后访问 `http://localhost:3000/api-docs` 查看 Swagger 文档，覆盖全部 39 个接口。

或查看 Markdown 版：[docs/API文档.md](docs/API文档.md)。

---

## 环境变量

| 变量 | 用途 | 必填 |
|---|---|---|
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL 连接 | 是 |
| `JWT_SECRET` | JWT 签名密钥 | 是 |
| `MIMO_API_KEY` / `MIMO_BASE_URL` / `MIMO_MODEL` | LLM 对话/出题/提取 (OpenAI 兼容) | 推荐 |
| `EMBED_API_KEY` / `EMBED_BASE_URL` / `EMBED_MODEL` | 文本向量化 | 推荐 |
| `RERANK_API_KEY` / `RERANK_BASE_URL` / `RERANK_MODEL` | 检索精排（不可用时自动降级） | 可选 |
| `DEBUG_AI` | 开启 AI 调试日志 | 可选 |
| `PORT` | 后端端口（默认 3000） | 可选 |

---

## License

MIT
