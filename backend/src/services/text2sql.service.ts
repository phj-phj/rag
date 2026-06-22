import { ChatOpenAI } from '@langchain/openai'
import sequelize from '../config/database'
import { QueryTypes } from 'sequelize'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('text2sql')

const SCHEMA_PROMPT = `你是 MySQL 查询生成器。根据以下数据库 Schema 将用户问题转为 SELECT 语句。

规则：
1. 只生成 SELECT 查询，禁止 INSERT/UPDATE/DELETE/DROP/ALTER/TRUNCATE
2. 只返回 SQL 语句本身，不要任何解释、markdown 代码块、注释
3. 禁止 SELECT *，必须明确列出需要的字段
4. 禁止查询 Users 表的 password 字段

支持的表和字段：

-- 用户表
Users: id, username, role('user'/'admin'), created_at
-- 分类表
Categories: id, name, created_at
-- 标签表
Tags: id, name, created_at
-- 文档表
Documents: id, title, file_type, file_size(字节), uploader_id, category_id, is_featured, created_at
-- 文档-标签关联表（多对多）
Document_Tags: document_id, tag_id
-- 收藏表
Favorites: user_id, document_id, created_at
-- 文档切块表
Document_Chunks: id, document_id, chunk_index, content, token_count, strategy, heading
-- 题库表
Questions: id, stem, explanation, type, difficulty, knowledge_point, source_type('extracted'/'ai_pregenerated'/'ai_adhoc'), source_document_id, created_at
-- 练习记录表
PracticeRecords: id, user_id, question_id, status('mastered'/'review'), created_at

关系：Users.id = Documents.uploader_id, Categories.id = Documents.category_id, Documents.id = Document_Tags.document_id, Tags.id = Document_Tags.tag_id, Documents.id = Questions.source_document_id`

const llm = new ChatOpenAI({
  model: process.env.MIMO_MODEL || 'deepseek-v4-flash',
  temperature: 0,
  maxTokens: 1024,
  apiKey: process.env.MIMO_API_KEY || '',
  configuration: {
    baseURL: process.env.MIMO_BASE_URL || 'https://api.deepseek.com/v1',
  },
})

async function generateSql(question: string): Promise<string> {
  const res = await llm.invoke([
    { role: 'system', content: SCHEMA_PROMPT },
    { role: 'user', content: question },
  ])
  const sql = (typeof res.content === 'string' ? res.content : '').trim()
  logger.info(`生成 SQL: ${sql}`)
  return sql
}

function validateAndClean(sql: string): string {
  const trimmed = sql.trim()
  const upper = trimmed.toUpperCase()

  const forbidden = [
    'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER',
    'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'REPLACE',
  ]
  for (const kw of forbidden) {
    if (upper.includes(kw)) {
      throw new Error(`禁止的 SQL 操作: ${kw}`)
    }
  }

  if (!upper.startsWith('SELECT')) {
    throw new Error('只允许 SELECT 查询')
  }

  let cleaned = trimmed.replace(/;\s*$/, '')
  if (cleaned.includes(';')) {
    throw new Error('不允许执行多条语句')
  }

  if (!cleaned.toUpperCase().includes('LIMIT')) {
    cleaned += ' LIMIT 100'
  }

  return cleaned
}

export async function executeText2Sql(question: string): Promise<string> {
  let sql: string
  try {
    sql = await generateSql(question)
  } catch (err) {
    logger.error('SQL 生成失败:', (err as Error).message)
    return '无法理解该查询，请换个方式提问。'
  }

  if (!sql) return '无法理解该查询，请换个方式提问。'

  try {
    const safeSql = validateAndClean(sql)
    const rows = await sequelize.query(safeSql, { type: QueryTypes.SELECT })

    if (rows.length === 0) {
      return '没有找到符合条件的数据。'
    }

    // 安全兜底：移除密码字段
    const safe = rows.map((r: any) => {
      if (r.password !== undefined) {
        const { password, ...rest } = r
        return rest
      }
      return r
    })

    const formatted = formatResult(safe)
    return formatted
  } catch (err) {
    logger.error('SQL 执行失败:', (err as Error).message)
    return '查询执行失败，请检查是否表述有误。'
  }
}

function formatResult(rows: unknown[]): string {
  if (rows.length === 0) return '没有找到符合条件的数据。'

  // 单行单列 → 直接返回值
  const firstRow = rows[0] as Record<string, unknown>
  const keys = Object.keys(firstRow)
  if (rows.length === 1 && keys.length === 1) {
    return String(firstRow[keys[0]])
  }

  // 少行 → 逐行列举
  if (rows.length <= 10) {
    const lines = rows.map((row, i) => {
      const item = row as Record<string, unknown>
      return `${i + 1}. ${Object.entries(item)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')}`
    })
    return lines.join('\n')
  }

  // 多行 → 汇总 + 前5条
  const preview = rows.slice(0, 5)
    .map((row, i) => {
      const item = row as Record<string, unknown>
      return `${i + 1}. ${Object.entries(item)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')}`
    })
    .join('\n')
  return `共 ${rows.length} 条结果，前 5 条：\n${preview}`
}
