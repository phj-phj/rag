import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符'),
  password: z.string().min(6, '密码至少6位').max(128, '密码最多128位'),
})

export const registerSchema = loginSchema
