import { describe, it, expect } from 'vitest'
import {
  splitForExtraction,
  parseExtractionResponse,
  stripQuestionNumber,
  extractKnowledgePoint,
  validateItems,
} from '../../services/question-utils'

// ═══════════════════════════════════════
// splitForExtraction — 大窗口切分
// ═══════════════════════════════════════

describe('splitForExtraction', () => {
  it('短文本不切分', () => {
    const text = '这是一段短文本'
    expect(splitForExtraction(text, 100)).toEqual([text])
  })

  it('无换行符的长文本也能正常切分（不卡死）', () => {
    const text = 'A'.repeat(5000)
    const parts = splitForExtraction(text, 1000)
    expect(parts.length).toBeGreaterThanOrEqual(5)
    // 验证所有片段拼接后与原文本大致匹配（去除空白差异）
    const joined = parts.join('')
    expect(joined).toBe(text)
  })

  it('空文本 → 空数组', () => {
    expect(splitForExtraction('', 100)).toEqual([])
  })

  it('在换行符处切分', () => {
    const text = '段落A\n\n段落B\n\n段落C'
    const parts = splitForExtraction(text, 100)
    // 由于文本短于maxLen，不会切分
    expect(parts).toEqual([text])
  })

  it('maxLen=0时也能正常处理（不卡死）', () => {
    // 确保不会死循环 — 这是之前担心过的边界
    const result = splitForExtraction('hello world', 0)
    expect(Array.isArray(result)).toBe(true)
  })
})

// ═══════════════════════════════════════
// parseExtractionResponse — LLM 题目解析
// ═══════════════════════════════════════

describe('parseExtractionResponse', () => {
  it('解析标准格式 [{q, a}]', () => {
    const raw = '[{"q": "什么是RAG", "a": "检索增强生成"}]'
    expect(parseExtractionResponse(raw)).toEqual([
      { q: '什么是RAG', a: '检索增强生成' },
    ])
  })

  it('解析 markdown 代码块包裹的 JSON', () => {
    const raw = '```json\n[{"q": "问", "a": "答"}]\n```'
    expect(parseExtractionResponse(raw)).toEqual([{ q: '问', a: '答' }])
  })

  it('解析 {questions: [...]} 格式', () => {
    const raw = '{"questions": [{"q": "问", "a": "答"}]}'
    expect(parseExtractionResponse(raw)).toEqual([{ q: '问', 'a': '答' }])
  })

  it('过滤无效项（空q或空a）', () => {
    const raw = '[{"q": "", "a": "答"}, {"q": "问", "a": ""}, {"q": "ok", "a": "ok"}]'
    expect(parseExtractionResponse(raw)).toEqual([{ q: 'ok', 'a': 'ok' }])
  })

  it('过滤非字符串字段', () => {
    const raw = '[{"q": 123, "a": "答"}, {"q": "问", "a": true}]'
    expect(parseExtractionResponse(raw)).toEqual([])
  })

  it('LLM 返回垃圾文本 → 空数组', () => {
    expect(parseExtractionResponse('这是一段与 JSON 完全无关的废话')).toEqual([])
  })

  it('空字符串 → 空数组', () => {
    expect(parseExtractionResponse('')).toEqual([])
  })

  it('解析多个题目', () => {
    const raw = '[{"q": "题1", "a": "答1"}, {"q": "题2", "a": "答2"}]'
    expect(parseExtractionResponse(raw)).toHaveLength(2)
  })

  it('内部又套了一层 markdown 代码块', () => {
    const raw = '```json\n```json\n[{"q":"x","a":"y"}]\n```\n```'
    const result = parseExtractionResponse(raw)
    expect(result).toEqual([{ q: 'x', a: 'y' }])
  })
})

// ═══════════════════════════════════════
// validateItems — 题目验证过滤
// ═══════════════════════════════════════

describe('validateItems', () => {
  it('过滤掉空字符串字段', () => {
    const arr = [
      { q: '', a: '答' },
      { q: '问', a: '' },
      { q: '  ', a: '  ' },
      { q: 'ok', a: 'ok' },
    ]
    expect(validateItems(arr)).toEqual([{ q: 'ok', a: 'ok' }])
  })

  it('空数组 → 空数组', () => {
    expect(validateItems([])).toEqual([])
  })
})

// ═══════════════════════════════════════
// stripQuestionNumber — 去题目前导序号
// ═══════════════════════════════════════

describe('stripQuestionNumber', () => {
  it('去除 31. 序号', () => {
    expect(stripQuestionNumber('31. 什么是闭包')).toBe('什么是闭包')
  })

  it('去除（2）序号', () => {
    expect(stripQuestionNumber('（2）解释闭包概念')).toBe('解释闭包概念')
  })

  it('去除中文序号', () => {
    expect(stripQuestionNumber('一、请回答问题')).toBe('请回答问题')
  })

  it('无序号不变', () => {
    expect(stripQuestionNumber('什么是闭包')).toBe('什么是闭包')
  })
})

// ═══════════════════════════════════════
// extractKnowledgePoint — 知识点关键词
// ═══════════════════════════════════════

describe('extractKnowledgePoint', () => {
  it('从题干提取关键词', () => {
    const stem = 'JavaScript中，闭包是如何工作的？请举例说明'
    const result = extractKnowledgePoint(stem)
    expect(result).not.toBe('未分类')
    expect(result.length).toBeGreaterThan(0)
  })

  it('空题干 → 未分类', () => {
    expect(extractKnowledgePoint('')).toBe('未分类')
  })
})
