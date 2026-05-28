import { Router } from 'express'
import { ask, askStream, train } from '../controllers/chat.controller'

const router = Router()

router.post('/ask', ask)
router.post('/ask/stream', askStream)
router.post('/train', train)

export default router
