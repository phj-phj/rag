import { Router } from 'express'
import { list, add, remove, toggle } from '../controllers/favorite.controller'
import { authenticate } from '../middlewares/auth'

const router = Router()

router.use(authenticate)
router.get('/', list)
router.post('/', add)
router.post('/toggle/:documentId', toggle)
router.delete('/:documentId', remove)

export default router
