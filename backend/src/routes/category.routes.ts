import { Router, Request, Response } from 'express'
import { Category, Document } from '../models'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const categories = await Category.findAll({ order: [['id', 'ASC']] })
  const result = await Promise.all(
    categories.map(async (cat) => {
      const docCount = await Document.count({ where: { category_id: cat.id } })
      return { ...cat.toJSON(), docCount }
    })
  )
  res.json(result)
})

export default router
