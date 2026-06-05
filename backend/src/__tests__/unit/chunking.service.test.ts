import { describe, it, expect } from 'vitest'
import {
  cosineSimilarity,
  findBreakpoints,
  estimateTokens,
  splitLongSentence,
  addOverlap,
} from '../../services/chunking.service'
import type { ChunkResult } from '../../services/chunking.service'

// ═══════════════════════════════════════
// cosineSimilarity — 向量相似度
// ═══════════════════════════════════════

describe('cosineSimilarity', () => {
  it('相同向量 → 1', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1.0)
  })

  it('正交向量 → 0', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0)
  })

  it('不同维度的向量仍能正确计算（不崩溃）', () => {
    // 只按较短的维度循环
    const result = cosineSimilarity([0.5, 0.5], [0.5, 0.5, 0.9, 0.9])
    expect(result).toBeCloseTo(1.0)
  })

  it('空向量 → 返回 0 不崩溃', () => {
    expect(cosineSimilarity([], [])).toBe(0)
  })

  it('一个空向量一个非空 → 返回 0', () => {
    expect(cosineSimilarity([], [1, 2, 3])).toBe(0)
  })

  it('全零向量（无方向）→ 返回 0', () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0)
  })
})

// ═══════════════════════════════════════
// findBreakpoints — 相似度断点
// ═══════════════════════════════════════

describe('findBreakpoints', () => {
  it('低于阈值的位置成为断点', () => {
    // 相似度: [0.9, 0.3, 0.8, 0.1, 0.7]
    // 阈值0.5时，index=1(0.3) 和 index=3(0.1) 低于阈值 → [1, 3]
    const sims = [0.9, 0.3, 0.8, 0.1, 0.7]
    expect(findBreakpoints(sims, 0.5)).toEqual([1, 3])
  })

  it('全部高于阈值 → 空数组', () => {
    expect(findBreakpoints([0.9, 0.8, 0.7], 0.5)).toEqual([])
  })

  it('全部低于阈值 → 全部为断点', () => {
    expect(findBreakpoints([0.1, 0.2, 0.3], 0.5)).toEqual([0, 1, 2])
  })

  it('空相似度数组 → 空', () => {
    expect(findBreakpoints([], 0.5)).toEqual([])
  })

  it('边界值：刚好等于阈值不算断点', () => {
    expect(findBreakpoints([0.5], 0.5)).toEqual([])
  })
})

// ═══════════════════════════════════════
// estimateTokens — 中英文 token 估算
// ═══════════════════════════════════════

describe('estimateTokens', () => {
  it('纯中文：1字≈1 token', () => {
    const chinese = '今天天气很好'
    const tokens = estimateTokens(chinese)
    expect(tokens).toBe(6)
  })

  it('纯英文：按词数×1.3', () => {
    const english = 'The quick brown fox jumps'
    const tokens = estimateTokens(english)
    expect(tokens).toBe(7) // 5 words * 1.3 = 6.5 → ceil=7
  })

  it('空文本 → 0', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('无中文无英文（数字+符号）→ 0', () => {
    expect(estimateTokens('123 !@#')).toBe(0)
  })
})

// ═══════════════════════════════════════
// splitLongSentence — 硬截断超长句
// ═══════════════════════════════════════

describe('splitLongSentence', () => {
  it('短文本不截断', () => {
    expect(splitLongSentence('hello', 100)).toEqual(['hello'])
  })

  it('超出 maxSize 时截断', () => {
    const text = 'A'.repeat(250)
    const parts = splitLongSentence(text, 100)
    expect(parts).toEqual(['A'.repeat(100), 'A'.repeat(100), 'A'.repeat(50)])
  })

  it('空文本 → 空数组', () => {
    expect(splitLongSentence('', 10)).toEqual([])
  })

  it('恰好等于 maxSize', () => {
    const parts = splitLongSentence('12345', 5)
    expect(parts).toEqual(['12345'])
  })
})

// ═══════════════════════════════════════
// addOverlap — 块间重叠窗口
// ═══════════════════════════════════════

function makeChunk(index: number, content: string): ChunkResult {
  return {
    index,
    content,
    tokenCount: estimateTokens(content),
    heading: null,
    positionStart: 0,
    positionEnd: content.length,
    strategy: 'semantic',
  }
}

describe('addOverlap', () => {
  it('单个块不变', () => {
    const chunks = [makeChunk(0, 'hello world')]
    expect(addOverlap(chunks)).toEqual(chunks)
  })

  it('两个块：后块头部拼入前块尾部20%', () => {
    const prev = makeChunk(0, 'A'.repeat(100))
    const next = makeChunk(1, 'B'.repeat(200))
    const result = addOverlap([prev, next])
    // 前块 20% = 20 字符
    expect(result[1].content).toMatch(/^A{20}\nB{200}$/)
  })

  it('前块尾部<10字符不触发重叠', () => {
    const prev = makeChunk(0, 'AAA') // 3字符，20%=0.6→floor=0 <10
    const next = makeChunk(1, 'BBB')
    const result = addOverlap([prev, next])
    // 不变化（重叠窗口太小）
    expect(result[1].content).toBe('BBB')
  })

  it('空数组不崩溃', () => {
    expect(addOverlap([])).toEqual([])
  })
})
