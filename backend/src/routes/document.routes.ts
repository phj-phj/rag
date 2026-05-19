import { Router } from 'express'
import { list, getById, getContent, create, remove } from '../controllers/document.controller'
import { authenticate } from '../middlewares/auth'
import { uploadMultiple } from '../middlewares/upload'

const router = Router()

router.get('/', list)
router.get('/:id/content', getContent)
router.get('/:id', getById)
router.post('/', authenticate, uploadMultiple, create)
router.delete('/:id', authenticate, remove)

export default router
