import { DocumentChunk } from './models'
import { embedTexts } from './services/embedding.service'
import { indexChunks } from './services/retrieval.service'

async function reindex(): Promise<void> {
  const chunks = await DocumentChunk.findAll()
  console.log(`[reindex] MySQL 共 ${chunks.length} 个 chunk`)

  if (chunks.length === 0) {
    console.log('[reindex] 无数据，退出')
    process.exit(0)
  }

  const BATCH = 50
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH)
    const embeddings = await embedTexts(batch.map(c => c.content))
    await indexChunks(
      batch.map((c, j) => ({
        id: c.id,
        document_id: c.document_id,
        content: c.content,
        embedding: embeddings[j],
      }))
    )
    console.log(`[reindex] 批次 ${Math.floor(i / BATCH) + 1}: ${batch.length} 个 chunk`)
  }

  console.log(`[reindex] 完成：${chunks.length} 个向量已索引入 LanceDB`)
  process.exit(0)
}

reindex().catch(e => { console.error(e); process.exit(1) })
