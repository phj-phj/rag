import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { login, register } from '../controllers/auth.controller'
import { validate } from '../validators/validate'
import { loginSchema, registerSchema } from '../validators/auth.schema'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: '登录尝试过于频繁，请1分钟后再试' },
})

const registerLimiter = rateLimit({
  windowMs: 60_000,
  max: 3,
  message: { message: '注册过于频繁，请稍后再试' },
})

router.post('/login', validate(loginSchema), loginLimiter, login)
router.post('/register', validate(registerSchema), registerLimiter, register)

export default router
