import { Router } from 'express'
import { authenticate } from '../middlewares/auth'
import { validate } from '../validators/validate'
import {
  generateSchema,
  recordSchema,
  difficultySchema,
} from '../validators/training.schema'
import {
  listQuestions,
  questionStats,
  generate,
  generateStream,
  record,
  voteDifficulty,
  getReview,
} from '../controllers/training.controller'

const router = Router()

router.get('/questions', listQuestions)
router.get('/questions/stats', questionStats)
router.post('/generate', validate(generateSchema), generate)
router.post('/generate/stream', validate(generateSchema), generateStream)
router.post('/record', authenticate, validate(recordSchema), record)
router.post('/difficulty', authenticate, validate(difficultySchema), voteDifficulty)
router.get('/review', authenticate, getReview)

export default router
