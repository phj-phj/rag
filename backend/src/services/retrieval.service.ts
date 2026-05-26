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

// ── 写入：upload → chunk → embed → 存 LanceDB ──

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

  const existing = await conn.openTable('chunks').catch(() => null)
  if (existing) {
    await existing.add(data)
  } else {
    await conn.createTable('chunks', data, { existOk: true })
  }

  console.log(`[retrieval] 已索引 ${rows.length} 个 chunk (共 ${(await conn.openTable('chunks'))!.countRows()} 行)`)
}

// ── 检索：question → embed → LanceDB search → top-K ──

export interface RetrievedChunk {
  chunkId: number
  documentId: number
  documentTitle: string
  content: string
  score: number
}

export async function retrieve(question: string, topK: number = 5): Promise<RetrievedChunk[]> {
  const conn = await getDB()
  const table = await conn.openTable('chunks').catch(() => null)
  if (!table) {
    console.log('[retrieval] chunks 表为空，无数据可检索')
    return []
  }

  const queryVec = await embedQuery(question)

  const results = await (table.search(queryVec) as any)
    .distanceType('cosine')
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

  console.log(`[retrieval] 命中 ${scored.length} 个片段`)
  scored.forEach((c: RetrievedChunk, i: number) => {
    console.log(`[retrieval]   ${i + 1}. [${c.documentTitle}] score=${c.score.toFixed(3)}`)
  })

  return scored
}

// ── 删除：文档被删时同步清理 ──

export async function deleteDocumentChunks(documentId: number): Promise<void> {
  const conn = await getDB()
  const table = await conn.openTable('chunks').catch(() => null)
  if (!table) return
  await table.delete(`document_id = ${documentId}`)
  console.log(`[retrieval] 已删除文档 ${documentId} 的 chunk 向量`)
}
