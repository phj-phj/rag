import { Router } from 'express'
import { ask, askStream, train, trainStream } from '../controllers/chat.controller'
import { validate } from '../validators/validate'
import { askSchema, trainSchema } from '../validators/chat.schema'

const router = Router()

router.post('/ask', validate(askSchema), ask)
router.post('/ask/stream', validate(askSchema), askStream)
router.post('/train', validate(trainSchema), train)
router.post('/train/stream', validate(trainSchema), trainStream)

export default router
