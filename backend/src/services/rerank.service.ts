import axios from 'axios'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('rerank')

export interface RerankInput {
  content: string
  [key: string]: any
}

/**
 * 精排：对粗召结果逐条打分，返回 Top-N
 */
export async function rerank<T extends RerankInput>(
  query: string,
  candidates: T[],
  topN: number = 5,
): Promise<T[]> {
  if (candidates.length === 0) return candidates

  const BASE_URL = process.env.RERANK_BASE_URL || 'https://api.siliconflow.cn/v1'
  const API_KEY = process.env.RERANK_API_KEY || process.env.EMBED_API_KEY || ''
  const MODEL = process.env.RERANK_MODEL || 'Qwen/Qwen3-Reranker-0.6B'
  logger.info(`[rerank] BASE_URL=${BASE_URL} KEY=${API_KEY.slice(0,10)}... MODEL=${MODEL}`)

  try {
    const start = Date.now()
    const documents = candidates.map(c => c.content)

    const res = await axios.post(
      `${BASE_URL}/rerank`,
      {
        model: MODEL,
        query,
        documents,
        top_n: topN,
        return_documents: false,
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      },
    )

    // API 返回 { results: [{ index: number, relevance_score: number }] }
    const results: Array<{ index: number; relevance_score: number }> = res.data?.results || []

    const reranked = results
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .map(r => ({
        ...candidates[r.index],
        score: r.relevance_score, // 用精排分数覆盖粗排分数
      }))

    const elapsed = Date.now() - start
    logger.info(`[rerank] ${elapsed}ms: ${candidates.length}条 → ${reranked.length}条`)

    return reranked
  } catch (err) {
    const e = err as any
    const detail = 'constructor=' + (e?.constructor?.name || '?') + ' message=' + (e?.message || '?') + ' status=' + (e?.response?.status || '?') + ' data=' + JSON.stringify(e?.response?.data || {}).slice(0, 100)
    logger.warn(`[rerank] 精排失败，退回粗排结果: ${detail}`)
    return candidates.slice(0, topN)
  }
}
