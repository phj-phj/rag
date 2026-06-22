import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs/promises'
import { Op } from 'sequelize'
import { Document, Category, Tag, User, DocumentChunk } from '../models'
import { deleteFile, getFileUrl } from '../services/file.service'
import { extractDocxText, extractDocxImages, extractDocxHtml, extractPdfText, extractPdfHtml, cleanText, getDocumentTextForChunking } from '../services/extraction.service'
import { splitIntoChunks } from '../services/chunking.service'
import { estimateTokens } from '../services/chunking.service'
import { embedTexts } from '../services/embedding.service'
import { indexChunks, ensureIndexes } from '../services/retrieval.service'
import { deleteDocumentCascade } from '../services/document-cleanup.service'
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('document')

function docToJson(doc: Document): Record<string, unknown> {
  const d = (doc.toJSON() as unknown) as Record<string, unknown>
  d.file_url = getFileUrl(d.file_path as string)
  return d
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = (req as any).parsedQuery || req.query
  const page = Number(query.page) || 1
  const pageSize = Number(query.pageSize) || 20
  const { title, category_id, tags, is_featured, uploader_id } = query

  const where: Record<string, unknown> = {}

  if (uploader_id) {
    where.uploader_id = Number(uploader_id)
  }

  if (title && typeof title === 'string') {
    where.title = { [Op.like]: `%${title}%` }
  }

  if (category_id) {
    where.category_id = Number(category_id)
  }

  if (is_featured === '1' || is_featured === 'true') {
    where.is_featured = true
  }

  let tagFilter: number[] = []
  if (tags && typeof tags === 'string') {
    tagFilter = tags.split(',').map(Number).filter(Boolean)
  }

  const include: any[] = [
    { model: User, as: 'uploader', attributes: ['id', 'username'] },
    { model: Category, as: 'category', attributes: ['id', 'name'] },
  ]

  if (tagFilter.length > 0) {
    include.push({
      model: Tag,
      as: 'tags',
      attributes: ['id', 'name'],
      where: { id: { [Op.in]: tagFilter } },
      through: { attributes: [] },
    })
  } else {
    include.push({
      model: Tag,
      as: 'tags',
      attributes: ['id', 'name'],
      through: { attributes: [] },
    })
  }

  const { count, rows } = await Document.findAndCountAll({
    where,
    include,
    order: [['created_at', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    distinct: true,
  })

  res.json({ items: rows.map(docToJson), total: count, page, pageSize })
}

export async function getById(req: Request, res: Response): Promise<void> {
  const doc = await Document.findByPk(Number(req.params.id), {
    include: [
      { model: User, as: 'uploader', attributes: ['id', 'username'] },
      { model: Category, as: 'category', attributes: ['id', 'name'] },
      { model: Tag, as: 'tags', attributes: ['id', 'name'], through: { attributes: [] } },
    ],
  } as any)

  if (!doc) {
    throw new NotFoundError('文档不存在')
  }

  res.json(docToJson(doc))
}

function decodeFilename(name: string): string {
  try {
    return Buffer.from(name, 'latin1').toString('utf8')
  } catch {
    return name
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  const files = req.files as Express.Multer.File[]
  if (!files || files.length === 0) {
    throw new BadRequestError('请选择要上传的文件')
  }

  const { category_id, tags: tagsStr } = req.body

  let tagIds: number[] = []
  if (tagsStr) {
    try {
      const parsed = typeof tagsStr === 'string' ? JSON.parse(tagsStr) : tagsStr
      tagIds = Array.isArray(parsed) ? parsed : []
    } catch { 
      tagIds = []
    }
  }

  const createdDocs: Array<Record<string, unknown>> = []

  for (const file of files) {
    const originalname = decodeFilename(file.originalname)
    const title = req.body.title || originalname

    const doc = await Document.create({
      title,
      file_type: path.extname(file.filename).slice(1) || 'unknown',
      file_size: file.size,
      file_path: `uploads/${file.filename}`,
      uploader_id: req.user!.id,
      category_id: category_id ? Number(category_id) : null,
      is_featured: false,
    } as any)

    if (tagIds.length > 0) {
      await (doc as any).setTags(tagIds)
    }

    const reloaded = await Document.findByPk(doc.id, {
      include: [
        { model: User, as: 'uploader', attributes: ['id', 'username'] },
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: Tag, as: 'tags', attributes: ['id', 'name'], through: { attributes: [] } },
      ],
    } as any)

    createdDocs.push(docToJson(reloaded!))
  }

  res.status(201).json(createdDocs)

  // 响应返回后再异步切块，不阻塞上传
  for (const doc of createdDocs) {
    chunkDocument(doc.id as number, doc.file_path as string, doc.file_type as string, doc.title as string)
  }
}

// ── RAG: 文档上传后异步切块 ──

async function chunkDocument(docId: number, filePath: string, fileType: string, docTitle?: string): Promise<void> {
  try {
    const fullPath = path.resolve(process.cwd(), filePath)
    const text = await getDocumentTextForChunking(fullPath, fileType)
    if (!text) return

    const chunks = await splitIntoChunks(text)
    if (chunks.length === 0) return

    const rows = await Promise.all(
      chunks.map(c =>
        DocumentChunk.create({
          document_id: docId,
          chunk_index: c.index,
          content: c.content,
          token_count: c.tokenCount,
          strategy: c.strategy,
          heading: c.heading,
          position_start: c.positionStart,
          position_end: c.positionEnd,
        })
      )
    )

    logger.info(`[RAG] 文档 ${docId} 切块完成：${rows.length} 块`)

    // 向量化 + 写入 LanceDB（不阻塞后续流程）
    try {
      const texts = rows.map(r => r.content)
      const embeddings = await embedTexts(texts)
      await indexChunks(
        rows.map((r, i) => ({
          id: r.id,
          document_id: docId,
          content: r.content,
          embedding: embeddings[i],
          documentTitle: docTitle || '',
        }))
      )
      logger.info(`[RAG] 文档 ${docId} 向量化+索引完成：${embeddings.length} 个向量`)
    } catch (err) {
      logger.error(`[RAG] 文档 ${docId} 向量化失败（题目管道继续执行）:`, (err as Error).message)
    }

    // ── 文档类型检测 + 题目提取/预生成 ──
    const qStart = Date.now()
    logger.info(`[题目管道] ═══ 文档${docId} 开始题目处理 ═══`)
    logger.info(`[题目管道]   文本长度: ${text.length} 字符 | 估算token: ${estimateTokens(text)}`)
    try {
      const { detectDocumentType } = await import('../services/document-classifier.service')
      const { extractQuestionsFromDocument } = await import('../services/question-extraction.service')
      const { preGenerateQuestions } = await import('../services/question-generation.service')

      const docType = await detectDocumentType(text)
      logger.info(`[题目管道]   分类结果: ${docType} (耗时${Date.now() - qStart}ms)`)

      if (docType === 'question_bank') {
        const count = await extractQuestionsFromDocument(docId, filePath, fileType)
        logger.info(`[题目管道] ═══ 文档${docId} 题目提取完成: ${count}题 | 总耗时${Date.now() - qStart}ms ═══`)
      } else {
        const tokenCount = estimateTokens(text)
        if (tokenCount >= 100) {
          const count = await preGenerateQuestions(docId, filePath, fileType)
          logger.info(`[题目管道] ═══ 文档${docId} 题目预生成完成: ${count}题 | 总耗时${Date.now() - qStart}ms ═══`)
        } else {
          logger.info(`[题目管道] ═══ 文档${docId} 文本太短(<100 tokens)，跳过预生成 | 耗时${Date.now() - qStart}ms ═══`)
        }
      }
    } catch (err) {
      logger.error(`[题目管道] 处理失败 (文档${docId}):`, (err as Error).message)
      logger.error(`[题目管道] 错误堆栈:`, (err as Error).stack?.slice(0, 300))
    }
  } catch (err) {
    logger.error(`[RAG] 文档 ${docId} 切块失败:`, (err as Error).message)
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  const doc = await Document.findByPk(Number(req.params.id))

  if (!doc) {
    throw new NotFoundError('文档不存在')
  }

  if (doc.uploader_id !== req.user!.id && req.user!.role !== 'admin') {
    throw new ForbiddenError('无权删除此文档')
  }

  await deleteDocumentCascade(doc.id, doc.file_path)
  await doc.destroy()

  res.json({ message: '文档已删除' })
}

export async function getContent(req: Request, res: Response): Promise<void> {
  const doc = await Document.findByPk(Number(req.params.id))
  if (!doc) {
    throw new NotFoundError('文档不存在')
  }

  const fullPath = path.resolve(__dirname, '../../', doc.file_path)
  const ext = path.extname(doc.file_path).toLowerCase()
  const type = doc.file_type?.toLowerCase() || ext.slice(1)

  try {
    let text = ''
    let html = ''
    let images: string[] = []

    if (type === 'txt' || type === 'plain') {
      text = cleanText(await fs.readFile(fullPath, 'utf-8'))
    } else if (type === 'pdf') {
      html = await extractPdfHtml(fullPath)
      text = await extractPdfText(fullPath)
    } else if (type === 'docx' || type === 'doc') {
      html = await extractDocxHtml(fullPath)
      images = await extractDocxImages(fullPath)
      text = await extractDocxText(fullPath) // AI 问答仍需文字
    } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'tif'].includes(type)) {
      text = '' // 图片直接展示
    } else {
      throw new BadRequestError('不支持的文件类型')
    }

    res.json({ text, html, file_type: type, images })
  } catch (err) {
    logger.error('内容提取失败:', err)
    res.status(500).json({ message: '文件内容提取失败' })
  }
}

// ── RAG 调试：查看文档切块结果 ──

export async function getChunks(req: Request, res: Response): Promise<void> {
  const doc = await Document.findByPk(Number(req.params.id), {
    attributes: ['id', 'title'],
  })
  if (!doc) {
    res.status(404).json({ message: '文档不存在' })
    return
  }

  
  const chunks = await DocumentChunk.findAll({
    where: { document_id: doc.id },
    order: [['chunk_index', 'ASC']],
  })

  res.json({
    document: { id: doc.id, title: doc.title },
    totalChunks: chunks.length,
    chunks: chunks.map(c => ({
      index: c.chunk_index,
      content: c.content,
      preview: c.content.slice(0, 100),
      tokenCount: c.token_count,
      heading: c.heading,
      position: `${c.position_start}-${c.position_end}`,
      strategy: c.strategy,
    })),
  })
}
