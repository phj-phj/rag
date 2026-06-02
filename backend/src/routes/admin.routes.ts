import { Router } from 'express'
import {
  getStats,
  getDocuments,
  updateDocument,
  replaceDocumentFile,
  deleteDocument,
  getUsers,
  updateUserPassword,
} from '../controllers/admin.controller'
import { authenticate, requireAdmin } from '../middlewares/auth'
import { uploadSingle } from '../middlewares/upload'
import { validate } from '../validators/validate'
import { updateDocSchema, updatePasswordSchema } from '../validators/admin.schema'

const router = Router()

// 所有管理接口都需鉴权
router.use(authenticate, requireAdmin)

router.get('/stats', getStats)
router.get('/documents', getDocuments)
router.put('/documents/:id', validate(updateDocSchema), updateDocument)
router.post('/documents/:id/replace', uploadSingle, replaceDocumentFile)
router.delete('/documents/:id', deleteDocument)
router.get('/users', getUsers)
router.put('/users/:id/password', validate(updatePasswordSchema), updateUserPassword)

export default router
