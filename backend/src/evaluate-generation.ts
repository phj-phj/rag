import dotenv from 'dotenv'
dotenv.config()

import { retrieve } from './services/retrieval.service'
import { askDocument } from './services/chat.service'
import { dataset } from './eval-retrieval'
import axios from 'axios'

// ── 类型 ──

interface JudgeResult {
  faithfulness: number
  relevance: number
  completeness: number
  hallucinationCount: number
  hallucinationDetail: string
  missedKeyPoints: string[]
  summary: string
}

interface GenReport {
  id: string
  question: string
  answer: string
  retrievedDocs: string[]
  judge: JudgeResult
  overallScore: number
  latencyMs: number
}

// ── JSON 提取 ──

function extractJson(text: string): any {
  try { return JSON.parse(text) } catch {}
  const match = text.match(/\{[\s\S]*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch {}
  }
  return {
    faithfulness: 0, relevance: 0, completeness: 0,
    hallucinationCount: -1, hallucinationDetail: 'JSON解析失败',
    missedKeyPoints: [], summary: text.slice(0, 100),
  }
}

// ── Judge 调用 ──

async function judge(
  question: string,
  answer: string,
  chunks: { title: string; content: string }[],
  expectedKeyPhrases: string[],
): Promise<JudgeResult> {
  const chunkText = chunks
    .map((c, i) => `[资料${i + 1} — ${c.title}]\n${c.content}`)
    .join('\n\n---\n\n')

  const prompt = `你是严格但公正的 RAG 回答评分员。根据参考资料（唯一事实来源）对 AI 回答打分。

## 参考资料（唯一的事实来源）
${chunkText}

## 用户问题
${question}

## AI 回答
${answer}

## 期望覆盖的关键信息点
${expectedKeyPhrases.map(p => `- ${p}`).join('\n')}

## 评分步骤

**步骤 1：逐断言验证**
将 AI 回答拆解为独立的断言，逐一在参考资料中寻找支撑。
- 找到支撑 → 标记为 ✓
- 找不到支撑 → 标记为 ✗（这是幻觉）
- 与参考资料矛盾 → 标记为 ⊗（这是错误）

**步骤 2：对照期望信息点**
逐条检查期望覆盖的关键信息点，标记 √（已覆盖）或 ✗（未覆盖）。

**步骤 3：打分**

1. 忠实度 (1-5)：回答中是否有编造？
   - 5：所有断言都有参考资料支撑
   - 3：大部分有支撑，偶有无关紧要的补充
   - 1：大量编造或与资料矛盾

2. 相关性 (1-5)：是否精准切题？
   - 5：直接回答核心，无废话
   - 3：部分切题但有跑题内容
   - 1：基本不相关

3. 完整性 (1-5)：关键信息点覆盖了多少？
   - 5：覆盖了 ≥90% 的期望信息点
   - 3：覆盖了约 50%
   - 1：覆盖了 ≤20%

只输出 JSON，不要任何其他内容：

{"faithfulness":N,"relevance":N,"completeness":N,"hallucinationCount":N,"hallucinationDetail":"幻觉断言摘录","missedKeyPoints":["遗漏点"],"summary":"一句话总结"}`

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

  const content = res.data?.choices?.[0]?.message?.content || '{}'
  return extractJson(content) as JudgeResult
}

// ── 主评估 ──

async function main() {
  console.log('═'.repeat(80))
  console.log('  Papier RAG 生成质量评估 (LLM-as-Judge)')
  console.log('═'.repeat(80))

  const reports: GenReport[] = []
  let totalScore = 0

  for (const item of dataset.slice(0, 10)) {
    const t0 = Date.now()
    console.log(`\n[${item.id}] 检索+生成中...`)

    // 1. 检索
    const chunks = await retrieve(item.question, 5)

    // 2. 生成
    const result = await askDocument(
      item.question,
      chunks.map(c => ({ title: c.documentTitle, content: c.content, score: c.score })),
      false,
    )

    // 3. Judge
    const judgeResult = await judge(
      item.question,
      result.answer,
      chunks.map(c => ({ title: c.documentTitle, content: c.content })),
      item.expectedKeyPhrases,
    )

    const overallScore = (judgeResult.faithfulness / 5) * (judgeResult.relevance / 5) * (judgeResult.completeness / 5)
    totalScore += overallScore

    const report: GenReport = {
      id: item.id,
      question: item.question,
      answer: result.answer,
      retrievedDocs: chunks.slice(0, 3).map(c => c.documentTitle),
      judge: judgeResult,
      overallScore,
      latencyMs: Date.now() - t0,
    }
    reports.push(report)

    console.log(`  忠实度=${judgeResult.faithfulness} 相关性=${judgeResult.relevance} 完整性=${judgeResult.completeness} 幻觉=${judgeResult.hallucinationCount} 综合=${overallScore.toFixed(2)}`)
    console.log(`  来源: [${report.retrievedDocs.join(' | ')}]`)
    if (judgeResult.hallucinationCount > 0) {
      console.log(`  ⚠ 幻觉: ${judgeResult.hallucinationDetail}`)
    }
    if (judgeResult.missedKeyPoints.length > 0) {
      console.log(`  ✗ 遗漏: ${judgeResult.missedKeyPoints.join(', ')}`)
    }
  }

  // ── 汇总 ──
  const n = reports.length
  const avgFaithfulness = reports.reduce((s, r) => s + r.judge.faithfulness, 0) / n
  const avgRelevance = reports.reduce((s, r) => s + r.judge.relevance, 0) / n
  const avgCompleteness = reports.reduce((s, r) => s + r.judge.completeness, 0) / n
  const avgScore = totalScore / n
  const totalHallucinations = reports.reduce((s, r) => s + r.judge.hallucinationCount, 0)

  console.log(`\n${'═'.repeat(80)}`)
  console.log('                         汇总报告')
  console.log('═'.repeat(80))
  console.log(`平均忠实度:           ${avgFaithfulness.toFixed(1)} / 5`)
  console.log(`平均相关性:           ${avgRelevance.toFixed(1)} / 5`)
  console.log(`平均完整性:           ${avgCompleteness.toFixed(1)} / 5`)
  console.log(`综合得分:             ${(avgScore * 100).toFixed(0)}%`)
  console.log(`总幻觉断言数:          ${totalHallucinations}`)
  console.log(`幻觉率:               ${(reports.filter(r => r.judge.hallucinationCount > 0).length / n * 100).toFixed(0)}%`)
  console.log(`平均延迟:             ${(reports.reduce((s, r) => s + r.latencyMs, 0) / n).toFixed(0)}ms`)

  // ── 三象限诊断 ──
  console.log(`\n═`.repeat(80))
  console.log('                       三象限诊断')
  console.log('═'.repeat(80))

  const highFidelity = reports.filter(r => r.judge.faithfulness >= 4)
  const lowFidelityHighHit = reports.filter(r => r.judge.faithfulness < 4)
  const lowCompleteness = reports.filter(r => r.judge.completeness < 3)

  console.log(`RAG 有效 (faithfulness≥4):     ${highFidelity.length}/${n}`)
  console.log(`LLM 编造 (faithfulness<4):      ${lowFidelityHighHit.length}/${n}`)
  if (lowFidelityHighHit.length > 0) {
    console.log('   ⚠ 以下问题检索正常但 LLM 在编造：')
    for (const r of lowFidelityHighHit) {
      console.log(`     [${r.id}] ${r.judge.hallucinationDetail}`)
    }
  }
  console.log(`关键信息遗漏 (completeness<3):  ${lowCompleteness.length}/${n}`)
  if (lowCompleteness.length > 0) {
    console.log('   ⚠ 以下问题遗漏了关键信息点：')
    for (const r of lowCompleteness) {
      console.log(`     [${r.id}] ${r.question.slice(0, 40)} — 遗漏: ${r.judge.missedKeyPoints.join(', ')}`)
    }
  }

  process.exit(0)
}

main()
