import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('classifier')

// 题号/问题序号正则
const ITEM_REGEX = /(?:^|\n)\s*(?:\d+[.、)）]|[（(]\d+[)）]|[一二三四五六七八九十]+[、.。)）])\s*/gm

export async function detectDocumentType(
  fullText: string,
): Promise<'question_bank' | 'knowledge'> {
  // 题号密度：每 20 行中出现 1 个以上题号 → 题库文档
  const itemMatches = fullText.match(ITEM_REGEX) || []
  const lines = fullText.split('\n').length
  if (lines > 0 && itemMatches.length > 0 && itemMatches.length >= Math.ceil(lines / 20)) {
    logger.info(`[classifier] 题号密度判定: ${itemMatches.length}个题号 / ${lines}行 → question_bank`)
    return 'question_bank'
  }

  logger.info(`[classifier] 题号密度不够: ${itemMatches.length}个题号 / ${lines}行 → knowledge`)
  return 'knowledge'
}
