import * as lancedb from '@lancedb/lancedb'
import path from 'path'
import { embedQuery } from './embedding.service'
import Document from '../models/Document'

const DB_PATH = path.resolve(__dirname, '../../lancedb_data')

let db: lancedb.Connection | null = null

async function getDB(): Promise<lancedb.Connection> {
  if (!db) {
    db = await lancedb.connect(DB_PATH)
    console.log('[retrieval] LanceDB 已连接:', DB_PATH)
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
    console.log('[retrieval] chunks 表不存在，跳过索引创建')
    return
  }

  const table = await conn.openTable('chunks')
  const rowCount = Number(await table.countRows())
  if (rowCount === 0) {
    console.log('[retrieval] chunks 表为空，跳过索引创建')
    return
  }

  // 向量索引：IVF_PQ，1024 维 → 128 个子向量（8 dims/sub）
  // num_partitions ≈ sqrt(rowCount)，但至少 32
  const numPartitions = Math.max(32, Math.floor(Math.sqrt(rowCount)))
  try {
    await table.createIndex('vector', {
      config: lancedb.Index.ivfPq({
        numPartitions: numPartitions,
        numSubVectors: 128,
        maxIterations: 50,
      }),
    })
    console.log(`[retrieval] IVF_PQ 向量索引已创建 (partitions=${numPartitions}, sub_vectors=128)`)
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('[retrieval] 向量索引已存在，跳过')
    } else {
      throw e
    }
  }

  // 标量索引：加速 document_id 过滤
  try {
    await table.createIndex('document_id', {
      config: lancedb.Index.btree(),
    })
    console.log('[retrieval] BTREE 标量索引已创建 (document_id)')
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('[retrieval] 标量索引已存在，跳过')
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
    console.log('[retrieval] 表已 compact')
  } catch (e: any) {
    console.log('[retrieval] compact 跳过:', e.message)
  }
}

// ── 写入 ──

export async function indexChunks(
  rows: Array<{ id: number; document_id: number; content: string; embedding: number[] }>,
): Promise<void> {
  if (rows.length === 0) return

  const conn = await getDB()
  const data = rows.map(r => ({
    id: r.id,
    document_id: r.document_id,
    content: r.content,
    vector: r.embedding,
  }))

  const names = await conn.tableNames()
  if (names.includes('chunks')) {
    const table = await conn.openTable('chunks')
    await table.add(data)
  } else {
    await conn.createTable('chunks', data, { existOk: true })
  }

  console.log(`[retrieval] 已索引 ${rows.length} 个 chunk`)
}

// ── 检索 ──

export interface RetrievedChunk {
  chunkId: number
  documentId: number
  documentTitle: string
  content: string
  score: number
}

export async function retrieve(question: string, topK: number = 5): Promise<RetrievedChunk[]> {
  const conn = await getDB()
  const names = await conn.tableNames()
  if (!names.includes('chunks')) {
    console.log('[retrieval] chunks 表不存在，无数据可检索')
    return []
  }

  const table = await conn.openTable('chunks')
  const queryVec = await embedQuery(question)

  const results = await (table.search(queryVec) as any)
    .distanceType('cosine')
    .nprobes(20)
    .refineFactor(5)
    .limit(topK)
    .toArray()

  // 补充文档标题
  const docIds = [...new Set(results.map((r: any) => r.document_id))]
  const docs = await Document.findAll({
    where: { id: docIds as number[] },
    attributes: ['id', 'title'],
  })
  const titleMap = new Map(docs.map(d => [d.id, d.title]))

  const scored = results.map((r: any) => ({
    chunkId: r.id,
    documentId: r.document_id,
    documentTitle: titleMap.get(r.document_id) || '未知文档',
    content: r.content,
    score: r._distance !== undefined ? Math.max(0, 1 - r._distance) : 0,
  }))

  console.log(`[retrieval] 命中 ${scored.length} 个片段 (nprobes=20, refineFactor=5)`)
  scored.forEach((c: RetrievedChunk, i: number) => {
    console.log(`[retrieval]   ${i + 1}. [${c.documentTitle}] score=${c.score.toFixed(3)}`)
  })

  return scored
}

// ── 删除 ──

export async function deleteDocumentChunks(documentId: number): Promise<void> {
  const conn = await getDB()
  const names = await conn.tableNames()
  if (!names.includes('chunks')) return

  const table = await conn.openTable('chunks')
  await table.delete(`document_id = ${documentId}`)
  console.log(`[retrieval] 已删除文档 ${documentId} 的 chunk 向量`)
}
