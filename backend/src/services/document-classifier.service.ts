import { embedTexts } from './embedding.service'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('classifier')

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// 题号/问题序号正则
const ITEM_REGEX = /(?:^|\n)\s*(?:\d+[.、)）]|[（(]\d+[)）]|[一二三四五六七八九十]+[、.。)）])\s*/gm

export async function detectDocumentType(
  fullText: string,
): Promise<'question_bank' | 'knowledge'> {
  // 快速判定：题号密度高 = 题库文档
  const itemMatches = fullText.match(ITEM_REGEX) || []
  const lines = fullText.split('\n').length
  // 每 20 行中出现 1 个以上题号 → 很可能题库
  if (lines > 0 && itemMatches.length > 0 && itemMatches.length >= Math.ceil(lines / 20)) {
    logger.info(`[classifier] 题号密度判定: ${itemMatches.length}个题号 / ${lines}行 → question_bank`)
    return 'question_bank'
  }

  const paragraphs = fullText.split(/\n{2,}/).filter((p) => p.trim().length > 20)
  if (paragraphs.length < 3) return 'knowledge'

  try {
    const embeddings = await embedTexts(paragraphs)
    const similarities: number[] = []
    for (let i = 0; i < embeddings.length - 1; i++) {
      similarities.push(cosineSimilarity(embeddings[i], embeddings[i + 1]))
    }

    const avg = similarities.reduce((a, b) => a + b, 0) / similarities.length
    const variance =
      similarities.reduce((s, v) => s + (v - avg) ** 2, 0) / similarities.length

    if (variance > 0.08 || avg < 0.5) {
      logger.info(`[classifier] 语义判定: variance=${variance.toFixed(3)} avg=${avg.toFixed(3)} → question_bank`)
      return 'question_bank'
    }
    logger.info(`[classifier] 语义判定: variance=${variance.toFixed(3)} avg=${avg.toFixed(3)} → knowledge`)
    return 'knowledge'
  } catch {
    logger.warn('[classifier] embedding 不可用，默认按知识文档处理')
    return 'knowledge'
  }
}
