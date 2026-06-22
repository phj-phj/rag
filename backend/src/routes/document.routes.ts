import { Router } from 'express'
import { list, getById, getContent, create, remove, getChunks } from '../controllers/document.controller'
import { authenticate } from '../middlewares/auth'
import { uploadMultiple } from '../middlewares/upload'
import { validate } from '../validators/validate'
import { listDocSchema } from '../validators/document.schema'

const router = Router()

router.get('/', validate(listDocSchema, 'query'), list)
router.get('/:id/content', getContent)
router.get('/:id/chunks', getChunks)
router.get('/:id', getById)
router.post('/', authenticate, uploadMultiple, create)
router.delete('/:id', authenticate, remove)

export default router
