const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('缺少必需的环境变量 JWT_SECRET，请在 .env 文件或 Docker 环境变量中设置')
}

export default {
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  PORT: Number(process.env.PORT) || 3000,
}
