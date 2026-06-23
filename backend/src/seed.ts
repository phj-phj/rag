import bcrypt from 'bcryptjs'
import dotenv from 'dotenv'
import sequelize from './config/database'
import { defineAssociations, User, Category, Tag } from './models'
import { createModuleLogger } from './utils/logger'

dotenv.config()

const logger = createModuleLogger('seed')

defineAssociations()

async function seed(): Promise<void> {
  await sequelize.sync({ force: true })
  logger.info('数据库表已重新创建')

  const categories = await Category.bulkCreate([
    { name: '技术文档' },
    { name: '产品需求' },
    { name: '会议纪要' },
    { name: '设计规范' },
    { name: '周报月报' },
  ])
  logger.info('默认分类已创建')

  const adminUsername = process.env.ADMIN_USERNAME || 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'change_me_admin'
  const userUsername = process.env.USER_USERNAME || 'user'
  const userPassword = process.env.USER_PASSWORD || 'change_me_user'

  const adminHash = await bcrypt.hash(adminPassword, 10)
  const userHash = await bcrypt.hash(userPassword, 10)

  await User.bulkCreate([
    { username: adminUsername, password: adminHash, role: 'admin' },
    { username: userUsername, password: userHash, role: 'user' },
  ])
  logger.info(`默认用户已创建 (${adminUsername} / ${userUsername})`)

  await Tag.bulkCreate([
    { name: 'JavaScript' },
    { name: 'TypeScript' },
    { name: 'Vue' },
    { name: 'Node.js' },
    { name: '数据库' },
    { name: '部署' },
    { name: '设计' },
    { name: '入门' },
  ])
  logger.info('默认标签已创建')

  logger.info('种子数据初始化完成')
  process.exit(0)
}

seed().catch((err) => {
  logger.error('种子数据初始化失败:', err)
  process.exit(1)
})
