import { z } from 'zod'

export const askSchema = z.object({
  question: z.string().min(1, '请输入问题').max(5000, '问题不能超过5000字'),
  documentId: z.number().int().positive().optional(),
})

export const trainSchema = z.object({
  question: z.string().min(1, '请输入出题需求').max(2000, '需求描述过长'),
})
