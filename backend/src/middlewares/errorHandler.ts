import { Request, Response, NextFunction } from 'express'
import { AppError } from '../utils/errors'
import { logger } from '../utils/logger'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message },
    })
    return
  }

  logger.error({
    message: 'unhandled error',
    requestId: req.headers['x-request-id'] || '',
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
  })

  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: '服务器内部错误，请稍后重试' },
  })
}
