import { Document, DocumentChunk } from './models'
import { getDocumentTextForChunking } from './services/extraction.service'
import { splitIntoChunks } from './services/chunking.service'
import { embedTexts } from './services/embedding.service'
import { indexChunks } from './services/retrieval.service'
import path from 'path'
import fs from 'fs'

async function rebuild(): Promise<void> {
  // 1. 清空旧数据
  await DocumentChunk.destroy({ where: {} })
  console.log('[rebuild] MySQL chunks 已清空')

  const lanceDir = path.resolve(__dirname, '../../lancedb_data')
  if (fs.existsSync(lanceDir)) {
    fs.rmSync(lanceDir, { recursive: true })
    console.log('[rebuild] LanceDB 已清空')
  }

  // 2. 逐个文档重建
  const docs = await Document.findAll()
  console.log(`[rebuild] 开始处理 ${docs.length} 个文档`)

  for (const doc of docs) {
    const fullPath = path.resolve(process.cwd(), doc.file_path)
    if (!fs.existsSync(fullPath)) {
      console.log(`[rebuild] SKIP doc ${doc.id} — 文件不存在`)
      continue
    }

    const text = await getDocumentTextForChunking(fullPath, doc.file_type)
    if (!text) {
      console.log(`[rebuild] SKIP doc ${doc.id} (${doc.title}) — 无文本`)
      continue
    }

    const chunks = await splitIntoChunks(text)
    if (!chunks.length) continue

    const rows = await Promise.all(
      chunks.map(c =>
        DocumentChunk.create({
          document_id: doc.id, chunk_index: c.index, content: c.content,
          token_count: c.tokenCount, strategy: c.strategy,
          heading: c.heading, position_start: c.positionStart, position_end: c.positionEnd,
        })
      )
    )

    // 向量化 + 索引
    const BATCH = 10
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const embeddings = await embedTexts(batch.map(r => r.content))
      await indexChunks(
        batch.map((r, j) => ({ id: r.id, document_id: doc.id, content: r.content, embedding: embeddings[j] }))
      )
    }

    console.log(`[rebuild] DONE doc ${doc.id} (${doc.title.slice(0, 30)}): ${rows.length} chunks`)
  }

  console.log('[rebuild] 全部完成')
  process.exit(0)
}

rebuild().catch(e => { console.error(e); process.exit(1) })
