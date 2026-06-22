import dotenv from 'dotenv'
import { User, Category, Tag } from '../../models'
import sequelize from '../../config/database'
import bcrypt from 'bcryptjs'

dotenv.config()

process.env.NODE_ENV = 'test'
process.env.DB_NAME = 'papier_test'
process.env.DEBUG_AI = 'false'

let initPromise: Promise<void> | null = null

export async function initTestDb(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    await sequelize.sync({ force: true })

    const hash = await bcrypt.hash('admin123', 10)
    await User.create({ username: 'admin', password: hash, role: 'admin' })
    await User.create({ username: 'user', password: hash, role: 'user' })
    await Category.create({ id: 1, name: '技术文档' })
    await Tag.create({ id: 1, name: 'JavaScript' })
  })()
  return initPromise
}
