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

const router = Router()

router.use(authenticate, requireAdmin)

router.get('/stats', getStats)
router.get('/documents', getDocuments)
router.put('/documents/:id', updateDocument)
router.post('/documents/:id/replace', uploadSingle, replaceDocumentFile)
router.delete('/documents/:id', deleteDocument)
router.get('/users', getUsers)
router.put('/users/:id/password', updateUserPassword)

export default router
