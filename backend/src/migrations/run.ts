import sequelize from '../config/database'

async function migrate() {
  await sequelize.authenticate()
  console.log('[migrate] 数据库已连接')

  const query = sequelize.query.bind(sequelize)

  // 001: Questions
  await query(`
    CREATE TABLE IF NOT EXISTS Questions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stem TEXT NOT NULL,
      explanation TEXT NOT NULL,
      type ENUM('essay') DEFAULT 'essay',
      difficulty TINYINT,
      difficulty_votes JSON,
      knowledge_point VARCHAR(200),
      source_type ENUM('extracted', 'ai_pregenerated', 'ai_adhoc') NOT NULL,
      source_document_id INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_q_kp (knowledge_point),
      INDEX idx_q_source_type (source_type),
      INDEX idx_q_source_doc (source_document_id),
      FULLTEXT INDEX idx_q_ft (stem)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  console.log('[migrate] Questions 表已就绪')

  // 002: PracticeRecords
  await query(`
    CREATE TABLE IF NOT EXISTS PracticeRecords (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      question_id INT NOT NULL,
      status ENUM('mastered', 'review') NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pr_user (user_id),
      INDEX idx_pr_question (question_id),
      UNIQUE INDEX idx_pr_user_question (user_id, question_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `)
  console.log('[migrate] PracticeRecords 表已就绪')

  console.log('[migrate] 迁移完成')
  process.exit(0)
}

migrate().catch((err) => {
  console.error('[migrate] 迁移失败:', err)
  process.exit(1)
})
