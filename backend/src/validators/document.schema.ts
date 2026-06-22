import { z } from 'zod'

export const listDocSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  title: z.string().max(200).optional(),
  category_id: z.coerce.number().int().positive().optional(),
  tags: z.string().max(500).optional(),
  is_featured: z.enum(['0', '1', 'true', 'false']).optional(),
  uploader_id: z.coerce.number().int().positive().optional(),
})
