# Papier API 文档

所有接口前缀 `/api`，服务端口 3000。

---

## 1. 认证

### POST /api/auth/login
- **鉴权**：无
- **限流**：5次/分钟
- **请求体**：`{ "username": "string (3-50)", "password": "string (6-128)" }`
- **响应 200**：`{ "token": "string (JWT)", "user": { "id": 1, "username": "admin", "role": "admin" } }`
- **响应 401**：`{ "message": "用户名或密码错误" }`

### POST /api/auth/register
- **鉴权**：无
- **限流**：3次/分钟
- **请求体**：`{ "username": "string (3-50)", "password": "string (6-128)" }`
- **响应 201**：`{ "message": "注册成功", "token": "string", "user": { "id": 2, "username": "user1", "role": "user" } }`
- **响应 409**：`{ "message": "用户名已被注册" }`

---

## 2. 文档

### GET /api/documents
- **鉴权**：无
- **查询参数**：`page`(默认1), `pageSize`(默认20), `title`, `category_id`, `tags`(逗号分隔), `is_featured`, `uploader_id`
- **响应 200**：
```json
{
  "items": [{
    "id": 1, "title": "文档名", "file_type": "pdf", "file_size": 12345,
    "file_path": "uploads/xxx.pdf", "file_url": "/uploads/xxx.pdf",
    "category_id": 1, "uploader_id": 1, "is_featured": false,
    "created_at": "2026-06-05T01:00:00.000Z", "updated_at": "...",
    "uploader": { "id": 1, "username": "admin" },
    "category": { "id": 1, "name": "技术文档" },
    "tags": [{ "id": 1, "name": "前端" }]
  }],
  "total": 42, "page": 1, "pageSize": 20
}
```

### GET /api/documents/:id
- **鉴权**：无
- **响应 200**：单个文档对象（同上）
- **响应 404**：`{ "message": "文档不存在" }`

### GET /api/documents/:id/content
- **鉴权**：无
- **响应 200**：
```json
{
  "text": "提取的纯文本内容...",
  "html": "<p>HTML渲染（PDF/DOCX）</p>",
  "file_type": "pdf",
  "images": ["data:image/png;base64,..."]
}
```
- **响应 400**：`{ "message": "不支持的文件类型" }`

### GET /api/documents/:id/chunks
- **鉴权**：无
- **响应 200**：
```json
{
  "document": { "id": 1, "title": "文档名" },
  "totalChunks": 42,
  "chunks": [{
    "index": 0, "content": "完整chunk文本...",
    "preview": "前100字预览...", "tokenCount": 88,
    "heading": "章节标题", "position": "0-500", "strategy": "semantic"
  }]
}
```

### POST /api/documents
- **鉴权**：需要登录
- **Content-Type**：`multipart/form-data`
- **请求体**：`files`(File[], 必填), `title`(选填), `category_id`(选填), `tags`(选填, JSON数组字符串)
- **响应 201**：创建的文档对象数组
- **副作用**：异步触发文档切块→向量化→题目分类→提取/预生成

### DELETE /api/documents/:id
- **鉴权**：需要登录（仅上传者或管理员）
- **响应 200**：`{ "message": "文档已删除" }`
- **响应 403**：`{ "message": "无权删除此文档" }`

---

## 3. 收藏

所有收藏接口需要登录。

### GET /api/favorites
- **查询参数**：`page`(默认1), `pageSize`(默认20)
- **响应 200**：`{ "items": [...], "total": 5, "page": 1, "pageSize": 20 }`

### POST /api/favorites
- **请求体**：`{ "document_id": 1 }`
- **响应 200**：`{ "message": "已收藏", "favorited": true }`

### POST /api/favorites/toggle/:documentId
- **响应 200**：`{ "favorited": true }` 或 `{ "favorited": false }`

### DELETE /api/favorites/:documentId
- **响应 200**：`{ "message": "已取消收藏", "favorited": false }`

---

## 4. AI 助手

### POST /api/chat/ask
- **鉴权**：无
- **请求体**：`{ "question": "string (1-5000)", "documentId?": 1, "thinking?": true }`
- **响应 200**：
```json
{
  "answer": "AI 生成的回答...",
  "model": "deepseek-chat",
  "docs": [{ "id": 1, "title": "相关文档" }]
}
```
- 无结果时：`{ "answer": "当前文档库中未找到相关信息...", "model": "retrieval", "docs": [] }`

### POST /api/chat/ask/stream
- **鉴权**：无
- **请求体**：同上
- **响应**：SSE 流式（`text/event-stream`）
- **事件类型**：
  - `data: {"type":"docs","docs":[...]}`
  - `data: {"type":"token","content":"..."}`（逐 token）
  - `data: [DONE]`
  - `data: {"type":"error","message":"..."}`

### POST /api/chat/train
- **鉴权**：无
- **请求体**：`{ "question": "string (1-2000, 出题主题)" }`
- **响应 200**：
```json
{
  "questions": [{ "q": "题目", "a": "答案" }],
  "docs": [{ "id": 1, "title": "来源文档" }]
}
```
- 无内容时：`{ "questions": [], "docs": [], "message": "当前文档库中没有相关内容" }`

### POST /api/chat/train/stream
- **鉴权**：无
- **请求体**：同上
- **响应**：SSE 流式
- **事件类型**：
  - `data: {"type":"docs","docs":[...]}`
  - `data: {"type":"diagnostics","phase":"retrieval","retrievalMs":42,...}`
  - `data: {"type":"question","question":{"q":"...","a":"..."},"index":0}`
  - `data: {"type":"done","total":5}`
  - `data: {"type":"error","message":"..."}`

---

## 5. 每日训练

### GET /api/training/questions
- **鉴权**：无
- **查询参数**：`page`(默认1), `pageSize`(默认20), `keyword`, `source_type`(`extracted`/`ai_pregenerated`/`all`), `difficulty`(`1`-`5`/`all`)
- **响应 200**：
```json
{
  "items": [{
    "id": 1, "stem": "题目", "explanation": "答案",
    "type": "essay", "source_type": "extracted",
    "knowledge_point": "React", "difficulty": 3,
    "created_at": "2026-06-05T01:00:00.000Z"
  }],
  "total": 252, "page": 1, "pageSize": 20
}
```

### GET /api/training/questions/stats
- **鉴权**：无
- **响应 200**：
```json
{
  "total": 252,
  "extracted": 48,
  "pregenerated": 204,
  "knowledgePoints": 67
}
```

### POST /api/training/generate
- **鉴权**：无
- **请求体**：`{ "topic?": "React", "count?": 10, "difficulty?": 3 }`
- **响应 200**：
```json
{
  "questions": [{ "id": 1, "stem": "...", "explanation": "...", ... }],
  "source": "bank | mixed | generated"
}
```
- `bank`：全部来自题库
- `mixed`：题库+AI 混合
- `generated`：全部 AI 即时生成

### POST /api/training/generate/stream
- **鉴权**：无
- **请求体**：同上
- **响应**：SSE 流式
- **事件**：`data: {"type":"bank","questions":[...]}`, `data: {"type":"question","question":{...}}`, `data: {"type":"done","total":10}`

### POST /api/training/record
- **鉴权**：需要登录
- **请求体**：`{ "questionId": 1, "status": "mastered | review" }`
- **响应 200**：`{ "message": "已记录" }`

### POST /api/training/difficulty
- **鉴权**：需要登录
- **请求体**：`{ "questionId": 1, "level": 3 }`（1-5整数）
- **响应 200**：`{ "difficulty": 3.5, "votes": 12, "locked": false }`

### GET /api/training/review
- **鉴权**：需要登录
- **查询参数**：`page`(默认1), `pageSize`(默认20)
- **响应 200**：
```json
{
  "items": [{
    "id": 1, "user_id": 1, "question_id": 42,
    "status": "review", "created_at": "...",
    "question": { "id": 42, "stem": "...", "explanation": "...", "knowledge_point": "React", "difficulty": 3 }
  }],
  "total": 5, "page": 1, "pageSize": 20
}
```

---

## 6. 管理员

所有管理员接口需要登录 + admin 角色，`/api/admin/stats` 除外。

### GET /api/admin/stats
- **鉴权**：无
- **响应 200**：
```json
{
  "totalDocs": 42, "totalCategories": 5, "totalUsers": 8,
  "categoryStats": [{ "category_id": 1, "category_name": "技术文档", "count": 15 }],
  "uploadTrend": [{ "date": "2026-06-01", "count": 3 }],
  "recentActivities": [{
    "id": 42, "title": "文档名", "file_type": "pdf",
    "uploader": "admin", "created_at": "2026-06-05T01:00:00.000Z"
  }]
}
```

### GET /api/admin/documents
- **查询参数**：`page`, `pageSize`, `title`, `category_id`, `tags`
- **响应 200**：`{ "items": [...], "total": 42, "page": 1, "pageSize": 20 }`

### PUT /api/admin/documents/:id
- **请求体**：`{ "title?": "...", "category_id?": 1, "tags?": [1,2] }`
- **响应 200**：更新后的文档对象

### POST /api/admin/documents/:id/replace
- **Content-Type**：`multipart/form-data`
- **请求体**：单个文件
- **响应 200**：更新后的文档对象

### DELETE /api/admin/documents/:id
- **响应 200**：`{ "message": "文档已删除" }`

### GET /api/admin/users
- **查询参数**：`page`, `pageSize`
- **响应 200**：
```json
{
  "items": [{ "id": 1, "username": "admin", "role": "admin", "document_count": 15, "created_at": "..." }],
  "total": 8, "page": 1, "pageSize": 20
}
```

### PUT /api/admin/users/:id/password
- **请求体**：`{ "password": "string (6-128)" }`
- **响应 200**：`{ "message": "密码已更新" }`

### GET /api/admin/questions
- **查询参数**：`page`, `pageSize`, `keyword`, `source_type`
- **响应 200**：`{ "items": [...], "total": 252, "page": 1, "pageSize": 20 }`

### DELETE /api/admin/questions/:id
- **响应 200**：`{ "message": "题目已删除" }`

### POST /api/admin/questions/batch-delete
- **请求体**：`{ "ids": [1, 2, 3] }`
- **响应 200**：`{ "message": "已删除 3 道题目", "count": 3 }`

---

## 7. 分类与标签

### GET /api/categories
- **鉴权**：无
- **响应 200**：
```json
[{ "id": 1, "name": "技术文档", "docCount": 15, "created_at": "..." }]
```

### GET /api/tags
- **鉴权**：无
- **响应 200**：
```json
[{ "id": 1, "name": "前端", "created_at": "..." }]
```

---

## 验证错误格式

Zod 校验失败时返回 400：
```json
{
  "message": "参数校验失败",
  "errors": [{ "field": "username", "message": "用户名至少3个字符" }]
}
```

## 鉴权方式

需登录的接口在 Header 中携带：
```
Authorization: Bearer <JWT_TOKEN>
```

JWT 负载 `{ id, username, role }`，过期时间由 `JWT_EXPIRES_IN` 环境变量控制（默认 7 天）。
