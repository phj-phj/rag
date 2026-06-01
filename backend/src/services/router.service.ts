// ── 简单/复杂问题判别（纯规则，零延迟）──

const SIMPLE_KW = ['多少', '列出', '什么时候', '谁', '哪个', '是什么', '什么是', '定义', '什么叫', '怎么用']
const COMPLEX_KW = ['分析', '总结', '对比', '区别', '为什么', '原理', '机制', '关系', '优缺点', '应用场景']

export interface RouteDecision {
  verdict: 'fast' | 'deep'
  score: number
  reason: string
}

export function routeQuery(question: string): RouteDecision {
  let score = 0
  const reasons: string[] = []

  // 1. 关键词
  for (const kw of SIMPLE_KW) {
    if (question.includes(kw)) { score -= 1; reasons.push(`简单词:${kw}`); break }
  }
  for (const kw of COMPLEX_KW) {
    if (question.includes(kw)) { score += 2; reasons.push(`复杂词:${kw}`); break }
  }

  // 2. 长度
  if (question.length <= 10) { score -= 1; reasons.push('短问题') }
  else if (question.length > 30) { score += 1; reasons.push('长问题') }

  // 3. 问号
  const qmCount = (question.match(/[？?]/g) || []).length
  if (qmCount >= 2) { score += 2; reasons.push('多问号') }

  // 4. 术语密度（中文字符占比高的通常更专业）
  const chineseRatio = (question.match(/[一-鿿]/g) || []).length / Math.max(1, question.length)
  if (chineseRatio > 0.8 && question.length > 15) { score += 1; reasons.push('术语密集') }

  const verdict = score >= 2 ? 'deep' : 'fast'
  return { verdict, score, reason: reasons.join('+') || '默认快速' }
}
