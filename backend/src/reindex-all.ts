import { DocumentChunk } from './models'
import { embedTexts } from './services/embedding.service'
import { indexChunks } from './services/retrieval.service'
import { createModuleLogger } from './utils/logger'

const logger = createModuleLogger('reindex')

async function reindex(): Promise<void> {
  const chunks = await DocumentChunk.findAll()
  logger.info(`[reindex] MySQL 共 ${chunks.length} 个 chunk`)

  if (chunks.length === 0) {
    logger.info('[reindex] 无数据，退出')
    process.exit(0)
  }

  const BATCH = 10
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
    logger.info(`[reindex] 批次 ${Math.floor(i / BATCH) + 1}: ${batch.length} 个 chunk`)
  }

  logger.info(`[reindex] 完成：${chunks.length} 个向量已索引入 LanceDB`)
  process.exit(0)
}

reindex().catch(e => { logger.error(e); process.exit(1) })
