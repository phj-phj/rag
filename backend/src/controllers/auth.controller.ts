import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import env from '../config/env'
import { User } from '../models'

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body

  if (!username || !password) {
    res.status(400).json({ message: '用户名和密码不能为空' })
    return
  }

  const user = await User.findOne({ where: { username } })
  if (!user) {
    res.status(401).json({ message: '用户名或密码错误' })
    return
  }

  const isValid = await bcrypt.compare(password, user.password)
  if (!isValid) {
    res.status(401).json({ message: '用户名或密码错误' })
    return
  }

  const payload = { id: user.id, username: user.username, role: user.role }
  const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as any)

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  })
}

export async function register(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body

  if (!username || !password) {
    res.status(400).json({ message: '用户名和密码不能为空' })
    return
  }

  if (username.length < 3 || username.length > 50) {
    res.status(400).json({ message: '用户名长度需要在3-50个字符之间' })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ message: '密码长度不能少于6位' })
    return
  }

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

  res.status(201).json({
    message: '注册成功',
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  })
}
