import bcrypt from 'bcryptjs'
import sequelize from './config/database'
import { defineAssociations, User, Category, Tag } from './models'

defineAssociations()

async function seed(): Promise<void> {
  await sequelize.sync({ force: true })
  console.log('数据库表已重新创建')

  const categories = await Category.bulkCreate([
    { name: '技术文档' },
    { name: '产品需求' },
    { name: '会议纪要' },
    { name: '设计规范' },
    { name: '周报月报' },
  ])
  console.log('默认分类已创建')

  const adminHash = await bcrypt.hash('admin123', 10)
  const userHash = await bcrypt.hash('user123', 10)

  await User.bulkCreate([
    { username: 'admin', password: adminHash, role: 'admin' },
    { username: 'user', password: userHash, role: 'user' },
  ])
  console.log('默认用户已创建 (admin/admin123, user/user123)')

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
  console.log('默认标签已创建')

  console.log('种子数据初始化完成')
  process.exit(0)
}

seed().catch((err) => {
  console.error('种子数据初始化失败:', err)
  process.exit(1)
})
