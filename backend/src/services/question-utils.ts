import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('question-utils')

// 大窗口切分：尽量在换行处切断，避免截断Q&A对
export function splitForExtraction(text: string, maxLen: number): string[] {
  if (maxLen <= 0 || !text) return []
  const parts: string[] = []
  let remaining = text
  while (remaining.length > maxLen) {
    const slice = remaining.slice(0, maxLen)
    const lastBreak = slice.lastIndexOf('\n\n')
    const cutAt = lastBreak > maxLen * 0.5 ? lastBreak : slice.lastIndexOf('\n')
    const idx = cutAt > maxLen * 0.3 ? cutAt : maxLen
    parts.push(remaining.slice(0, idx).trim())
    remaining = remaining.slice(idx).trim()
  }
  if (remaining.trim()) parts.push(remaining.trim())
  return parts
}

// 解析 LLM 返回的 JSON 题目数组（处理各种畸形输出）
export function parseExtractionResponse(
  raw: string,
): Array<{ q: string; a: string }> {
  // 1. 剥离 markdown 代码块包裹
  let text = raw.trim()
  text = text.replace(/^```(?:json|JSON)?\s*\n?/i, '')
  text = text.replace(/\n?```\s*$/i, '')
  const innerFence = text.match(/```(?:json)?\s*\n?(\[[\s\S]*?\])\s*\n?```/i)
  if (innerFence) text = innerFence[1]

  // 2. 尝试直接解析
  try {
    const arr = JSON.parse(text)
    if (Array.isArray(arr)) {
      const validated = validateItems(arr)
      logger.info(`[question-utils] 直接JSON解析: ${validated.length}/${arr.length} 道有效题`)
      return validated
    }
    if (arr?.questions && Array.isArray(arr.questions)) {
      const validated = validateItems(arr.questions)
      logger.info(`[question-utils] JSON.questions解析: ${validated.length}/${arr.questions.length} 道`)
      return validated
    }
  } catch { /* continue */ }

  // 3. 提取 JSON 数组（贪婪匹配到最后一个 ]）
  const arrMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/)
  if (!arrMatch) {
    // 尝试用更宽松的模式 — 查找 [{ 到 }]
    const looseMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/)
    if (!looseMatch) {
      logger.warn('[question-utils] 未找到 JSON 数组 (文本前200字):', text.slice(0, 200))
      logger.warn('[question-utils] 文本末200字:', text.slice(-200))
      return []
    }
    try {
      return validateItems(JSON.parse(looseMatch[0]))
    } catch { /* continue */ }
  }

  // 4. 尝试解析提取的数组
  const extracted = arrMatch ? arrMatch[0] : text
  try {
    const arr = JSON.parse(extracted)
    if (Array.isArray(arr)) return validateItems(arr)
  } catch {
    // 5. 逐个提取 {"q":...} 对象（处理大 JSON 数组中间有格式问题的场景）
    const items = extractIndividualItems(text)
    if (items.length > 0) return items
  }

  logger.warn('[question-utils] 无法解析 LLM 返回:', text.slice(0, 200))
  return []
}

// 验证过滤：必须有 q 和 a 字段
export function validateItems(arr: any[]): Array<{ q: string; a: string }> {
  return arr.filter((x: any) => typeof x.q === 'string' && typeof x.a === 'string' && x.q.trim() && x.a.trim())
}

// 逐个提取题目对象 — 即使外层 JSON 数组格式有误，也能提取出单个对象
function extractIndividualItems(text: string): Array<{ q: string; a: string }> {
  const results: Array<{ q: string; a: string }> = []
  // 匹配 {"q":"...", "a":"..."} 或 {"a":"...", "q":"..."} 格式的独立对象
  const objRegex = /\{\s*"q"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"a"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g
  let match
  while ((match = objRegex.exec(text)) !== null) {
    const q = JSON.parse(`"${match[1]}"`)
    const a = JSON.parse(`"${match[2]}"`)
    if (q.trim() && a.trim()) {
      results.push({ q, a })
    }
  }
  return results
}

// 去除题目前导序号（如 "31."、"（2）"、"一、"）
export function stripQuestionNumber(text: string): string {
  return text.replace(/^\s*(?:\d+[.、)）]\s*|[（(]\d+[)）]\s*|[一二三四五六七八九十]+[、.。)）]\s*)+/, '').trim()
}

// 从题干中轻量提取知识点关键词
export function extractKnowledgePoint(stem: string): string {
  const cleaned = stem
    .slice(0, 50)
    .replace(/[，,。.？?！!、：:；;（）()""''\[\]【】《》<>]/g, ' ')
    .trim()
  return cleaned.slice(0, 100) || '未分类'
}
