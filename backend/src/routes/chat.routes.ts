import { Router } from 'express'
import { ask, askStream, train, trainStream } from '../controllers/chat.controller'
import { authenticate } from '../middlewares/auth'
import { validate } from '../validators/validate'
import { askSchema, trainSchema } from '../validators/chat.schema'

const router = Router()

router.post('/ask', authenticate, validate(askSchema), ask)
router.post('/ask/stream', authenticate, validate(askSchema), askStream)
router.post('/train', authenticate, validate(trainSchema), train)
router.post('/train/stream', authenticate, validate(trainSchema), trainStream)

export default router
