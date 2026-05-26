import { embedTexts } from './embedding.service'

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
  maxSize: number = 250,
  minSize: number = 80,
): Promise<ChunkResult[]> {
  if (!text || !text.trim()) return []

  console.log('[chunking] 开始语义分块，文本总长度:', text.length, '字, 上限:', maxSize, '字')

  // 尝试语义分块
  try {
    return await semanticChunking(text, maxSize, minSize)
  } catch (err) {
    console.log('[chunking] embedding 不可用，回退段落分块:', (err as Error).message)
    return paragraphChunking(text, maxSize, minSize)
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
  console.log(`[chunking] 第1步：共 ${sentences.length} 个句子`)
  if (sentences.length <= 1) {
    const c = makeChunk(sentences, 0, 'semantic')
    logChunk(c)
    return [c]
  }

  // 计算句子向量
  const sentenceTexts = sentences.map(s => s.text)
  const embeddings = await embedTexts(sentenceTexts)
  console.log(`[chunking] 第2步：已计算 ${embeddings.length} 个句子的向量 (${embeddings[0]?.length || 0}维)`)

  // 相邻句子相似度
  const similarities: number[] = []
  for (let i = 0; i < embeddings.length - 1; i++) {
    similarities.push(cosineSimilarity(embeddings[i], embeddings[i + 1]))
  }
  console.log('[chunking] 第3步：相邻句子相似度:', similarities.map(s => s.toFixed(3)).join(', '))

  // 断点
  const breakpoints = findBreakpoints(similarities, 0.5)
  console.log(`[chunking] 第4步：断点位置: [${breakpoints.join(', ')}]（共${breakpoints.length}个）`)

  // 合并 + 控制大小
  const chunks = mergeSemanticGroups(sentences, breakpoints, minSize, maxSize)
  console.log(`[chunking] 第5步：最终生成 ${chunks.length} 个块`)

  chunks.forEach(logChunk)
  return chunks
}


// ═══════════════════════════════════════
// 段落分块（回退方案）
// ═══════════════════════════════════════

function paragraphChunking(text: string, maxSize: number, minSize: number): ChunkResult[] {
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim())
  const segments = splitLongParagraphs(paragraphs, maxSize)
  const merged = mergeSegments(segments, maxSize, minSize)

  console.log(`[chunking] 段落分块：${segments.length} 个段落片段 → ${merged.length} 个块`)
  merged.forEach((content, i) => console.log(`[chunking]   块${i} (${content.length}字): ${content.slice(0, 100).replace(/\n/g, ' ')}...`))
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
function splitLongSentence(text: string, maxSize: number): string[] {
  const result: string[] = []
  for (let i = 0; i < text.length; i += maxSize) {
    result.push(text.slice(i, i + maxSize))
  }
  return result
}

// ── 共用工具 ──

function splitSentences(text: string): SentenceMeta[] {
  const paragraphs = text.split(/\n\n+/)
  const sentences: SentenceMeta[] = []
  let currentHeading: string | null = null

  for (const para of paragraphs) {
    if (!para.trim()) continue
    const headingMatch = para.match(
      /^(?:第[一二三四五六七八九十\d]+[章节]|[（(]?\d+[.)）]\s*|[一二三四五六七八九十]+[、。，])\s*\S{1,40}$/m
    )
    if (headingMatch && para.length < 80) { currentHeading = para.trim(); continue }
    const parts = para.split(/(?<=[。！？!?；;])/g)
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed || trimmed.length < 2) continue
      sentences.push({ text: trimmed, heading: currentHeading })
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

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i] }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

function findBreakpoints(similarities: number[], threshold: number): number[] {
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
  return { index, content, tokenCount: estimateTokens(content),
    heading: sentences[0]?.heading || null, positionStart: 0, positionEnd: content.length, strategy }
}

function logChunk(c: ChunkResult): void {
  const preview = c.content.slice(0, 100).replace(/\n/g, ' ')
  const hi = c.heading ? ` [${c.heading}]` : ''
  console.log(`[chunking]   块${c.index}${hi} (${c.content.length}字, ${c.tokenCount}t, ${c.strategy}): ${preview}...`)
}

function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[一-鿿]/g) || []).length
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  return Math.ceil(chineseChars + englishWords * 1.3)
}
