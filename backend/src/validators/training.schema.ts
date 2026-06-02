import { z } from 'zod'

export const generateSchema = z.object({
  topic: z.string().max(200).optional(),
  count: z.number().int().min(1).max(50).default(10),
  difficulty: z.number().int().min(1).max(5).optional(),
})

export const recordSchema = z.object({
  questionId: z.number().int().positive(),
  status: z.enum(['mastered', 'review']),
})

export const difficultySchema = z.object({
  questionId: z.number().int().positive(),
  level: z.number().int().min(1).max(5),
})
