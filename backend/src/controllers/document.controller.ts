import { Request, Response } from 'express'
import { Op } from 'sequelize'
import { Document, Category, Tag, User } from '../models'
import { deleteFile, getFileUrl } from '../services/file.service'

function docToJson(doc: Document): Record<string, unknown> {
  const d = (doc.toJSON() as unknown) as Record<string, unknown>
  d.file_url = getFileUrl(d.file_path as string)
  return d
}

export async function list(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
  const { title, category_id, tags, is_featured } = req.query

  const where: Record<string, unknown> = {}

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
    const title = files.length === 1
      ? (req.body.title || file.originalname)
      : `${req.body.title || '批量上传'} - ${file.originalname}`

    const doc = await Document.create({
      title,
      file_type: file.mimetype.split('/')[1] || 'unknown',
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
