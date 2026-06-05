import { deleteFile } from './file.service'
import { deleteDocumentChunks } from './retrieval.service'
import { DocumentChunk, Question } from '../models'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('cleanup')

export async function deleteDocumentCascade(
  docId: number,
  filePath: string,
): Promise<void> {
  await deleteDocumentChunks(docId)
  logger.info(`[cleanup] LanceDB 向量已清理: docId=${docId}`)

  const chunksDeleted = await DocumentChunk.destroy({
    where: { document_id: docId },
  })
  logger.info(`[cleanup] MySQL 切块已清理: docId=${docId}, ${chunksDeleted}行`)

  const questionsDeleted = await Question.destroy({
    where: { source_document_id: docId },
  })
  logger.info(`[cleanup] 题目已清理: docId=${docId}, ${questionsDeleted}行`)

  await deleteFile(filePath)
  logger.info(`[cleanup] 物理文件已删除: ${filePath}`)
}
