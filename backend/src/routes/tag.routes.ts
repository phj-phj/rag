import { Router, Request, Response } from 'express'
import { Tag } from '../models'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const tags = await Tag.findAll({ order: [['id', 'ASC']] })
  res.json(tags)
})

export default router
