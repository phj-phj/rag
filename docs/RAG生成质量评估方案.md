# RAG 生成质量评估方案（LLM-as-Judge）

> P0 — 检索评估只证明了"找对了 chunk"，没证明"答案是对的"
> 目标：10 个 query × 3 个维度 = 30 个评分点，覆盖 faithfulness / relevance / completeness

---

## 为什么必须有生成评估

检索 Recall@5=100% 只能说明"相关文档被召回了"。但 LLM 在拿到正确 chunk 之后照样可能：

| 问题 | 示例 | 检索指标能发现吗？ |
|------|------|-----------------|
| **编造事实** | chunk 说"推荐用 Redis"，LLM 说"推荐 Redis Cluster 至少 3 主 3 从" | 不能 |
| **答非所问** | 问"性能如何优化"，LLM 回答"如何部署" | 不能 |
| **遗漏信息** | 答案只说了 A 和 B，漏了 chunk 里也很重要的 C | 不能 |
| **引用混乱** | 把文档 A 的信息归到文档 B | 不能 |

**检索评估是必要不充分条件。生成评估才是 RAG 的终局裁判。**

---

## 评估维度

### Faithfulness（忠实度）1-5

**测的是：LLM 有没有编造 chunk 里不存在的东西。**

```
5 分：所有断言都能在 chunk 中找到原文或明确推断
3 分：大部分来自 chunk，偶有合理补充但无关紧要
1 分：大量编造，或与 chunk 内容直接矛盾
```

典型 1 分场景：
- chunk："推荐使用 Redis 做缓存" → LLM："推荐 Redis Cluster，至少 3 主 3 从"
- chunk："MySQL 8.0 支持窗口函数" → LLM："MySQL 8.0 的窗口函数性能比 PostgreSQL 差"（跨产品比较，chunk 里没有）

### Relevance（相关性）1-5

**测的是：答案是否精准回答了用户的问题，有没有跑题。**

```
5 分：直接切中问题核心，无冗余内容
3 分：部分切题但包含不相关的内容段落
1 分：基本不相关，答非所问
```

典型 1 分场景：
- 问："Redis 有哪些数据结构" → 答了一大段"Redis 怎么安装"

### Completeness（完整性）1-5

**测的是：答案是否覆盖了标注的期望关键信息点。**

```
5 分：覆盖了下面列出的几乎所有关键信息点
3 分：覆盖了一半左右
1 分：遗漏了大部分关键点
```

这个维度依赖评测集的 `expectedKeyPhrases` 字段。

---

## 标注数据升级

当前的 `eval/eval-retrieval.ts` 数据集需要加 `expectedKeyPhrases` 字段：

```typescript
interface EvalItem {
  id: string
  question: string
  relevantDocIds: number[]
  expectedKeyPhrases: string[]    // 新增：答案必须覆盖的信息点
}

const dataset: EvalItem[] = [
  {
    id: 'q01',
    question: 'Go 语言的 GMP 调度模型是什么？',
    relevantDocIds: [26],
    expectedKeyPhrases: [
      'G 代表 goroutine',
      'M 代表 Machine/OS 线程',
      'P 代表 Processor 逻辑处理器',
      'P 的数量由 GOMAXPROCS 决定',
      '本地队列和全局队列',
      'work stealing 机制',
    ],
  },
  {
    id: 'q04',
    question: 'Redis 的持久化机制 RDB 和 AOF 有什么区别？',
    relevantDocIds: [28],
    expectedKeyPhrases: [
      'RDB 是快照方式',
      'AOF 是追加写命令',
      'RDB 恢复快但可能丢失最近数据',
      'AOF 数据更完整但文件更大恢复慢',
    ],
  },
  // ...
]
```

标注 `expectedKeyPhrases` 的原则：
- 每条 3-6 个关键点
- 从对应文档的 ground truth 内容中提取
- 不要求 LLM 输出跟 phrase 一模一样，只要覆盖了对应概念即可

---

## Judge Prompt 设计

### 为什么 Prompt 这么写

Judge 犯错的主要模式：
1. **仁慈偏误**：让 judge 直接打分，它倾向给高分
2. **锚定效应**：先看到 LLM 答案再看 chunk，容易被答案带偏
3. **模糊评分**：不给具体例子，judge 在 3 分和 4 分之间犹豫

对应的设计决策：
1. 强制逐断言验证：要求 judge "逐个断言对照 chunk"，不能泛泛打分
2. Chunk 先于答案：Judge 先读 ground truth（chunk），再读待评答案
3. 每个分档给具体场景说明：让 1/3/5 分的边界清晰

### Prompt

```
你是严格但公正的 RAG 回答评分员。你的任务是根据参考资料（唯一事实来源）对 AI 回答打分。

## 参考资料（唯一的事实来源）
{chunks}

## 用户问题
{question}

## AI 回答
{answer}

## 期望覆盖的关键信息点
{expectedKeyPhrases}

## 评分步骤

请逐条执行以下步骤：

**步骤 1：逐断言验证**
将 AI 回答拆解为独立的断言，逐一在参考资料中寻找支撑。
- 找到支撑 → 标记为 ✓
- 找不到支撑 → 标记为 ✗（这是幻觉）
- 与参考资料矛盾 → 标记为 ⊗（这是错误）

**步骤 2：对照期望信息点**
逐条检查期望覆盖的关键信息点，标记 √（已覆盖）或 ✗（未覆盖）。

**步骤 3：打分**

打分维度：
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

{
  "faithfulness": N,
  "relevance": N,
  "completeness": N,
  "hallucinationCount": N,
  "hallucinationDetail": "幻觉断言摘录",
  "missedKeyPoints": ["遗漏的关键点1", "遗漏的关键点2"],
  "summary": "一句话总结"
}
```

### 为什么选 DeepSeek 当 Judge

- 评估是离线任务，不需要低延迟，可以用更便宜的模型
- DeepSeek-v4-flash 支持 JSON mode 或 temperature=0 降低随机性
- 用 `temperature: 0` 确保评分可复现
- 当前项目已经配好了 `MIMO_API_KEY`，零额外成本

---

## 评估脚本设计

```typescript
// eval/evaluate-generation.ts

import { retrieve } from '../src/services/retrieval.service'
import { askDocument } from '../src/services/chat.service'
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

interface GenEvalItem {
  id: string
  question: string
  relevantDocIds: number[]
  expectedKeyPhrases: string[]
}

interface GenEvalReport {
  questionId: string
  question: string
  answer: string
  answerLength: number
  retrievedDocs: string[]
  retrievalHit5: boolean
  judge: JudgeResult
  overallScore: number    // faithfulness * relevance * completeness 三乘积归一化
  latencyMs: number
}

// ── Judge 调用 ──

async function judgeAnswer(
  question: string,
  answer: string,
  chunks: { title: string; content: string }[],
  expectedKeyPhrases: string[],
): Promise<JudgeResult> {
  const chunkText = chunks
    .map((c, i) => `[资料${i + 1} — ${c.title}]\n${c.content}`)
    .join('\n\n---\n\n')

  const prompt = `你是严格但公正的 RAG 回答评分员...

## 参考资料（唯一的事实来源）
${chunkText}

## 用户问题
${question}

## AI 回答
${answer}

## 期望覆盖的关键信息点
${expectedKeyPhrases.map(p => `- ${p}`).join('\n')}

## 评分步骤
...（完整的 judge prompt）

只输出 JSON，不要任何其他内容。`

  const res = await axios.post(
    `${process.env.MIMO_BASE_URL}/chat/completions`,
    {
      model: process.env.MIMO_MODEL || 'deepseek-v4-flash',
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: { Authorization: `Bearer ${process.env.MIMO_API_KEY}` },
      timeout: 30000,
    },
  )

  const content = res.data?.choices?.[0]?.message?.content || '{}'
  return extractJson(content) as JudgeResult
}

// ── JSON 提取（防 LLM 包裹 markdown 代码块）──

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

// ── 主评估 ──

async function main() {
  const dataset: GenEvalItem[] = [
    // 你的标注数据
  ]

  console.log('╔══════════════════════════════════════════╗')
  console.log('║  Papier RAG 生成质量评估 (LLM-as-Judge)  ║')
  console.log('╚══════════════════════════════════════════╝\n')

  const reports: GenEvalReport[] = []
  let totalScore = 0

  for (const item of dataset) {
    const t0 = Date.now()

    // 1. 检索
    const chunks = await retrieve(item.question, 5)
    const docIds = [...new Set(chunks.map(c => c.documentId))]
    const hit5 = docIds.slice(0, 5).some(id => item.relevantDocIds.includes(id))

    // 2. 生成
    const { answer } = await askDocument(
      item.question,
      chunks.map(c => ({ title: c.documentTitle, content: c.content, score: c.score })),
      false,
    )

    // 3. Judge 评分
    const judge = await judgeAnswer(
      item.question,
      answer,
      chunks.map(c => ({ title: c.documentTitle, content: c.content })),
      item.expectedKeyPhrases,
    )

    const overallScore = (judge.faithfulness / 5) * (judge.relevance / 5) * (judge.completeness / 5)
    totalScore += overallScore

    const report: GenEvalReport = {
      questionId: item.id,
      question: item.question,
      answer,
      answerLength: answer.length,
      retrievedDocs: chunks.slice(0, 3).map(c => c.documentTitle),
      retrievalHit5: hit5,
      judge,
      overallScore,
      latencyMs: Date.now() - t0,
    }

    reports.push(report)

    // 逐题输出
    console.log(`[${item.id}] 忠实度=${judge.faithfulness} 相关性=${judge.relevance} 完整性=${judge.completeness} 幻觉=${judge.hallucinationCount} 综合=${overallScore.toFixed(2)}`)
    if (judge.hallucinationCount > 0) {
      console.log(`   ⚠ 幻觉: ${judge.hallucinationDetail}`)
    }
    if (judge.missedKeyPoints.length > 0) {
      console.log(`   ✗ 遗漏: ${judge.missedKeyPoints.join(', ')}`)
    }
  }

  // ── 汇总 ──
  const n = dataset.length
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
  console.log(`幻觉率 (≥1次幻觉):     ${(reports.filter(r => r.judge.hallucinationCount > 0).length / n * 100).toFixed(0)}%`)
  console.log(`平均延迟:             ${(reports.reduce((s, r) => s + r.latencyMs, 0) / n).toFixed(0)}ms`)

  // ── 三象限诊断 ──
  console.log(`\n${'═'.repeat(80)}`)
  console.log('                       三象限诊断')
  console.log('═'.repeat(80))

  // 象限定义：
  // faithful 高 + 检索 好 = RAG 有效
  // faithful 低 + 检索 好 = LLM 在编造（RAG 最致命的 bug）
  // faithful 高 + 检索 差 = LLM 靠内置知识硬撑（RAG 形同虚设）
  // faithful 低 + 检索 差 = 双输

  const highFidelity = reports.filter(r => r.judge.faithfulness >= 4)
  const lowFidelityHighHit = reports.filter(r => r.judge.faithfulness < 4 && r.retrievalHit5)
  const lowFidelityLowHit = reports.filter(r => r.judge.faithfulness < 4 && !r.retrievalHit5)

  console.log(`RAG 有效 (faithfulness≥4):     ${highFidelity.length}/${n}`)
  console.log(`LLM 编造 (faith<4, 检索OK):    ${lowFidelityHighHit.length}/${n}`)
  if (lowFidelityHighHit.length > 0) {
    console.log('   ⚠ 检索找对了但 LLM 在编造 — 这是 RAG 最致命的 bug')
    for (const r of lowFidelityHighHit) {
      console.log(`     [${r.questionId}] ${r.question.slice(0, 40)} — ${r.judge.hallucinationDetail}`)
    }
  }
  console.log(`检索+生成双输 (faith<4,检索差): ${lowFidelityLowHit.length}/${n}`)
}

main()
```

---

## 验证 Judge 可靠性

LLM-as-Judge 自己也可能犯错。需要用 5 个样本同时做人工评分和 LLM 评分，算相关系数。

```typescript
// 皮尔逊相关系数
function pearson(a: number[], b: number[]): number {
  const n = a.length
  const avgA = a.reduce((s, v) => s + v, 0) / n
  const avgB = b.reduce((s, v) => s + v, 0) / n
  let cov = 0, stdA = 0, stdB = 0
  for (let i = 0; i < n; i++) {
    cov += (a[i] - avgA) * (b[i] - avgB)
    stdA += (a[i] - avgA) ** 2
    stdB += (b[i] - avgB) ** 2
  }
  return cov / Math.sqrt(stdA * stdB)
}
```

人工评分维度：
```
人工faithfulness: [5, 4, 4, 5, 3]
LLM faithfulness:  [5, 4, 3, 5, 3]

相关系数 > 0.8 → Judge 可靠
相关系数 0.5-0.8 → Judge 有偏但可接受
相关系数 < 0.5 → Prompt 需要调整
```

如果相关系数低，检查：
1. Judge 是否在某类答案上系统性偏严/偏松？
2. Prompt 的评分锚点（1/3/5 分的描述）是否不够具体？
3. 是否需要在 Prompt 中加入具体评分示例？

---

## 预期效果

跑完 10 个 query 后，你会拿到这样的诊断表：

```
综合得分: 64%

三象限:
RAG 有效:       6/10   ← 检索+生成都OK
LLM 编造:       2/10   ← 检索对但LLM在编（致命bug）
RAG 形同虚设:    1/10   ← LLM靠内置知识，根本没用到文档
双输:           1/10   ← 检索不对LLM也不对

平均忠实度: 3.8/5   ← LLM 挺诚实，但...
平均完整性: 2.7/5   ← 经常遗漏关键信息点
幻觉率:     30%    ← 10个问题里有3个至少编造了一个事实
```

---

## 集成到现有工作流

```json
// backend/package.json
{
  "scripts": {
    "eval:retrieval": "ts-node src/eval-retrieval.ts",
    "eval:generation": "ts-node src/eval/evaluate-generation.ts",
    "eval:all": "npm run eval:retrieval && npm run eval:generation",
    "precommit": "npm run eval:retrieval && npm test"
  }
}
```

完整的评估流程：

```
1. npm run eval:retrieval    ← 检索指标：Recall@5, MRR, Hit@5
2. npm run eval:generation   ← 生成指标：忠实度, 相关性, 完整性
3. 交叉分析:
   - 检索好 + 生成好 = 系统有效
   - 检索好 + 生成差 = LLM 在编造（最需要 debug 的 case）
   - 检索差 + 生成好 = LLM 靠内置知识（RAG 没起作用）
   - 检索差 + 生成差 = 双输（需要从检索开始重新设计）
```

---

## 常见反驳

### "LLM-as-Judge 自己也会编"

对，但：
- 它比人工评估快 100 倍（跑 10 个 query 的评估只需 ~30 秒，人工打分至少 30 分钟）
- 比什么都不做强 ∞ 倍（现在的状态是"不知道 LLM 有没有编造"）

用 5 个样本做人工交叉验证（算相关系数），确认 Judge 可靠后就可以信任它。

### "完整性评分依赖标注数据，标注太慢了"

对 10 个 query 每个写 3-6 个关键信息点，大概需要 20 分钟。这跟"凭空猜系统好不好"的时间成本不在一个量级上。

### "我想用 RAGAS 框架"

RAGAS 是 LangChain 生态的标准 RAG 评测库，内置 faithfulness / answer_relevancy / context_precision 等指标，跟本文的方案思路一致。可以以后集成，当前的脚本方案可以先跑起来验证想法。

---

## 修改清单

| 文件 | 操作 | 内容 |
|------|------|------|
| `backend/src/eval-retrieval.ts` | 修改 | dataset 加 `expectedKeyPhrases` 字段 |
| `backend/src/eval/evaluate-generation.ts` | 新建 | LLM-as-Judge 评估脚本 |
| `backend/package.json` | 修改 | 增加 `eval:generation` 和 `eval:all` 脚本 |
