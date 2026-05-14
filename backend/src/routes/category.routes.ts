import { Router, Request, Response } from 'express'
import { Category } from '../models'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const categories = await Category.findAll({ order: [['id', 'ASC']] })
  res.json(categories)
})

export default router
