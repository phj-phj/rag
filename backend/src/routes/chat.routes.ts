import { Router } from 'express'
import { ask, askStream } from '../controllers/chat.controller'

const router = Router()

router.post('/ask', ask)
router.post('/ask/stream', askStream)

export default router
