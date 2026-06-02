import { Request, Response } from 'express'
import { Document, Favorite, User, Category, Tag } from '../models'
import { getFileUrl } from '../services/file.service'
import { NotFoundError, BadRequestError } from '../utils/errors'

function docToJson(doc: Document): Record<string, unknown> {
  const d = (doc.toJSON() as unknown) as Record<string, unknown>
  d.file_url = getFileUrl(d.file_path as string)
  return d
}

export async function list(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))

  const { count, rows } = await Document.findAndCountAll({
    include: [
      {
        model: User,
        as: 'favoritedBy',
        where: { id: req.user!.id },
        attributes: [],
        through: { attributes: [] },
      },
      { model: User, as: 'uploader', attributes: ['id', 'username'] },
      { model: Category, as: 'category', attributes: ['id', 'name'] },
      { model: Tag, as: 'tags', attributes: ['id', 'name'], through: { attributes: [] } },
    ] as any,
    order: [['updated_at', 'DESC']],
    limit: pageSize,
    offset: (page - 1) * pageSize,
    distinct: true,
  })

  res.json({ items: rows.map(docToJson), total: count, page, pageSize })
}

export async function add(req: Request, res: Response): Promise<void> {
  const documentId = Number(req.params.documentId) || Number(req.body.document_id)
  if (!documentId) {
    throw new BadRequestError('请指定文档ID')
  }

  const doc = await Document.findByPk(documentId)
  if (!doc) {
    throw new NotFoundError('文档不存在')
  }

  await Favorite.findOrCreate({
    where: { user_id: req.user!.id, document_id: documentId },
  })

  res.json({ message: '已收藏', favorited: true })
}

export async function remove(req: Request, res: Response): Promise<void> {
  const documentId = Number(req.params.documentId)

  await Favorite.destroy({
    where: { user_id: req.user!.id, document_id: documentId },
  })

  res.json({ message: '已取消收藏', favorited: false })
}

export async function toggle(req: Request, res: Response): Promise<void> {
  const documentId = Number(req.params.documentId)

  const existing = await Favorite.findOne({
    where: { user_id: req.user!.id, document_id: documentId },
  })

  if (existing) {
    await existing.destroy()
    res.json({ favorited: false })
  } else {
    await Favorite.create({ user_id: req.user!.id, document_id: documentId })
    res.json({ favorited: true })
  }
}
