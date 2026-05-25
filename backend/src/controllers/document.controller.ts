import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs/promises'
import { Op } from 'sequelize'
import { Document, Category, Tag, User, DocumentChunk } from '../models'
import { deleteFile, getFileUrl } from '../services/file.service'
import { extractDocxText, extractDocxImages, extractDocxHtml, extractPdfText, extractPdfHtml, cleanText, getDocumentTextForChunking } from '../services/extraction.service'
import { splitIntoChunks } from '../services/chunking.service'

function docToJson(doc: Document): Record<string, unknown> {
  const d = (doc.toJSON() as unknown) as Record<string, unknown>
  d.file_url = getFileUrl(d.file_path as string)
  return d
}

export async function list(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
  const { title, category_id, tags, is_featured, uploader_id } = req.query

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
    order: [['updated_at', 'DESC']],
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
    res.status(404).json({ message: '文档不存在' })
    return
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
    res.status(400).json({ message: '请选择要上传的文件' })
    return
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

  const createdDocs = []

  for (const file of files) {
    const originalname = decodeFilename(file.originalname)
    const title = files.length === 1
      ? (req.body.title || originalname)
      : `${req.body.title || '批量上传'} - ${originalname}`

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

    // ── RAG: 语义切块 ──
    chunkDocument(doc.id, doc.file_path, doc.file_type)
  }

  res.status(201).json(createdDocs)
}

// ── RAG: 文档上传后异步切块 ──

async function chunkDocument(docId: number, filePath: string, fileType: string): Promise<void> {
  try {
    const fullPath = path.resolve(__dirname, '../../', filePath)
    const text = await getDocumentTextForChunking(fullPath, fileType)
    if (!text) return

    const chunks = await splitIntoChunks(text)
    if (chunks.length === 0) return

    await Promise.all(
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

    console.log(`[RAG] 文档 ${docId} 切块完成：${chunks.length} 块`)
  } catch (err) {
    console.error(`[RAG] 文档 ${docId} 切块失败:`, (err as Error).message)
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  const doc = await Document.findByPk(Number(req.params.id))

  if (!doc) {
    res.status(404).json({ message: '文档不存在' })
    return
  }

  if (doc.uploader_id !== req.user!.id && req.user!.role !== 'admin') {
    res.status(403).json({ message: '无权删除此文档' })
    return
  }

  await deleteFile(doc.file_path)
  await doc.destroy()

  res.json({ message: '文档已删除' })
}

export async function getContent(req: Request, res: Response): Promise<void> {
  const doc = await Document.findByPk(Number(req.params.id))
  if (!doc) {
    res.status(404).json({ message: '文档不存在' })
    return
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
      res.status(400).json({ message: '不支持的文件类型' })
      return
    }

    res.json({ text, html, file_type: type, images })
  } catch (err) {
    console.error('内容提取失败:', err)
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
