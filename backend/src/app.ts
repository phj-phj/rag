import express from 'express'
import cors from 'cors'
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
import { compactTable } from './services/retrieval.service'

dotenv.config()

defineAssociations()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')))

app.use('/api/auth', authRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/favorites', favoriteRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/tags', tagRoutes)
app.use('/api/chat', chatRoutes)

app.get('/', (_req, res) => {
  res.json({ message: 'Papier API 服务运行中' })
})

sequelize.authenticate()
  .then(() => {
    console.log('数据库连接成功')
    return sequelize.sync()
  })
  .then(() => {
    console.log('数据库表同步完成')
    // 启动时清理 LanceDB 旧版本
    compactTable().catch(e => console.warn('LanceDB compact 跳过:', (e as Error).message))
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`)
    })
  })
  .catch((err) => {
    console.error('启动失败:', err)
  })

export default app
