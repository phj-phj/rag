import axios from 'axios'

const BASE_URL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1'
const API_KEY = process.env.SILICONFLOW_API_KEY || ''
const MODEL = process.env.SILICONFLOW_EMBED_MODEL || 'BAAI/bge-large-zh-v1.5'

let dims = 0

/**
 * 批量文本 → 向量（自动截断超长文本）
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return []

  // 截断到 ~480 token（中文约 480 字），防止 API 413 错误
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
    console.log(`[embedding] SiliconFlow ${MODEL} 就绪, 维度: ${dims}`)
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
