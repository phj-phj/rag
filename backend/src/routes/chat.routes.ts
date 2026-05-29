import { Router } from 'express'
import { ask, askStream, train, trainStream } from '../controllers/chat.controller'

const router = Router()

router.post('/ask', ask)
router.post('/ask/stream', askStream)
router.post('/train', train)
router.post('/train/stream', trainStream)

export default router
