import axios from 'axios'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('embedding')

const BASE_URL = process.env.EMBED_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'
const API_KEY = process.env.EMBED_API_KEY || ''
const MODEL = process.env.EMBED_MODEL || 'embedding-2'

let dims = 0

// 全局节流：确保两次请求至少间隔 1100ms
let lastCallTime = 0
function throttle(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastCallTime
  if (elapsed < 1100) {
    return new Promise(r => setTimeout(r, 1100 - elapsed))
  }
  return Promise.resolve()
}

// 从调用栈提取上层调用者文件名
function caller(): string {
  const stack = new Error().stack || ''
  const lines = stack.split('\n')
  // 跳过 embedTexts → embedQuery → 找到真正调用者
  for (let i = 3; i < lines.length; i++) {
    const match = lines[i].match(/(?:at |\()(.+?\.(?:ts|js))(?::|\))/)
    if (match && !match[1].includes('embedding')) return match[1].replace(/^.*[\\/]/, '')
  }
  return '?'
}

/**
 * 批量文本 → 向量（自动截断、拆批、节流）
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (!texts.length) return []

  const MAX_LEN = 480
  const BATCH_SIZE = 16
  const truncated = texts.map(t => t.length > MAX_LEN ? t.slice(0, MAX_LEN) : t)
  const totalBatches = Math.ceil(truncated.length / BATCH_SIZE)
  const t0 = Date.now()

  logger.info(
    `[embedding] 开始: ${texts.length}条 → ${totalBatches}批, ` +
    `每批${BATCH_SIZE}条, ` +
    `预估${(totalBatches * 1.2).toFixed(0)}s | 调用者: ${caller()}`
  )

  const allEmbeddings: number[][] = []
  let retryCount = 0

  for (let i = 0; i < truncated.length; i += BATCH_SIZE) {
    const batch = truncated.slice(i, i + BATCH_SIZE)
    const batchNo = Math.floor(i / BATCH_SIZE) + 1

    await throttle()
    lastCallTime = Date.now()

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const res = await axios.post(
          `${BASE_URL}/embeddings`,
          { model: MODEL, input: batch },
          { headers: { Authorization: `Bearer ${API_KEY}` }, timeout: 30000 },
        )

        const embeddings: number[][] = res.data.data.map((d: any) => d.embedding)
        if (!dims && embeddings.length > 0) {
          dims = embeddings[0].length
          logger.info(`[embedding] ${MODEL} 就绪, 维度: ${dims}`)
        }

        allEmbeddings.push(...embeddings)

        if (totalBatches > 1) {
          logger.info(`[embedding] 批次 ${batchNo}/${totalBatches} 完成 (${batch.length}条)`)
        }
        break
      } catch (err: any) {
        const status = err?.response?.status || 0
        const errCode = err?.response?.data?.error?.code || ''
        const errMsg = err?.response?.data?.error?.message || err?.message || ''

        // 非 429 错误直接抛
        if (status !== 429) {
          logger.error(
            `[embedding] 批次 ${batchNo}/${totalBatches} 失败: ` +
            `HTTP ${status} | code=${errCode} | message=${errMsg.slice(0, 120)}`
          )
          throw err
        }

        retryCount++
        if (attempt < 4) {
          const wait = (attempt + 1) * 2000
          logger.warn(
            `[embedding] 429 限流 | 批次 ${batchNo}/${totalBatches} | ` +
            `第${attempt + 1}次重试 | 等${wait / 1000}s | ` +
            `msg=${errMsg.slice(0, 80)} | 调用者: ${caller()}`
          )
          await new Promise(r => setTimeout(r, wait))
          continue
        }
        throw err
      }
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  logger.info(
    `[embedding] 完成: ${allEmbeddings.length}个向量, ` +
    `耗时${elapsed}s, 重试${retryCount}次`
  )

  return allEmbeddings
}

/**
 * 单个查询 → 向量
 */
export async function embedQuery(query: string): Promise<number[]> {
  const results = await embedTexts([query])
  return results[0]
}
