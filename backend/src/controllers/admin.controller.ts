import { Request, Response } from 'express'
import { Op } from 'sequelize'
import bcrypt from 'bcryptjs'
import { Document, Category, Tag, User } from '../models'
import { deleteFile, getFileUrl } from '../services/file.service'

function docToJson(doc: Document): Record<string, unknown> {
  const d = (doc.toJSON() as unknown) as Record<string, unknown>
  d.file_url = getFileUrl(d.file_path as string)
  return d
}

export async function getStats(_req: Request, res: Response): Promise<void> {
  const totalDocs = await Document.count()
  const totalCategories = await Category.count()
  const totalUsers = await User.count()

  const categories = await Category.findAll({ order: [['id', 'ASC']] })
  const categoryStats: { category_id: number | null; category_name: string; count: number }[] = await Promise.all(
    categories.map(async (cat) => {
      const count = await Document.count({ where: { category_id: cat.id } })
      return { category_id: cat.id, category_name: cat.name, count }
    })
  )
  const uncategorizedCount = await Document.count({ where: { category_id: null } })
  if (uncategorizedCount > 0) {
    categoryStats.push({ category_id: null as number | null, category_name: '未分类', count: uncategorizedCount })
  }

  const last7Days: { date: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    const count = await Document.count({
      where: {
        created_at: {
          [Op.gte]: `${dateStr} 00:00:00`,
          [Op.lt]: `${dateStr} 23:59:59`,
        },
      },
    }) as number
    last7Days.push({ date: dateStr, count })
  }

  const recentActivities = await Document.findAll({
    include: [{ model: User, as: 'uploader', attributes: ['id', 'username'] }],
    order: [['created_at', 'DESC']],
    limit: 10,
  })

  res.json({
    totalDocs,
    totalCategories,
    totalUsers,
    categoryStats,
    uploadTrend: last7Days,
    recentActivities: recentActivities.map((d) => {
      const doc = d.toJSON() as any
      return {
        id: doc.id,
        title: doc.title,
        file_type: doc.file_type,
        uploader: doc.uploader?.username,
        created_at: doc.created_at,
      }
    }),
  })
}

export async function getDocuments(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))
  const { title, category_id, tags } = req.query

  const where: Record<string, unknown> = {}

  if (title && typeof title === 'string') {
    where.title = { [Op.like]: `%${title}%` }
  }
  if (category_id) {
    where.category_id = Number(category_id)
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
  } as any)

  res.json({ items: rows.map(docToJson), total: count, page, pageSize })
}

export async function updateDocument(req: Request, res: Response): Promise<void> {
  const doc = await Document.findByPk(Number(req.params.id))
  if (!doc) {
    res.status(404).json({ message: '文档不存在' })
    return
  }

  const { title, category_id, tags } = req.body

  if (title !== undefined) doc.title = title
  if (category_id !== undefined) doc.category_id = Number(category_id)

  await doc.save()

  if (tags !== undefined) {
    const tagIds: number[] = Array.isArray(tags) ? tags : []
    await (doc as any).setTags(tagIds)
  }

  const reloaded = await Document.findByPk(doc.id, {
    include: [
      { model: User, as: 'uploader', attributes: ['id', 'username'] },
      { model: Category, as: 'category', attributes: ['id', 'name'] },
      { model: Tag, as: 'tags', attributes: ['id', 'name'], through: { attributes: [] } },
    ],
  } as any)

  res.json(docToJson(reloaded!))
}

export async function replaceDocumentFile(req: Request, res: Response): Promise<void> {
  const doc = await Document.findByPk(Number(req.params.id))
  if (!doc) {
    res.status(404).json({ message: '文档不存在' })
    return
  }

  const file = req.file
  if (!file) {
    res.status(400).json({ message: '请选择要替换的文件' })
    return
  }

  await deleteFile(doc.file_path)

  doc.file_path = `uploads/${file.filename}`
  doc.file_size = file.size
  doc.file_type = file.mimetype.split('/')[1] || 'unknown'
  await doc.save()

  const reloaded = await Document.findByPk(doc.id, {
    include: [
      { model: User, as: 'uploader', attributes: ['id', 'username'] },
      { model: Category, as: 'category', attributes: ['id', 'name'] },
      { model: Tag, as: 'tags', attributes: ['id', 'name'], through: { attributes: [] } },
    ],
  } as any)

  res.json(docToJson(reloaded!))
}

export async function deleteDocument(req: Request, res: Response): Promise<void> {
  const doc = await Document.findByPk(Number(req.params.id))
  if (!doc) {
    res.status(404).json({ message: '文档不存在' })
    return
  }

  await deleteFile(doc.file_path)
  await doc.destroy()

  res.json({ message: '文档已删除' })
}

export async function getUsers(req: Request, res: Response): Promise<void> {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20))

  const { count, rows } = await User.findAndCountAll({
    attributes: { exclude: ['password'] },
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: [['created_at', 'DESC']],
  })

  const usersWithCounts = await Promise.all(
    rows.map(async (user) => {
      const docCount = await Document.count({ where: { uploader_id: user.id } })
      return { ...user.toJSON(), document_count: docCount }
    })
  )

  res.json({ items: usersWithCounts, total: count, page, pageSize })
}

export async function updateUserPassword(req: Request, res: Response): Promise<void> {
  const user = await User.findByPk(Number(req.params.id))
  if (!user) {
    res.status(404).json({ message: '用户不存在' })
    return
  }

  const { password } = req.body
  if (!password || password.length < 6) {
    res.status(400).json({ message: '密码长度不能少于6位' })
    return
  }

  user.password = await bcrypt.hash(password, 10)
  await user.save()

  res.json({ message: '密码已更新' })
}
