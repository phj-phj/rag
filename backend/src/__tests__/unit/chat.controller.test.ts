import { describe, it, expect } from 'vitest'
import { checkCoverage } from '../../controllers/chat.controller'

// 辅助函数：构造 chunk
function c(content: string, score: number) {
  return { content, score }
}

// ═══════════════════════════════════════
// checkCoverage — 覆盖率闸门（PeakGap 动态阈值）
// ═══════════════════════════════════════

describe('checkCoverage', () => {
  // ── 信号 1：总文本量 ──

  it('总文本量 < 300 → 拦截', () => {
    const result = checkCoverage([c('短文本', 0.5)])
    expect(result.sufficient).toBe(false)
    expect(result.reason).toContain('300')
  })

  it('总文本量 ≥ 300 → 不因文本量拦截', () => {
    const result = checkCoverage([c('x'.repeat(300), 0.5)])
    // 文本量通过，分数也通过
    expect(result.sufficient).toBe(true)
  })

  // ── 信号 2：绝对底线 0.10 ──

  it('top1 < 0.10 → 拦截（绝对底线）', () => {
    const result = checkCoverage([c('x'.repeat(300), 0.09)])
    expect(result.sufficient).toBe(false)
    expect(result.reason).toContain('0.10')
  })

  it('top1 = 0.10 → 进入灰色区间检查而非绝对底线拦截', () => {
    // 0.10 不满足 < 0.10，进入灰色区间
    const result = checkCoverage([c('x'.repeat(300), 0.10), c('x', 0.09)])
    // gap=0.01 < 0.15 → 拦截
    expect(result.sufficient).toBe(false)
  })

  // ── 灰色区间 [0.10, 0.20) + PeakGap ──

  it('灰色区间 + PeakGap < 0.15 → 拦截', () => {
    const result = checkCoverage([
      c('x'.repeat(300), 0.15),
      c('x', 0.13),
    ])
    expect(result.sufficient).toBe(false)
    expect(result.reason).toContain('PeakGap')
  })

  it('灰色区间 + PeakGap ≥ 0.15 → 放行', () => {
    const result = checkCoverage([
      c('x'.repeat(300), 0.17),
      c('x', 0.02),
    ])
    expect(result.sufficient).toBe(true)
  })

  it('灰色区间 + PeakGap 恰好 0.15 → 放行（不满足 < 0.15）', () => {
    const result = checkCoverage([
      c('x'.repeat(300), 0.17),
      c('x', 0.02),
    ])
    // gap = 0.15, 不满足 < 0.15
    expect(result.sufficient).toBe(true)
  })

  // ── 高分区间 top1 ≥ 0.20 → 直接放行 ──

  it('top1 ≥ 0.20 → 直接放行，不检查 PeakGap', () => {
    const result = checkCoverage([
      c('x'.repeat(300), 0.20),
      c('x', 0.19), // gap 很小但无所谓
    ])
    expect(result.sufficient).toBe(true)
  })

  it('top1 远大于 0.20 → 直接放行', () => {
    const result = checkCoverage([
      c('x'.repeat(300), 0.85),
      c('x', 0.82),
    ])
    expect(result.sufficient).toBe(true)
  })

  // ── 边界场景 ──

  it('只有一个 chunk + top1 在灰色区间 → top2=0，PeakGap 足够大，放行', () => {
    const result = checkCoverage([c('x'.repeat(300), 0.12)])
    // top2 = 0, gap = 0.12 < 0.15 → 拦截
    expect(result.sufficient).toBe(false)
  })

  it('只有一个 chunk + top1 高分 → 放行', () => {
    const result = checkCoverage([c('x'.repeat(300), 0.85)])
    expect(result.sufficient).toBe(true)
  })

  it('空数组 → 拦截', () => {
    const result = checkCoverage([])
    expect(result.sufficient).toBe(false)
  })

  it('两个条件同时触发：文本不足 + 低分 → 优先报告文本量（先检查）', () => {
    const result = checkCoverage([c('短', 0.05)])
    expect(result.sufficient).toBe(false)
    expect(result.reason).toContain('300')
  })
})
