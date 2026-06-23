const mysql = require('mysql2/promise')

async function main() {
  const conn = await mysql.createConnection({
    host: 'mysql',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: 'papier',
  })
  try {
    const [rows] = await conn.execute('SELECT 1 FROM Users LIMIT 1')
    console.log('数据库已存在，跳过 seed')
    process.exit(1) // 信号：跳过
  } catch {
    console.log('首次启动，初始化数据库...')
    process.exit(0) // 信号：执行 seed
  } finally {
    await conn.end()
  }
}
main()
