import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import env from '../config/env'
import { User } from '../models'
import { UnauthorizedError } from '../utils/errors'

const isProduction = process.env.NODE_ENV === 'production'

function setTokenCookie(res: Response, token: string): void {
  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
    path: '/',
  })
}

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body

  const user = await User.findOne({ where: { username } })
  if (!user) {
    throw new UnauthorizedError('用户名或密码错误')
  }

  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) {
    throw new UnauthorizedError('用户名或密码错误')
  }

  const payload = { id: user.id, username: user.username, role: user.role }
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as any)

  setTokenCookie(res, token)

  res.json({
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  })
}

export async function register(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body

  const existing = await User.findOne({ where: { username } })
  if (existing) {
    res.status(409).json({ message: '用户名已被注册' })
    return
  }

  const hashedPassword = await bcrypt.hash(password, 10)
  const user = await User.create({
    username,
    password: hashedPassword,
    role: 'user',
  })

  const payload = { id: user.id, username: user.username, role: user.role }
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as any)

  setTokenCookie(res, token)

  res.status(201).json({
    message: '注册成功',
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  })
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await User.findByPk(req.user!.id, {
    attributes: ['id', 'username', 'role'],
  })
  if (!user) {
    throw new UnauthorizedError('用户不存在')
  }
  res.json({ user })
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  })
  res.json({ message: '已登出' })
}
