import { embedTexts } from './embedding.service'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('chunking')

// ── 类型 ──

interface SentenceMeta {
  text: string
  heading: string | null
}

export interface ChunkResult {
  index: number
  content: string
  tokenCount: number
  heading: string | null
  positionStart: number
  positionEnd: number
  strategy: 'semantic' | 'paragraph'
}

// ── 入口 ──

/**
 * 语义分块：embedding 可用时按语义边界切分，不可用时回退段落分块
 * @param maxSize  块最大字数（默认 250）
 * @param minSize  块最小字数（默认 80）
 */
export async function splitIntoChunks(
  text: string,
  maxSize: number = 500,
  minSize: number = 150,
): Promise<ChunkResult[]> {
  if (!text || !text.trim()) return []

  logger.info('[chunking] 开始语义分块，文本总长度:', text.length, '字, 上限:', maxSize, '字')

  // 尝试语义分块
  try {
    const chunks = await semanticChunking(text, maxSize, minSize)
    return addOverlap(chunks)
  } catch (err) {
    logger.info('[chunking] embedding 不可用，回退段落分块:', (err as Error).message)
    const chunks = paragraphChunking(text, maxSize, minSize)
    return addOverlap(chunks)
  }
}


// ═══════════════════════════════════════
// 语义分块（优先使用）
// ═══════════════════════════════════════

async function semanticChunking(
  text: string,
  maxSize: number,
  minSize: number,
): Promise<ChunkResult[]> {
  const sentences = splitSentences(text)
  logger.info(`[chunking] 第1步：共 ${sentences.length} 个句子`)
  if (sentences.length <= 1) {
    const c = makeChunk(sentences, 0, 'semantic')
    logger.info(`[chunking]   块${c.index} (${c.content.length}字, ${c.tokenCount}t, ${c.strategy})`)
    return [c]
  }

  // 计算句子向量
  const sentenceTexts = sentences.map(s => s.text)
  const embeddings = await embedTexts(sentenceTexts)
  logger.info(`[chunking] 第2步：已计算 ${embeddings.length} 个句子的向量 (${embeddings[0]?.length || 0}维)`)

  // 相邻句子相似度
  const similarities: number[] = []
  for (let i = 0; i < embeddings.length - 1; i++) {
    similarities.push(cosineSimilarity(embeddings[i], embeddings[i + 1]))
  }
  logger.info('[chunking] 第3步：相邻句子相似度:', similarities.map(s => s.toFixed(3)).join(', '))

  // 断点
  const breakpoints = findBreakpoints(similarities, 0.5)
  logger.info(`[chunking] 第4步：断点位置: [${breakpoints.join(', ')}]（共${breakpoints.length}个）`)

  // 合并 + 控制大小
  const chunks = mergeSemanticGroups(sentences, breakpoints, minSize, maxSize)
  logger.info(`[chunking] 第5步：最终生成 ${chunks.length} 个块`)
  chunks.forEach(c => logger.info(`[chunking]   块${c.index} (${c.content.length}字, ${c.tokenCount}t, ${c.strategy})`))
  return chunks
}


// ═══════════════════════════════════════
// 段落分块（回退方案）
// ═══════════════════════════════════════

function paragraphChunking(text: string, maxSize: number, minSize: number): ChunkResult[] {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
  const segments = splitLongParagraphs(paragraphs, maxSize)
  const merged = mergeSegments(segments, maxSize, minSize)

  logger.info(`[chunking] 段落分块：${segments.length} 个段落片段 → ${merged.length} 个块`)
  merged.forEach((content, i) => logger.info(`[chunking]   块${i} (${content.length}字)`))
  return merged.map((content, i) => ({
    index: i, content, tokenCount: estimateTokens(content),
    heading: detectHeading(content), positionStart: 0, positionEnd: content.length,
    strategy: 'paragraph' as const,
  }))
}

function splitLongParagraphs(paragraphs: string[], maxSize: number): string[] {
  const result: string[] = []
  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (trimmed.length <= maxSize) { result.push(trimmed); continue }
    const sentences = trimmed.split(/(?<=[。！？!?；;])/g)
    let buf = ''
    for (const s of sentences) {
      // 单句超长 → 硬截断
      if (s.length > maxSize) {
        if (buf.length > 0) { result.push(buf.trim()); buf = '' }
        result.push(...splitLongSentence(s.trim(), maxSize))
      } else if (buf.length + s.length > maxSize && buf.length > 0) {
        result.push(buf.trim()); buf = s
      } else { buf += s }
    }
    if (buf.trim()) result.push(buf.trim())
  }
  return result
}

function mergeSegments(segments: string[], maxSize: number, minSize: number): string[] {
  const merged: string[] = []
  let buf = ''
  for (const seg of segments) {
    if (buf && buf.length + seg.length > maxSize && buf.length > minSize) {
      merged.push(buf.trim()); buf = seg
    } else { buf += (buf ? '\n' : '') + seg }
  }
  if (buf.trim()) merged.push(buf.trim())
  return merged
}


/**
 * 拆分超长句子（无标点的 URL 或代码块），按字符位置硬截断
 */
export function splitLongSentence(text: string, maxSize: number): string[] {
  const result: string[] = []
  for (let i = 0; i < text.length; i += maxSize) {
    result.push(text.slice(i, i + maxSize))
  }
  return result
}

// ── 共用工具 ──

// 题号/列表项模式（强断点：不在句子中间切断）
const ITEM_PATTERN = /^(?:\d+[.、）)]|[（(]\d+[)）]|[一二三四五六七八九十]+[、。)])/
// 题库关键词
const EXAM_KEYWORDS = /(?:题目|选项|答案|解析|正确|错误|判断|单选|多选|填空|问答|简答)/

function splitSentences(text: string): SentenceMeta[] {
  const paragraphs = text.split(/\n{2,}/)
  const sentences: SentenceMeta[] = []
  let currentHeading: string | null = null

  // 检测是否为题库文档（≥3 个题号）
  const itemCount = (text.match(/^(?:\d+[.、）)]|[（(]\d+[)）]|[一二三四五六七八九十]+[、。)])/gm) || []).length
  const isExamBank = itemCount >= 3

  for (const para of paragraphs) {
    const trimmed = para.trim()
    if (!trimmed) continue

    // 标题检测
    const headingMatch = trimmed.match(
      /^(?:第[一二三四五六七八九十\d]+[章节]|[（(]?\d+[.)）]\s*|[一二三四五六七八九十]+[、。，])\s*\S{1,40}$/m
    )
    if (headingMatch && trimmed.length < 80 && !isExamBank) {
      currentHeading = trimmed
      continue
    }

    // 题库模式：按题号强断
    if (isExamBank && ITEM_PATTERN.test(trimmed)) {
      // 题号行作为该 chunk 的 heading
      const itemHeading = trimmed.match(/^\S{1,30}/)?.[0] || null
      // 按换行拆题目内容
      const lines = trimmed.split(/\n/)
      let body = lines.slice(1).join('\n').trim()
      if (!body) body = trimmed // 单行题
      const parts = body.split(/(?<=[。！？!?；;])/g)
      for (const part of parts) {
        const t = part.trim()
        if (!t || t.length < 2) continue
        sentences.push({ text: t, heading: itemHeading })
      }
      continue
    }

    // 普通段落：按句号切
    const parts = trimmed.split(/(?<=[。！？!?；;])/g)
    for (const part of parts) {
      const t = part.trim()
      if (!t || t.length < 2) continue
      sentences.push({ text: t, heading: currentHeading })
    }
  }
  return sentences
}

function detectHeading(content: string): string | null {
  const m = content.match(
    /^(?:第[一二三四五六七八九十\d]+[章节]|[（(]?\d+[.)）]\s*|[一二三四五六七八九十]+[、。，])\s*\S{1,40}/
  )
  return m ? m[0].trim() : null
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i] }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

export function findBreakpoints(similarities: number[], threshold: number): number[] {
  const bps: number[] = []
  for (let i = 0; i < similarities.length; i++) { if (similarities[i] < threshold) bps.push(i) }
  return bps
}

function mergeSemanticGroups(
  sentences: SentenceMeta[], breakpoints: number[], minSize: number, maxSize: number,
): ChunkResult[] {
  const groups: SentenceMeta[][] = []
  let start = 0
  for (const bp of breakpoints) { if (bp + 1 > start) { groups.push(sentences.slice(start, bp + 1)); start = bp + 1 } }
  if (start < sentences.length) groups.push(sentences.slice(start))

  const adjusted = adjustGroups(groups, minSize, maxSize)
  return adjusted.map((g, i) => makeChunk(g, i, 'semantic'))
}

function adjustGroups(groups: SentenceMeta[][], minSize: number, maxSize: number): SentenceMeta[][] {
  const merged: SentenceMeta[][] = []
  let buf: SentenceMeta[] = []
  for (const g of groups) {
    const gLen = g.reduce((s, x) => s + x.text.length, 0)
    const bLen = buf.reduce((s, x) => s + x.text.length, 0)
    if (buf.length && bLen + gLen < minSize) { buf.push(...g) }
    else if (buf.length) { merged.push(buf); buf = [...g] }
    else { buf = [...g] }
  }
  if (buf.length) merged.push(buf)

  const split: SentenceMeta[][] = []
  for (const g of merged) {
    const gLen = g.reduce((s, x) => s + x.text.length, 0)
    if (gLen <= maxSize) { split.push(g); continue }
    let sub: SentenceMeta[] = [], subLen = 0
    for (const s of g) {
      // 单句超长 → 硬截断为多个单句组
      if (s.text.length > maxSize) {
        if (sub.length) { split.push(sub); sub = []; subLen = 0 }
        const parts = splitLongSentence(s.text, maxSize)
        for (const p of parts) { split.push([{ text: p, heading: s.heading }]) }
      } else if (subLen + s.text.length > maxSize && sub.length) {
        split.push(sub); sub = [s]; subLen = s.text.length
      } else { sub.push(s); subLen += s.text.length }
    }
    if (sub.length) split.push(sub)
  }
  return split
}

function makeChunk(sentences: SentenceMeta[], index: number, strategy: 'semantic' | 'paragraph'): ChunkResult {
  const content = sentences.map(s => s.text).join('')
  return {
    index, content, tokenCount: estimateTokens(content),
    heading: sentences[0]?.heading || null, positionStart: 0, positionEnd: content.length, strategy
  }
}

/**
 * 重叠窗口：每个 chunk 尾部 20% 拼入下一个 chunk 头部，保留上下文边界
 */
export function addOverlap(chunks: ChunkResult[]): ChunkResult[] {
  if (chunks.length <= 1) return chunks

  const OVERLAP_RATIO = 0.2

  for (let i = 1; i < chunks.length; i++) {
    const prev = chunks[i - 1]
    const overlapLen = Math.floor(prev.content.length * OVERLAP_RATIO)
    if (overlapLen < 10) continue // 太短不重叠

    const tail = prev.content.slice(-overlapLen)
    chunks[i] = {
      ...chunks[i],
      content: tail + '\n' + chunks[i].content,
      tokenCount: estimateTokens(tail + '\n' + chunks[i].content),
    }
  }

  logger.info(`[chunking] 重叠窗口: ${OVERLAP_RATIO * 100}%`)
  return chunks
}

export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[一-鿿]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  return Math.ceil(chineseChars + englishWords * 1.3)
}
