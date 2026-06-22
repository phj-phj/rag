import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID().slice(0, 8)
  req.headers['x-request-id'] = id
  res.setHeader('X-Request-Id', id)

  const start = Date.now()
  res.on('finish', () => {
    logger.info({
      requestId: id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
    })
  })

  next()
}
