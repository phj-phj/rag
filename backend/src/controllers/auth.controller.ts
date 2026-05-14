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
