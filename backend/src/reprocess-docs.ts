import dotenv from 'dotenv'
dotenv.config()

import sequelize from './config/database'
import { defineAssociations, Document } from './models'

defineAssociations()

async function reprocess() {
  await sequelize.authenticate()
  console.log('[reprocess] 数据库已连接')

  const docs = await Document.findAll({ order: [['id', 'ASC']] })
  console.log(`[reprocess] 共 ${docs.length} 个文档待处理`)

  const { detectDocumentType } = await import('./services/document-classifier.service')
  const { extractQuestionsFromDocument } = await import('./services/question-extraction.service')
  const { preGenerateQuestions } = await import('./services/question-generation.service')
  const { getDocumentTextForChunking } = await import('./services/extraction.service')
  const { estimateTokens } = await import('./services/chunking.service')

  for (const doc of docs) {
    const filePath = (doc.file_path ?? '') as string
    const fileType = (doc.file_type ?? '') as string
    const fullPath = require('path').resolve(process.cwd(), filePath as string)

    let text: string | null
    try {
      text = await getDocumentTextForChunking(fullPath, fileType as string)
    } catch (err) {
      console.warn(`[reprocess] 文档${doc.id} "${doc.title}" 文本提取失败，跳过`)
      continue
    }

    if (!text || text.trim().length < 50) {
      console.log(`[reprocess] 文档${doc.id} "${doc.title}" 文本太短，跳过`)
      continue
    }

    try {
      const docType = await detectDocumentType(text)
      console.log(`[reprocess] 文档${doc.id} "${doc.title}" → ${docType}`)

      if (docType === 'question_bank') {
        const count = await extractQuestionsFromDocument(doc.id, filePath, fileType)
        console.log(`  ↳ 提取了 ${count} 道题`)
      } else {
        const tokenCount = estimateTokens(text)
        if (tokenCount >= 100) {
          const count = await preGenerateQuestions(doc.id, filePath, fileType)
          console.log(`  ↳ 预生成 ${count} 道题`)
        }
      }
    } catch (err) {
      console.error(`[reprocess] 文档${doc.id} 处理失败:`, (err as Error).message)
    }
  }

  console.log('[reprocess] 完成')
  process.exit(0)
}

reprocess().catch((err) => {
  console.error('[reprocess] 失败:', err)
  process.exit(1)
})
