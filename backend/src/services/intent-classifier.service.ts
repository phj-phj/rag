const DATA_KEYWORDS = [
  '统计', '多少', '共有', '排名', '哪些人', '什么时候',
  '谁上传', '分类', '标签', '数量', '一共', '最大',
  '最小', '平均', '有几', '哪个', '份', '个文档',
  '最多', '最少', '总共', '列出', '查询',
]

export function classifyIntent(question: string): 'data_query' | 'document_question' {
  const q = question.toLowerCase()
  const hits = DATA_KEYWORDS.filter(k => q.includes(k)).length
  return hits >= 2 ? 'data_query' : 'document_question'
}
