import { describe, it, expect } from 'vitest'
import { IncrementalJsonParser } from '../../services/chat.service'

// ═══════════════════════════════════════
// IncrementalJsonParser — 流式 JSON 解析状态机
// ═══════════════════════════════════════

describe('IncrementalJsonParser', () => {
  // ── 基础 ──

  it('解析完整的单个对象', () => {
    const parser = new IncrementalJsonParser()
    const results = parser.feed('{"q": "什么是RAG", "a": "检索增强生成"}')
    expect(results).toEqual([{ q: '什么是RAG', a: '检索增强生成' }])
  })

  it('解析空对象 → 不产出（q和a都缺）', () => {
    const parser = new IncrementalJsonParser()
    expect(parser.feed('{}')).toEqual([])
  })

  it('空输入 → 空数组', () => {
    const parser = new IncrementalJsonParser()
    expect(parser.feed('')).toEqual([])
  })

  // ── 流式切分 ──

  it('对象被切开：前半部分不产出，后半部分补全后输出', () => {
    const parser = new IncrementalJsonParser()
    const r1 = parser.feed('{"q":"什么是RAG","a":')
    expect(r1).toEqual([]) // 不完整

    const r2 = parser.feed('"检索增强生成"}')
    expect(r2).toEqual([{ q: '什么是RAG', a: '检索增强生成' }])
  })

  it('切在字符串中间：不输出直到对象闭合', () => {
    const parser = new IncrementalJsonParser()
    const r1 = parser.feed('{"q":"什么')
    expect(r1).toEqual([])

    const r2 = parser.feed('是RAG","a":"答"}')
    expect(r2).toEqual([{ q: '什么是RAG', 'a': '答' }])
  })

  it('同一 chunk 中多个对象', () => {
    const parser = new IncrementalJsonParser()
    const results = parser.feed(
      '{"q":"题1","a":"答1"}{"q":"题2","a":"答2"}',
    )
    expect(results).toHaveLength(2)
    expect(results[0].q).toBe('题1')
    expect(results[1].q).toBe('题2')
  })

  // ── 转义 ──

  it('字符串内包含转义引号', () => {
    const parser = new IncrementalJsonParser()
    const results = parser.feed('{"q":"他说\\"你好\\"","a":"world"}')
    expect(results).toHaveLength(1)
    // JSON.parse 后 \\" 变成 "
    expect(results[0].q).toBe('他说"你好"')
  })

  it('字符串内包含反斜杠', () => {
    const parser = new IncrementalJsonParser()
    const results = parser.feed('{"q":"路径是C:\\\\Users","a":"ok"}')
    expect(results).toHaveLength(1)
    expect(results[0].q).toContain('C:')
  })

  // ── 嵌套结构 ──

  it('忽略嵌套花括号（不提前闭合）', () => {
    const parser = new IncrementalJsonParser()
    // JSON 本身是 {"q":"...","a":"..."}，内部花括号在引导字符串外
    // 构造测试：a的值里没有嵌套花括号，但 LLM 可能输出 JSON 对象嵌套
    const results = parser.feed('{"q":"选项","a":"A {正确} B {错误}"}')
    expect(results).toHaveLength(1)
    // 注意：如果 } 出现在值中作为字面字符而不是 JSON 结构，这个测试揭示行为
  })

  // ── 畸形输入 ──

  it('后面跟多余字符 → 解析第一个对象，忽略其余', () => {
    const parser = new IncrementalJsonParser()
    const r1 = parser.feed('{"q":"题","a":"答"}后面有垃圾{"q":"x","a":"y"}')
    // 第一个对象会解析，第二个对象看实现
    expect(r1.length).toBeGreaterThanOrEqual(1)
    expect(r1[0].q).toBe('题')
  })

  it('输入为数组格式 → 解析失败不崩溃', () => {
    const parser = new IncrementalJsonParser()
    const r = parser.feed('[{"q":"题","a":"答"}]')
    // 数组的 [ 不会计入 depth，但 { 会计入。每个对象独立解析
    expect(r.length).toBeGreaterThanOrEqual(1)
  })

  it('getRemaining 返回未解析的缓冲区', () => {
    const parser = new IncrementalJsonParser()
    const r = parser.feed('{"q":"unfinished')
    expect(r).toEqual([])
    expect(parser.getRemaining()).toContain('unfinished')
  })

  // ── Unicode ──

  it('中文题目正常解析', () => {
    const parser = new IncrementalJsonParser()
    const results = parser.feed('{"q":"什么是闭包？","a":"闭包是指函数能够记住并访问其词法作用域"}')
    expect(results).toHaveLength(1)
    expect(results[0].q).toBe('什么是闭包？')
  })
})
