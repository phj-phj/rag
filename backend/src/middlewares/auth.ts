import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import env from '../config/env'
import { UnauthorizedError, ForbiddenError } from '../utils/errors'

interface JwtPayload {
  id: number
  username: string
  role: 'user' | 'admin'
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  // 优先从 httpOnly cookie 读，fallback 到 Authorization header（向后兼容）
  let token = req.cookies?.token
  if (!token) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('未提供认证令牌')
    }
    token = authHeader.split(' ')[1]
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload
    req.user = decoded
    next()
  } catch {
    throw new UnauthorizedError('认证令牌无效或已过期')
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    throw new ForbiddenError('无权访问，需要管理员权限')
  }
  next()
}
