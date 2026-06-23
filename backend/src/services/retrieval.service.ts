import * as lancedb from '@lancedb/lancedb'
import path from 'path'
import { embedQuery } from './embedding.service'
import { rerank } from './rerank.service'
import Document from '../models/Document'
import DocumentChunk from '../models/DocumentChunk'
import { Op } from 'sequelize'
import { debugInfo } from '../utils/debug'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('retrieval')

const DB_PATH = path.resolve(__dirname, '../../lancedb_data')

let db: lancedb.Connection | null = null

async function getDB(): Promise<lancedb.Connection> {
  if (!db) {
    db = await lancedb.connect(DB_PATH)
    logger.info('[retrieval] LanceDB 已连接:', DB_PATH)
  }
  return db
}

// ── 索引管理 ──

/**
 * 确保向量索引（IVF_PQ）+ 标量索引（BTREE）存在。
 * 已有索引则跳过，不重复创建。
 */
export async function ensureIndexes(): Promise<void> {
  const conn = await getDB()
  const names = await conn.tableNames()
  if (!names.includes('chunks')) {
    logger.info('[retrieval] chunks 表不存在，跳过索引创建')
    return
  }

  const table = await conn.openTable('chunks')
  const rowCount = Number(await table.countRows())
  if (rowCount === 0) {
    logger.info('[retrieval] chunks 表为空，跳过索引创建')
    return
  }

  // 小规模库（<1000 vectors）使用精确检索，无需向量索引

  // BTREE 标量索引：加速 document_id 过滤
  try {
    await table.createIndex('document_id', {
      config: lancedb.Index.btree(),
    })
    logger.info('[retrieval] BTREE 标量索引已创建 (document_id)')
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      logger.info('[retrieval] 标量索引已存在，跳过')
    } else {
      throw e
    }
  }

  // 全文索引：BM25 关键词检索
  try {
    await table.createIndex('content', {
      config: lancedb.Index.fts(),
    })
    logger.info('[retrieval] FTS 全文索引已创建 (content)')
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      logger.info('[retrieval] FTS 索引已存在，跳过')
    } else {
      throw e
    }
  }
}

/**
 * 启动时清理旧版本，压缩存储。
 */
export async function compactTable(): Promise<void> {
  const conn = await getDB()
  const names = await conn.tableNames()
  if (!names.includes('chunks')) return

  const table = await conn.openTable('chunks')
  try {
    await table.optimize()
    logger.info('[retrieval] 表已 compact')
  } catch (e: any) {
    logger.info('[retrieval] compact 跳过:', e.message)
  }
}

// ── 写入 ──

export async function indexChunks(
  rows: Array<{ id: number; document_id: number; content: string; embedding: number[]; documentTitle: string }>,
): Promise<void> {
  if (rows.length === 0) return

  const conn = await getDB()
  const data = rows.map(r => ({
    id: r.id,
    document_id: r.document_id,
    content: r.content,
    vector: r.embedding,
    documentTitle: r.documentTitle,
  }))

  const names = await conn.tableNames()
  if (names.includes('chunks')) {
    const table = await conn.openTable('chunks')
    await table.add(data)
  } else {
    await conn.createTable('chunks', data, { existOk: true })
  }

  logger.info(`[retrieval] 已索引 ${rows.length} 个 chunk`)
}

// ── 检索 ──

export interface RetrievedChunk {
  chunkId: number
  documentId: number
  documentTitle: string
  content: string
  score: number
}

export interface RetrieveOptions {
  disableFts?: boolean
  disableRerank?: boolean
  disableMmr?: boolean
  expandContext?: boolean
}

export async function retrieve(
  question: string,
  topK: number = 5,
  opts?: RetrieveOptions,
): Promise<RetrievedChunk[]> {
  const conn = await getDB()
  const names = await conn.tableNames()
  if (!names.includes('chunks')) {
    logger.info('[retrieval] chunks 表不存在，无数据可检索')
    return []
  }

  const table = await conn.openTable('chunks')
  const CANDIDATE_FACTOR = 4
  const searchStart = Date.now()

  // ── 双路并行检索 ──
  const queryVec = await embedQuery(question)
  debugInfo('向量维度', queryVec.length)

  const [vecResults, ftsResults] = await Promise.all([
    // 向量检索
    (table.search(queryVec) as any).distanceType('cosine').limit(topK * CANDIDATE_FACTOR).toArray(),
    // 全文检索（BM25）
    opts?.disableFts
      ? Promise.resolve([])
      : (table.search(question, 'fts' as any, 'content' as any) as any).limit(topK * CANDIDATE_FACTOR).toArray()
        .catch((err: any) => {
          logger.warn('[retrieval] FTS 检索失败，仅用向量:', err.message)
          return []
        }),
  ])
  debugInfo('双路检索耗时', `${Date.now() - searchStart}ms`)
  debugInfo('向量命中', vecResults.length)
  debugInfo('FTS命中', ftsResults.length)

  // 补充文档标题：优先用 LanceDB 中存好的标题，兼容旧数据回退 MySQL
  const allResults = [...vecResults, ...ftsResults]
  const docIds = [...new Set(
    allResults.filter((r: any) => !r.documentTitle).map((r: any) => r.document_id),
  )]
  const titleMap = new Map<number, string>()
  if (docIds.length > 0) {
    const docs = await Document.findAll({
      where: { id: docIds as number[] },
      attributes: ['id', 'title'],
    })
    for (const d of docs) titleMap.set(d.id, d.title)
  }

  // 将两路结果标准化为统一格式
  const toChunk = (r: any, src: 'vector' | 'fts', idx: number): any => ({
    chunkId: r.id,
    documentId: r.document_id,
    documentTitle: r.documentTitle || titleMap.get(r.document_id) || '未知文档',
    content: r.content,
    score: src === 'vector'
      ? Math.max(0, 1 - (r._distance ?? 0))
      : 0.5,
    _rank: idx + 1,
  })

  const vecChunks = vecResults.map((r: any, i: number) => toChunk(r, 'vector', i))
  const ftsChunks = ftsResults.map((r: any, i: number) => toChunk(r, 'fts', i))

  // FTS 结果日志
  if (ftsChunks.length > 0) {
    logger.info(`[retrieval] FTS 命中:`)
    ftsChunks.slice(0, 5).forEach((c: any, i: number) => {
      logger.info(`[retrieval]   ${i + 1}. [${c.documentTitle}] ${c.content.slice(0, 60).replace(/\n/g, ' ')}...`)
    })
  }

  // ── RRF 融合（动态加权）──
  const merged = rrfMerge(vecChunks, ftsChunks, topK * CANDIDATE_FACTOR, vecResults, ftsResults, ftsResults.length)
  logger.info(`[retrieval] 双路粗召 ${vecChunks.length}+${ftsChunks.length} → RRF融合 ${merged.length}`)

  // ── Rerank 精排（粗召结果重新打分排序）──
  let reranked: (RetrievedChunk & { _rank?: number })[]
  if (opts?.disableRerank) {
    logger.info('[retrieval] Rerank 已禁用，跳过')
    reranked = merged.map(m => ({ ...m, score: Math.min(1, m.score * 2) }))
  } else {
    reranked = await rerank(question, merged, topK * 2)
    logger.info(`[retrieval] Rerank精排: ${merged.length}条 → ${reranked.length}条`)
    reranked.forEach((c, i) => {
      const preview = c.content.slice(0, 80).replace(/\n/g, ' ')
      logger.info(`[retrieval]   R[${i + 1}] [${c.documentTitle}] score=${c.score.toFixed(3)} | ${preview}...`)
    })
  }

  // MMR 多样性选择
  let selected: RetrievedChunk[]
  if (opts?.disableMmr) {
    selected = reranked.slice(0, topK)
    logger.info('[retrieval] MMR 已禁用，直接取Top:')
  } else {
    selected = mmrSelect(reranked, topK, 0.85)
    logger.info(`[retrieval] MMR 精选结果:`)
  }
  selected.forEach((c: RetrievedChunk, i: number) => {
    logger.info(`[retrieval]   ${i + 1}. [${c.documentTitle}] score=${c.score.toFixed(3)}`)
  })

  // 上下文展开：短 chunk 补齐前后邻居
  if (opts?.expandContext !== false) {
    selected = await expandContext(selected)
  }

  return selected
}

// ── 上下文展开 ──

const MIN_CHUNK_CHARS = 200

async function expandContext(chunks: RetrievedChunk[]): Promise<RetrievedChunk[]> {
  const expanded: RetrievedChunk[] = []

  for (const c of chunks) {
    if (c.content.length >= MIN_CHUNK_CHARS) {
      expanded.push(c)
      continue
    }

    try {
      // 用范围查询取相邻 chunk
      const current = await DocumentChunk.findOne({
        where: { id: c.chunkId },
        attributes: ['chunk_index'],
      })
      if (!current) { expanded.push(c); continue }

      const neighbors = await DocumentChunk.findAll({
        where: {
          document_id: c.documentId,
          chunk_index: {
            [Op.between]: [
              current.chunk_index - 1,
              current.chunk_index + 1,
            ],
          },
        },
        order: [['chunk_index', 'ASC']],
        attributes: ['content', 'chunk_index'],
        raw: true,
      })

      const parts: string[] = []
      for (const n of neighbors) {
        if ((n as any).chunk_index === current.chunk_index) {
          parts.push(c.content)
        } else {
          parts.push((n as any).content)
        }
      }

      c.content = parts.join('\n')
      logger.info(`[retrieval] 展开 chunk ${c.chunkId} (${current.chunk_index}): ±1 邻居, ${parts.length} 段`)
    } catch (err) {
      logger.warn(`[retrieval] 展开 chunk ${c.chunkId} 失败:`, (err as Error).message)
    }

    expanded.push(c)
  }

  return expanded
}

// ── RRF 双路融合 ──

/**
 * 根据两路粗召结果的分数分布，动态计算融合权重。
 * 信号密度 = 高分结果占比，占比越高该路越可信。
 */
function computeDynamicWeights(
  vecResults: any[],
  ftsResults: any[],
  ftsTotalCount: number,
): { vecWeight: number; ftsWeight: number } {
  if (vecResults.length === 0 && ftsResults.length === 0) return { vecWeight: 1, ftsWeight: 1 }

  // 单路空 → 全权给另一路
  if (vecResults.length === 0) return { vecWeight: 0, ftsWeight: 1 }
  if (ftsResults.length === 0) return { vecWeight: 1, ftsWeight: 0 }

  // 向量路信号密度：余弦相似度 > 0.3 的比例
  const vecHigh = vecResults.filter(r => (1 - (r._distance ?? 0)) > 0.3).length
  const vecDensity = vecHigh / vecResults.length

  // FTS 路信号密度：数量越少 → 越精准（大量返回 = 低质量泛滥匹配）
  const ftsDensity = Math.min(1, Math.max(0.1, 5 / Math.max(ftsTotalCount, 1)))

  const total = vecDensity + ftsDensity
  return { vecWeight: vecDensity / total, ftsWeight: ftsDensity / total }
}

/**
 * Reciprocal Rank Fusion：合并向量和 FTS 两路结果
 * RRF_score = Σ weight / (k + rank_in_path)
 */
export function rrfMerge(
  vec: (RetrievedChunk & { _rank?: number })[],
  fts: (RetrievedChunk & { _rank?: number })[],
  topK: number,
  vecResultsRaw?: any[],
  ftsResultsRaw?: any[],
  ftsTotalCount?: number,
): RetrievedChunk[] {
  const { vecWeight, ftsWeight } = computeDynamicWeights(
    vecResultsRaw ?? vec,
    ftsResultsRaw ?? fts,
    ftsTotalCount ?? fts.length,
  )
  logger.info(`[retrieval] 动态权重: 向量=${vecWeight.toFixed(2)} FTS=${ftsWeight.toFixed(2)}`)

  const K = 60
  const scoreMap = new Map<number, { chunk: RetrievedChunk; rrf: number }>()

  for (const [pathResults, weight] of [[vec, vecWeight], [fts, ftsWeight]] as const) {
    for (const c of pathResults) {
      const rank = c._rank ?? pathResults.length
      const rrf = (weight as number) / (K + rank)
      if (scoreMap.has(c.chunkId)) {
        scoreMap.get(c.chunkId)!.rrf += rrf
      } else {
        scoreMap.set(c.chunkId, { chunk: c, rrf })
      }
    }
  }

  return Array.from(scoreMap.values())
    .map(({ chunk, rrf }) => ({ ...chunk, score: Math.min(1, rrf * 10) })) // 缩放到 [0,1]
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

// ── MMR 多样性去重 ──

export function mmrSelect(candidates: RetrievedChunk[], topK: number, lambda: number): RetrievedChunk[] {
  if (candidates.length <= topK) return candidates

  const selected: RetrievedChunk[] = []
  const remaining = [...candidates]

  // 选最高分作为第一条
  selected.push(remaining.shift()!)

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0
    let bestScore = -Infinity

    for (let i = 0; i < remaining.length; i++) {
      const relevance = remaining[i].score
      // 多样性：与已选中的最大文本重叠度
      let maxOverlap = 0
      for (const s of selected) {
        // 同文档轻度惩罚（不同段落可能讲不同知识点）
        if (remaining[i].documentId === s.documentId) {
          maxOverlap = Math.max(maxOverlap, 0.3)
        }
        const overlap = jaccardOverlap(remaining[i].content, s.content)
        maxOverlap = Math.max(maxOverlap, overlap)
      }
      const mmrScore = lambda * relevance - (1 - lambda) * maxOverlap
      if (mmrScore > bestScore) {
        bestScore = mmrScore
        bestIdx = i
      }
    }

    selected.push(remaining[bestIdx])
    remaining.splice(bestIdx, 1)
  }

  // 按原始分数排序返回
  return selected.sort((a, b) => b.score - a.score)
}

/**
 * 字符级 Jaccard 重叠度（快速近似文本相似度）
 */
export function jaccardOverlap(a: string, b: string): number {
  const setA = new Set(a.slice(0, 200))
  const setB = new Set(b.slice(0, 200))
  let intersection = 0
  for (const ch of setA) {
    if (setB.has(ch)) intersection++
  }
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

// ── 删除 ──

export async function deleteDocumentChunks(documentId: number): Promise<void> {
  const conn = await getDB()
  const names = await conn.tableNames()
  if (!names.includes('chunks')) return

  const table = await conn.openTable('chunks')
  await table.delete(`document_id = ${documentId}`)
  logger.info(`[retrieval] 已删除文档 ${documentId} 的 chunk 向量`)
}
