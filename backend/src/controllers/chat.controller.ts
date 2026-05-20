import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs/promises'
import { Op } from 'sequelize'
import { Document } from '../models'
import { askDocument } from '../services/chat.service'
import { extractDocxText, extractPdfText } from '../services/extraction.service'

const DEFAULT_DOC_TITLE = 'JavaScript 基础'

async function getDocumentContent(doc: Document): Promise<string> {
  const fullPath = path.resolve(__dirname, '../../', doc.file_path)
  const type = doc.file_type?.toLowerCase() || ''

  if (type === 'txt' || type === 'plain') {
    return await fs.readFile(fullPath, 'utf-8')
  }
  if (type === 'pdf') {
    return await extractPdfText(fullPath)
  }
  if (type === 'docx' || type === 'doc') {
    return await extractDocxText(fullPath)
  }
  throw new Error(`不支持的文档类型: ${type}`)
}

export async function ask(req: Request, res: Response): Promise<void> {
  const { question, documentId } = req.body

  if (!question || typeof question !== 'string') {
    res.status(400).json({ message: '请输入问题' })
    return
  }

  try {
    let doc: Document | null = null

    if (documentId) {
      doc = await Document.findByPk(Number(documentId))
    } else {
      doc = await Document.findOne({ where: { title: { [Op.like]: `%${DEFAULT_DOC_TITLE}%` } } })
    }

    if (!doc) {
      res.status(404).json({ message: `未找到文档` })
      return
    }

    const content = await getDocumentContent(doc)
    const result = await askDocument(question, content)

    res.json({
      answer: result.answer,
      model: result.model,
      docId: doc.id,
      docTitle: doc.title,
    })
  } catch (err) {
    console.error('AI 问答失败:', err)
    res.status(500).json({ message: `AI 问答失败: ${(err as Error).message}` })
  }
}
