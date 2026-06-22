import dotenv from 'dotenv'
dotenv.config()

import sequelize from './config/database'
import { QueryTypes } from 'sequelize'
import axios from 'axios'

// ── 类型 ──

interface JudgeResult {
  faithfulness: number
  hallucinationDetail: string
  summary: string
}

interface PregeneratedQuestion {
  id: number
  stem: string
  explanation: string
  source_document_id: number
}

interface EvalRecord {
  questionId: number
  stem: string
  explanation: string
  sourceDocId: number
  docTitle: string
  judge: JudgeResult
  latencyMs: number
}

// ── JSON 提取 ──

function extractJson(text: string): any {
  try { return JSON.parse(text) } catch {}
  const m = text.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch {} }
  return { faithfulness: 0, hallucinationDetail: 'JSON解析失败', summary: text.slice(0, 100) }
}

// ── Judge ──

async function judgeQuestion(
  stem: string,
  explanation: string,
  docText: string,
): Promise<JudgeResult> {
  const prompt = `你是严格但公正的题目质量评分员。判断这道题的答案是否忠实于原始文档。

## 原始文档（唯一的事实来源）
${docText.slice(0, 8000)}

## 题目
${stem}

## 答案/解析
${explanation}

## 评分

忠实度 (1-5)：答案中的每一个事实是否都能在原始文档中找到原文依据？
  - 5：全部事实来自文档，无任何外部知识
  - 3：大部分来自文档，有少量无关紧要的补充
  - 1：大量编造或与文档内容矛盾

特别注意：
- 如果答案中出现了文档里没有的数字、版本号、命令参数、工具名 → 这是幻觉
- 如果答案合理延伸了文档的概念但未编造具体事实 → 不算幻觉

只输出 JSON：
{"faithfulness":N,"hallucinationDetail":"如果≤3分，摘录幻觉内容；否则写无","summary":"一句话评价"}`

  const apiBase = process.env.MIMO_BASE_URL || 'https://api.deepseek.com/v1'
  const apiKey = process.env.MIMO_API_KEY || ''

  const res = await axios.post(
    `${apiBase}/chat/completions`,
    {
      model: process.env.MIMO_MODEL || 'deepseek-v4-flash',
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 60000,
    },
  )

  return extractJson(res.data?.choices?.[0]?.message?.content || '{}')
}

// ── 获取文档文本 ──

async function getDocText(docId: number): Promise<{ title: string; text: string }> {
  // 从 chunk 表拼接文档内容
  const chunks = await sequelize.query(
    `SELECT content FROM Document_Chunks WHERE document_id = ? ORDER BY chunk_index ASC LIMIT 50`,
    { replacements: [docId], type: QueryTypes.SELECT },
  ) as { content: string }[]

  const [doc] = await sequelize.query(
    `SELECT title FROM Documents WHERE id = ?`,
    { replacements: [docId], type: QueryTypes.SELECT },
  ) as { title: string }[]

  return {
    title: doc?.title || `文档${docId}`,
    text: chunks.map(c => c.content).join('\n'),
  }
}

// ── 主评估 ──

async function main() {
  console.log('═'.repeat(80))
  console.log('  Papier 预生成题目质量评估 (Faithfulness Judge)')
  console.log('═'.repeat(80))

  // 查预生成题目（选 demo=0 的文档，避免评估训练文档集）
  const questions = await sequelize.query(
    `SELECT q.id, q.stem, q.explanation, q.source_document_id
     FROM Questions q
     JOIN Documents d ON q.source_document_id = d.id
     WHERE q.source_type = 'ai_pregenerated'
       AND d.is_featured = 0
     LIMIT 10`,
    { type: QueryTypes.SELECT },
  ) as PregeneratedQuestion[]

  if (questions.length === 0) {
    console.log('未找到预生成题目，尝试所有 source_type=ai_pregenerated ...')
    const all = await sequelize.query(
      `SELECT q.id, q.stem, q.explanation, q.source_document_id
       FROM Questions q
       WHERE q.source_type = 'ai_pregenerated'
       LIMIT 10`,
      { type: QueryTypes.SELECT },
    ) as PregeneratedQuestion[]
    questions.push(...all)
  }

  console.log(`共查得 ${questions.length} 道预生成题目\n`)

  const docCache = new Map<number, { title: string; text: string }>()
  const records: EvalRecord[] = []

  for (const q of questions) {
    const t0 = Date.now()

    if (!docCache.has(q.source_document_id)) {
      const doc = await getDocText(q.source_document_id)
      docCache.set(q.source_document_id, doc)
      console.log(`[加载文档] 文档${q.source_document_id} "${doc.title}" ${doc.text.length}字`)
    }

    const doc = docCache.get(q.source_document_id)!
    const judge = await judgeQuestion(q.stem, q.explanation, doc.text)
    const lat = Date.now() - t0

    records.push({
      questionId: q.id,
      stem: q.stem,
      explanation: q.explanation,
      sourceDocId: q.source_document_id,
      docTitle: doc.title,
      judge,
      latencyMs: lat,
    })

    const bar = judge.faithfulness >= 4 ? '✓' : '✗'
    console.log(`[${q.id}] ${bar} 忠实度=${judge.faithfulness}/5 | ${lat}ms"`)
    console.log(`  题目: ${q.stem.slice(0, 60)}...`)
    console.log(`  文档: ${doc.title}`)
    if (judge.faithfulness < 4) {
      console.log(`  ⚠ 幻觉: ${judge.hallucinationDetail}`)
    }
  }

  // ── 汇总 ──
  const n = records.length
  const avgFaith = records.reduce((s, r) => s + r.judge.faithfulness, 0) / n
  const pass = records.filter(r => r.judge.faithfulness >= 4).length
  const fail = records.filter(r => r.judge.faithfulness < 3).length

  console.log(`\n${'═'.repeat(80)}`)
  console.log('                           汇总报告')
  console.log('═'.repeat(80))
  console.log(`评估题目数:           ${n}`)
  console.log(`平均忠实度:           ${avgFaith.toFixed(1)} / 5`)
  console.log(`优质 (faithfulness≥4): ${pass}/${n}  (${(pass/n*100).toFixed(0)}%)`)
  console.log(`不合格 (faithfulness<3): ${fail}/${n}  (${(fail/n*100).toFixed(0)}%)`)
  console.log(`平均延迟:             ${(records.reduce((s,r)=>s+r.latencyMs,0)/n).toFixed(0)}ms`)

  if (fail > 0) {
    console.log(`\n── 不合格题目详情 ──`)
    for (const r of records.filter(r => r.judge.faithfulness < 3)) {
      console.log(`[${r.questionId}] "${r.stem.slice(0, 50)}..." — ${r.judge.hallucinationDetail}`)
    }
  }

  process.exit(0)
}

main()
