import { z } from 'zod'

export const updateDocSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  category_id: z.number().int().positive().nullable().optional(),
  tags: z.array(z.number().int().positive()).optional(),
})

export const updatePasswordSchema = z.object({
  password: z.string().min(6, '密码至少6位').max(128, '密码最多128位'),
})
