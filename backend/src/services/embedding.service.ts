import axios from 'axios'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('embedding')

const BASE_URL = process.env.EMBED_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'
const API_KEY = process.env.EMBED_API_KEY || ''
const MODEL = process.env.EMBED_MODEL || 'embedding-2'

let dims = 0


/**
 * 批量文本 → 向量（自动截断超长文本）
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return []

  // 截断到 ~480 token，防止 API 413
  const MAX_LEN = 480
  const truncated = texts.map(t => t.length > MAX_LEN ? t.slice(0, MAX_LEN) : t)

  const res = await axios.post(
    `${BASE_URL}/embeddings`,
    { model: MODEL, input: truncated },
    { headers: { Authorization: `Bearer ${API_KEY}` } }
  )

  const embeddings: number[][] = res.data.data.map((d: any) => d.embedding)
  if (!dims && embeddings.length > 0) {
    dims = embeddings[0].length
    logger.info(`[embedding] ${MODEL} 就绪, 维度: ${dims}`)
  }

  return embeddings
}

/**
 * 单个查询 → 向量
 */
export async function embedQuery(query: string): Promise<number[]> {
  const results = await embedTexts([query])
  return results[0]
}
