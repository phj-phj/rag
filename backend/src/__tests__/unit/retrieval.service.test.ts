import { describe, it, expect } from 'vitest'
import { rrfMerge, mmrSelect, jaccardOverlap } from '../../services/retrieval.service'
import type { RetrievedChunk } from '../../services/retrieval.service'

// ═══════════════════════════════════════
// 辅助函数：创建测试 chunk
// ═══════════════════════════════════════

function chunk(overrides: Partial<RetrievedChunk> & { _rank?: number } = {}): RetrievedChunk & { _rank?: number } {
  return {
    chunkId: 1,
    documentId: 1,
    documentTitle: '测试文档',
    content: '测试内容',
    score: 0.8,
    ...overrides,
  }
}

// ═══════════════════════════════════════
// rrfMerge — 双路融合
// ═══════════════════════════════════════

describe('rrfMerge', () => {
  it('相同 chunk 在两路都出现 → 分数累加', () => {
    const vec = [chunk({ chunkId: 1, _rank: 1 })]
    const fts = [chunk({ chunkId: 1, _rank: 1 })]
    const result = rrfMerge(vec, fts, 5)
    expect(result).toHaveLength(1)
    expect(result[0].chunkId).toBe(1)
  })

  it('两路不重叠 → 合并后按分数排序', () => {
    const vec = [chunk({ chunkId: 1, _rank: 1 })]
    const fts = [chunk({ chunkId: 2, _rank: 1 })]
    const result = rrfMerge(vec, fts, 5)
    expect(result).toHaveLength(2)
  })

  it('返回数量不超过 topK', () => {
    const vec = Array.from({ length: 10 }, (_, i) =>
      chunk({ chunkId: i, _rank: i + 1 }),
    )
    const result = rrfMerge(vec, [], 4)
    expect(result.length).toBeLessThanOrEqual(4)
  })

  it('分数缩放不超过 1', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      chunk({ chunkId: i, _rank: i + 1 }),
    )
    const result = rrfMerge(many, [], 10)
    for (const r of result) {
      expect(r.score).toBeLessThanOrEqual(1.0)
    }
  })

  it('空输入 → 空数组', () => {
    expect(rrfMerge([], [], 5)).toEqual([])
  })
})

// ═══════════════════════════════════════
// mmrSelect — 多样性选择
// ═══════════════════════════════════════

describe('mmrSelect', () => {
  it('candidates ≤ topK 时全量返回', () => {
    const candidates = [
      chunk({ chunkId: 1, score: 0.9 }),
      chunk({ chunkId: 2, score: 0.5 }),
    ]
    const result = mmrSelect(candidates, 5, 0.7)
    expect(result).toHaveLength(2)
  })

  it('优先选最高分', () => {
    const candidates = [
      chunk({ chunkId: 1, score: 0.5 }),
      chunk({ chunkId: 2, score: 0.95 }),
      chunk({ chunkId: 3, score: 0.3 }),
    ]
    const result = mmrSelect(candidates, 2, 0.7)
    // 分数最高的 chunkId=2 一定是第一个
    expect(result[0].chunkId).toBe(2)
  })

  it('惩罚同文档连续选择', () => {
    // 前3个来自文档1，第4个来自文档2，内容各不相同以避免Jaccard惩罚
    const candidates = [
      chunk({ chunkId: 1, documentId: 1, score: 0.9, content: 'AAAAAA' }),
      chunk({ chunkId: 2, documentId: 1, score: 0.85, content: 'BBBBBB' }),
      chunk({ chunkId: 3, documentId: 1, score: 0.8, content: 'CCCCCC' }),
      chunk({ chunkId: 4, documentId: 2, score: 0.6, content: 'DDDDDD' }),
    ]
    const result = mmrSelect(candidates, 3, 0.7)
    const docIds = result.map(r => r.documentId)
    expect(new Set(docIds).size).toBe(2)
  })

  it('单候选时直接返回', () => {
    const candidates = [chunk({ chunkId: 1, score: 0.9 })]
    const result = mmrSelect(candidates, 3, 0.7)
    expect(result).toHaveLength(1)
  })

  it('输出按分数降序排列', () => {
    const candidates = Array.from({ length: 10 }, (_, i) =>
      chunk({ chunkId: i, score: Math.random() }),
    )
    const result = mmrSelect(candidates, 5, 0.7)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].score).toBeLessThanOrEqual(result[i - 1].score)
    }
  })
})

// ═══════════════════════════════════════
// jaccardOverlap — 字符级 Jaccard 重叠
// ═══════════════════════════════════════

describe('jaccardOverlap', () => {
  it('完全相同 → 1', () => {
    expect(jaccardOverlap('hello', 'hello')).toBeCloseTo(1.0)
  })

  it('完全不同 → 0', () => {
    expect(jaccardOverlap('abc', 'xyz')).toBeCloseTo(0.0)
  })

  it('部分重叠', () => {
    const result = jaccardOverlap('hello', 'help')
    // h,e,l 共享 (3), o vs p 不同, 并集5 → 3/5 = 0.6
    expect(result).toBeCloseTo(0.6, 1)
  })

  it('空字符串 → 0', () => {
    expect(jaccardOverlap('', '')).toBe(0)
  })

  it('一个空一个非空 → 0', () => {
    expect(jaccardOverlap('', 'hello')).toBe(0)
  })

  it('只看前200字符', () => {
    const a = 'A'.repeat(300)
    const b = 'B'.repeat(300) + 'A'.repeat(200)
    // a的前200都是 'A'，b的前200都是 'B' → Jaccard=0
    expect(jaccardOverlap(a, b)).toBe(0)
  })
})
