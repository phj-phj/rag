import { ZodSchema } from 'zod'
import { Request, Response, NextFunction } from 'express'

export function validate(
  schema: ZodSchema,
  source: 'body' | 'query' | 'params' = 'body',
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      res.status(400).json({
        message: '参数校验失败',
        errors: result.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      })
      return
    }
    if (source === 'body') req.body = result.data
    else if (source === 'query') (req as any).parsedQuery = result.data
    next()
  }
}
