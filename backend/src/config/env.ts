import dotenv from 'dotenv'
dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET || JWT_SECRET === 'change-me-to-a-random-string') {
  throw new Error('请先配置 JWT_SECRET：复制 .env.example 为 .env，然后修改 JWT_SECRET 为随机字符串')
}

export default {
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  PORT: Number(process.env.PORT) || 3000,
}
