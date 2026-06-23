import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import path from 'path'
import sequelize from './config/database'
import { defineAssociations } from './models'
import authRoutes from './routes/auth.routes'
import documentRoutes from './routes/document.routes'
import favoriteRoutes from './routes/favorite.routes'
import adminRoutes from './routes/admin.routes'
import categoryRoutes from './routes/category.routes'
import tagRoutes from './routes/tag.routes'
import chatRoutes from './routes/chat.routes'
import trainingRoutes from './routes/training.routes'
import { compactTable, ensureIndexes } from './services/retrieval.service'
import { requestId } from './middlewares/requestId'
import { errorHandler } from './middlewares/errorHandler'
import { logger } from './utils/logger'
import swaggerUi from 'swagger-ui-express'
import swaggerSpec from './config/swagger'

dotenv.config()

// 最早期的日志：解决 502 无法排查的问题
console.log(`[启动] ${new Date().toISOString()} 进程开始，日志目录: ${path.resolve('logs')}`)

defineAssociations()

const app = express()
app.set('trust proxy', 1)
const PORT = process.env.PORT || 3000

app.use(requestId)
app.use((req, _res, next) => {
  if (req.path.includes('/api/documents') && req.method === 'POST') {
    logger.info(`[debug] upload request: Content-Length=${req.headers['content-length']}, Content-Type=${req.headers['content-type']}`)
  }
  next()
})
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
app.use((req, _res, next) => {
  // multipart 上传绕过 Express body parser 的 size 检查
  if (req.headers['content-type']?.startsWith('multipart/form-data')) return next()
  express.json({ limit: '50mb' })(req, _res, next)
})
app.use((req, _res, next) => {
  if (req.headers['content-type']?.startsWith('multipart/form-data')) return next()
  express.urlencoded({ extended: true, limit: '50mb' })(req, _res, next)
})
app.use(cookieParser())

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/favorites', favoriteRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/tags', tagRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/training', trainingRoutes)

app.get('/health', async (_req, res) => {
  try {
    await sequelize.authenticate()
    res.json({ status: 'ok', mysql: 'connected', uptime: process.uptime() })
  } catch {
    res.status(503).json({ status: 'error', mysql: 'disconnected' })
  }
})

app.get('/', (_req, res) => {
  res.json({ message: 'Papier API 服务运行中' })
})

app.use(errorHandler)

if (process.env.NODE_ENV !== 'test') {
  // 兜底：进程崩溃前强制写日志
  process.on('uncaughtException', (err) => {
    logger.error('未捕获异常，进程即将退出:', err)
    console.error('未捕获异常:', err)
    setTimeout(() => process.exit(1), 500) // 给 winston 一点时间刷盘
  })
  process.on('unhandledRejection', (reason) => {
    logger.error('未处理的 Promise 拒绝:', reason)
    console.error('未处理的 Promise 拒绝:', reason)
  })

  sequelize.authenticate()
    .then(() => {
      logger.info('数据库连接成功')
      return sequelize.sync()
    })
    .then(() => {
      logger.info('数据库表同步完成')
      // 启动时顺序建立索引 + 清理（避免并发冲突）
      ensureIndexes()
        .then(() => new Promise(r => setTimeout(r, 500)))
        .then(() => compactTable())
        .catch(e => logger.warn('LanceDB 初始化跳过:', (e as Error).message))
        .finally(() => {
          const server = app.listen(PORT, () => {
            logger.info(`服务器运行在 http://localhost:${PORT}`)
          })
          server.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
              logger.error(`端口 ${PORT} 被占用，请先关闭占用进程`)
            } else {
              logger.error('服务器启动错误:', err)
            }
            process.exit(1)
          })
        })
    })
    .catch((err) => {
      logger.error('启动失败:', err)
      console.error('启动失败:', err)
      process.exit(1)
    })
}

export default app
