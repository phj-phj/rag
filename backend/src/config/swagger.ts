import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Papier API',
      version: '1.0.0',
      description: '团队文档管理与 AI 学习平台',
    },
    servers: [{ url: 'http://localhost:3000' }],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            role: { type: 'string', enum: ['user', 'admin'] },
          },
        },
        Document: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string' },
            file_type: { type: 'string' },
            file_size: { type: 'integer' },
            file_url: { type: 'string' },
            uploader_id: { type: 'integer' },
            category_id: { type: 'integer', nullable: true },
            is_featured: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
            uploader: { $ref: '#/components/schemas/User' },
            category: { $ref: '#/components/schemas/Category' },
            tags: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
          },
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            docCount: { type: 'integer' },
          },
        },
        Tag: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
          },
        },
        Question: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            stem: { type: 'string' },
            explanation: { type: 'string' },
            type: { type: 'string' },
            difficulty: { type: 'integer', nullable: true },
            knowledge_point: { type: 'string' },
            source_type: { type: 'string', enum: ['extracted', 'ai_pregenerated', 'ai_adhoc'] },
            source_document_id: { type: 'integer', nullable: true },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            items: { type: 'array', items: {} },
            total: { type: 'integer' },
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
          },
        },
      },
    },
  },
  apis: [],
}

const spec = swaggerJsdoc(options)

// Manually add paths for full control (swagger-jsdoc JSDoc approach
// doesn't work well with TypeScript decorator-free Express)

spec.paths = {
  '/': {
    get: { tags: ['General'], summary: '根路径', responses: { '200': { description: 'OK' } } },
  },
  '/health': {
    get: { tags: ['General'], summary: '健康检查', responses: { '200': { description: '{ status, mysql, uptime }' }, '503': { description: '数据库断开' } } },
  },

  // ── Auth ──
  '/api/auth/login': {
    post: {
      tags: ['Auth'],
      summary: '登录',
      requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['username', 'password'], properties: { username: { type: 'string' }, password: { type: 'string' } } } } } },
      responses: { '200': { description: '返回 user，设置 httpOnly cookie' }, '401': { description: '用户名或密码错误' } },
    },
  },
  '/api/auth/register': {
    post: {
      tags: ['Auth'],
      summary: '注册',
      requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['username', 'password'], properties: { username: { type: 'string', minLength: 3, maxLength: 50 }, password: { type: 'string', minLength: 6, maxLength: 128 } } } } } },
      responses: { '201': { description: '注册成功，设置 httpOnly cookie' }, '409': { description: '用户名已被注册' } },
    },
  },
  '/api/auth/me': {
    get: {
      tags: ['Auth'],
      summary: '当前用户',
      security: [{ cookieAuth: [] }],
      responses: { '200': { description: '{ user }' }, '401': { description: '未登录' } },
    },
  },
  '/api/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: '登出',
      responses: { '200': { description: '已登出，cookie 清除' } },
    },
  },

  // ── Documents ──
  '/api/documents': {
    get: {
      tags: ['Documents'],
      summary: '文档列表',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'title', in: 'query', schema: { type: 'string' }, description: '模糊搜索' },
        { name: 'category_id', in: 'query', schema: { type: 'integer' } },
        { name: 'tags', in: 'query', schema: { type: 'string' }, description: '逗号分隔的标签ID' },
        { name: 'is_featured', in: 'query', schema: { type: 'string', enum: ['0', '1', 'true', 'false'] } },
        { name: 'uploader_id', in: 'query', schema: { type: 'integer' } },
      ],
      responses: { '200': { description: '分页文档列表' } },
    },
    post: {
      tags: ['Documents'],
      summary: '上传文档（支持多文件）',
      security: [{ cookieAuth: [] }],
      requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { files: { type: 'array', items: { type: 'string', format: 'binary' } }, title: { type: 'string' }, category_id: { type: 'integer' }, tags: { type: 'string', description: 'JSON 数组字符串' } } } } } },
      responses: { '201': { description: '创建的文档数组' }, '401': { description: '未登录' } },
    },
  },
  '/api/documents/{id}': {
    get: {
      tags: ['Documents'],
      summary: '文档详情',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { '200': { description: 'Document 对象' }, '404': { description: '文档不存在' } },
    },
    delete: {
      tags: ['Documents'],
      summary: '删除文档（上传者或管理员）',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { '200': { description: '文档已删除' }, '401': { description: '未登录' }, '403': { description: '无权删除' }, '404': { description: '文档不存在' } },
    },
  },
  '/api/documents/{id}/content': {
    get: {
      tags: ['Documents'],
      summary: '文档解析内容（文字+HTML+内嵌图片）',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { '200': { description: '{ text, html, file_type, images }' } },
    },
  },
  '/api/documents/{id}/chunks': {
    get: {
      tags: ['Documents'],
      summary: '文档切块结果（调试用）',
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { '200': { description: '{ document, totalChunks, chunks[] }' } },
    },
  },

  // ── Favorites ──
  '/api/favorites': {
    get: {
      tags: ['Favorites'],
      summary: '收藏列表',
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: { '200': { description: '分页文档列表' } },
    },
    post: {
      tags: ['Favorites'],
      summary: '添加收藏',
      security: [{ cookieAuth: [] }],
      requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['document_id'], properties: { document_id: { type: 'integer' } } } } } },
      responses: { '200': { description: '已收藏' } },
    },
  },
  '/api/favorites/toggle/{documentId}': {
    post: {
      tags: ['Favorites'],
      summary: '切换收藏状态',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'documentId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { '200': { description: '{ favorited: true/false }' } },
    },
  },
  '/api/favorites/{documentId}': {
    delete: {
      tags: ['Favorites'],
      summary: '取消收藏',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'documentId', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { '200': { description: '已取消收藏' } },
    },
  },

  // ── Categories ──
  '/api/categories': {
    get: { tags: ['Categories'], summary: '分类列表（含文档计数）', responses: { '200': { description: 'Category[]' } } },
  },

  // ── Tags ──
  '/api/tags': {
    get: { tags: ['Tags'], summary: '标签列表', responses: { '200': { description: 'Tag[]' } } },
  },

  // ── Admin ──
  '/api/admin/stats': {
    get: { tags: ['Admin'], summary: '仪表盘统计（公开）', responses: { '200': { description: '{ totalDocs, totalCategories, totalUsers, categoryStats, uploadTrend, recentActivities }' } } },
  },
  '/api/admin/documents': {
    get: {
      tags: ['Admin'],
      summary: '后台文档列表',
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'title', in: 'query', schema: { type: 'string' } },
        { name: 'category_id', in: 'query', schema: { type: 'integer' } },
        { name: 'tags', in: 'query', schema: { type: 'string' } },
      ],
      responses: { '200': { description: '分页文档列表' } },
    },
  },
  '/api/admin/documents/{id}': {
    put: {
      tags: ['Admin'],
      summary: '修改文档元数据',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, category_id: { type: 'integer', nullable: true }, tags: { type: 'array', items: { type: 'integer' } } } } } } },
      responses: { '200': { description: '更新后的 Document' } },
    },
    delete: {
      tags: ['Admin'],
      summary: '删除文档（管理员）',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { '200': { description: '文档已删除' } },
    },
    post: {
      tags: ['Admin'],
      summary: '替换文档源文件',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } },
      responses: { '200': { description: '更新后的 Document' } },
    },
  },
  '/api/admin/users': {
    get: {
      tags: ['Admin'],
      summary: '用户列表',
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: { '200': { description: '分页用户列表（含文档数）' } },
    },
  },
  '/api/admin/users/{id}/password': {
    put: {
      tags: ['Admin'],
      summary: '修改用户密码',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['password'], properties: { password: { type: 'string', minLength: 6, maxLength: 128 } } } } } },
      responses: { '200': { description: '密码已更新' } },
    },
  },
  '/api/admin/questions': {
    get: {
      tags: ['Admin'],
      summary: '题库列表',
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'keyword', in: 'query', schema: { type: 'string' } },
        { name: 'source_type', in: 'query', schema: { type: 'string', enum: ['extracted', 'ai_pregenerated'] } },
      ],
      responses: { '200': { description: '分页题目列表' } },
    },
  },
  '/api/admin/questions/{id}': {
    delete: {
      tags: ['Admin'],
      summary: '删除题目',
      security: [{ cookieAuth: [] }],
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      responses: { '200': { description: '题目已删除' } },
    },
  },
  '/api/admin/questions/batch-delete': {
    post: {
      tags: ['Admin'],
      summary: '批量删除题目',
      security: [{ cookieAuth: [] }],
      requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'integer' } } } } } } },
      responses: { '200': { description: '{ message, count }' } },
    },
  },

  // ── Chat ──
  '/api/chat/ask': {
    post: {
      tags: ['Chat'],
      summary: 'AI 问答（非流式）',
      requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['question'], properties: { question: { type: 'string' }, documentId: { type: 'integer' }, thinking: { type: 'boolean' } } } } } },
      responses: { '200': { description: '{ answer, model, docs }' } },
    },
  },
  '/api/chat/ask/stream': {
    post: {
      tags: ['Chat'],
      summary: 'AI 问答（流式 SSE）',
      requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['question'], properties: { question: { type: 'string' }, thinking: { type: 'boolean' } } } } } },
      responses: { '200': { description: 'SSE 流: { type: "docs" }, { type: "token" }, [DONE]' } },
    },
  },
  '/api/chat/train': {
    post: {
      tags: ['Chat'],
      summary: 'AI 出题（非流式）',
      requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['question'], properties: { question: { type: 'string' } } } } } },
      responses: { '200': { description: '{ questions, docs }' } },
    },
  },
  '/api/chat/train/stream': {
    post: {
      tags: ['Chat'],
      summary: 'AI 出题（流式 SSE）',
      requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['question'], properties: { question: { type: 'string' } } } } } },
      responses: { '200': { description: 'SSE 流: { type: "docs" }, { type: "question" }, { type: "done" }' } },
    },
  },

  // ── Training ──
  '/api/training/questions': {
    get: {
      tags: ['Training'],
      summary: '题库列表',
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
        { name: 'keyword', in: 'query', schema: { type: 'string' } },
        { name: 'source_type', in: 'query', schema: { type: 'string', enum: ['extracted', 'ai_pregenerated', 'all'] } },
        { name: 'difficulty', in: 'query', schema: { type: 'string', enum: ['1', '2', '3', '4', '5', 'all'] } },
      ],
      responses: { '200': { description: '分页题目列表' } },
    },
  },
  '/api/training/questions/stats': {
    get: { tags: ['Training'], summary: '题库统计', responses: { '200': { description: '{ total, extracted, pregenerated, knowledgePoints }' } } },
  },
  '/api/training/generate': {
    post: {
      tags: ['Training'],
      summary: 'AI 生成题目（非流式）',
      requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { topic: { type: 'string' }, count: { type: 'integer', default: 10 }, difficulty: { type: 'integer', minimum: 1, maximum: 5 } } } } } },
      responses: { '200': { description: '{ questions, source }' } },
    },
  },
  '/api/training/generate/stream': {
    post: {
      tags: ['Training'],
      summary: 'AI 生成题目（流式 SSE）',
      requestBody: { content: { 'application/json': { schema: { type: 'object', properties: { topic: { type: 'string' }, count: { type: 'integer', default: 10 }, difficulty: { type: 'integer', minimum: 1, maximum: 5 } } } } } },
      responses: { '200': { description: 'SSE 流' } },
    },
  },
  '/api/training/record': {
    post: {
      tags: ['Training'],
      summary: '记录练习结果',
      security: [{ cookieAuth: [] }],
      requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['questionId', 'status'], properties: { questionId: { type: 'integer' }, status: { type: 'string', enum: ['mastered', 'review'] } } } } } },
      responses: { '200': { description: '已记录' } },
    },
  },
  '/api/training/difficulty': {
    post: {
      tags: ['Training'],
      summary: '评分题目难度',
      security: [{ cookieAuth: [] }],
      requestBody: { content: { 'application/json': { schema: { type: 'object', required: ['questionId', 'level'], properties: { questionId: { type: 'integer' }, level: { type: 'integer', minimum: 1, maximum: 5 } } } } } },
      responses: { '200': { description: '{ difficulty, votes, locked }' } },
    },
  },
  '/api/training/review': {
    get: {
      tags: ['Training'],
      summary: '待复习列表',
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
      ],
      responses: { '200': { description: '分页练习记录（含关联题目）' } },
    },
  },
}

export default spec
