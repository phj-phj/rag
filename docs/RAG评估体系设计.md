# RAG 系统评估体系设计

> 适用项目：Papier — 团队文档管理与 AI 学习平台
> 评估目标：检索质量 + 生成质量 + 消融实验

---

## 目录

1. [核心原则](#1-核心原则)
2. [标注数据集构建](#2-标注数据集构建)
3. [检索质量评估](#3-检索质量评估)
4. [生成质量评估（LLM-as-Judge）](#4-生成质量评估llm-as-judge)
5. [消融实验](#5-消融实验)
6. [30 分钟现场压力测试](#6-30-分钟现场压力测试)
7. [持续评测工作流](#7-持续评测工作流)

---

## 1. 核心原则

### 1.1 为什么必须有评估体系

当前项目的所有核心设计决策均无数据支撑：

| 决策 | 当前依据 | 应有依据 |
|------|---------|---------|
| MMR λ=0.7 | 拍脑袋 | 消融实验：不同 λ 值下的 recall@5 |
| RRF 两路等权 | 默认值 | 对比实验：向量/FTS 不同权重组合 |
| 语义分块阈值 0.5 | 经验值 | 下游 recall 的分块策略对比 |
| Rerank 的必要性 | 未验证 | 有无 Rerank 的 recall 差异 |
| 文档分类阈值 0.08 | 凭空设定 | 标注数据集上的准确率统计 |

**没有指标 = 黑盒。所有设计决策等于猜测。**

### 1.2 RAG 评估的两条链路

```
用户问题
    │
    ▼
┌─────────────┐
│  检索阶段     │ ← 检索评估：Recall@K, MRR, NDCG@K, Hit@K
│  (Retrieval) │
└──────┬──────┘
       │ Top-K Chunks
       ▼
┌─────────────┐
│  生成阶段     │ ← 生成评估：Faithfulness, Relevance, Completeness
│  (Generation)│
└──────┬──────┘
       │
       ▼
    最终答案
```

检索好但生成烂 = 浪费时间。检索烂但生成好 = 靠 LLM 内置知识硬撑（RAG 形同虚设）。必须两条都评。

---

## 2. 标注数据集构建

### 2.1 为什么要手工标注

LLM 无法替代人工标注 ground truth。LLM 不知道自己编了什么。你传了"HashMap 原理"的文档进去，LLM 回答的内容可能来自你的文档，也可能来自它的训练数据。只有你知道你的文档里有什么。

### 2.2 数据集结构

```typescript
// eval/dataset.ts

interface EvalItem {
  id: string
  question: string
  relevantDocIds: number[]           // 宽松标注：哪些文档包含答案
  strictRelevantChunks?: {            // 严格标注：具体 chunk（可选，工作量大）
    docId: number
    chunkIndex: number
  }[]
  expectedKeyPhrases: string[]       // 答案中必须覆盖的信息点
  difficulty: 'easy' | 'medium' | 'hard'
}

const dataset: EvalItem[] = [
  {
    id: 'q01',
    question: 'MySQL 主从复制怎么配置？',
    relevantDocIds: [3, 7],
    expectedKeyPhrases: [
      'CHANGE MASTER TO',
      'binlog',
      'server-id',
      'relay-log',
    ],
    difficulty: 'medium',
  },
  {
    id: 'q02',
    question: 'Docker Compose 的 depends_on 和 links 有什么区别？',
    relevantDocIds: [5],
    expectedKeyPhrases: [
      'depends_on 控制启动顺序',
      'links 已废弃',
      '服务间通信用 network',
    ],
    difficulty: 'medium',
  },
]
```

### 2.3 标注规范

**宽松标注（推荐先做）**：只要文档在内容上覆盖了相关主题即标为 relevant。工作量大但标准清晰。

**标注要求**：
- 最少 10 个问题，推荐 30 个
- 覆盖不同主题（至少 3 个不同类别的文档）
- 覆盖不同难度：
  - **简单**：关键词匹配，检索该秒出（如 "什么是 Redis"）
  - **中等**：需要语义理解，同义词映射（如 "如何加速数据库查询" ← 文档里写的是 "索引优化"）
  - **困难**：多文档综合、跨段落推理（如 "这三个架构方案对比"）

### 2.4 标注陷阱

**你会在标注过程中发现的问题**（这些本身就是认知提升）：

1. **边界模糊**：一篇文档讲"MySQL 索引优化"，另一篇讲"SQL 调优"，用户问"怎么优化数据库性能"，两篇都相关？一篇部分相关？
   - 解决：引入分级相关度（0=无关，1=部分相关，2=高度相关），用于 NDCG 计算

2. **你的文档你也不熟**：你传了 50 篇文档，问你这 50 篇里哪几篇讲了 X，你答不上来。
   - 解决：在标注之前先浏览一遍文档列表，对内容有个大概印象

3. **LLM 的内置知识干扰**：你看到 LLM 的答案觉得很完整，但分不清从哪里来的。
   - 解决：标注时只看检索结果，不看 LLM 的答案

---

## 3. 检索质量评估

### 3.1 评估脚本

```typescript
// eval/evaluate.ts

import { retrieve } from '../src/services/retrieval.service'
import type { RetrievedChunk } from '../src/services/retrieval.service'

interface EvalItem {
  id: string
  question: string
  relevantDocIds: number[]
}

interface RetrievalMetrics {
  recallAt3: number
  recallAt5: number
  recallAt10: number
  mrr: number
  hitAt5: number
}

interface EvalReport {
  perQuery: Array<{
    id: string
    question: string
    retrieved: RetrievedChunk[]
    metrics: RetrievalMetrics
  }>
  average: RetrievalMetrics
  totalLatencyMs: number
  avgLatencyMs: number
}

// ── Hit@K：前K个结果中至少命中一个相关文档 ──
function hitRate(retrieved: number[], relevant: number[], k: number): number {
  const topK = retrieved.slice(0, k)
  return topK.some(id => relevant.includes(id)) ? 1 : 0
}

// ── Recall@K：相关文档被召回的比例 ──
function recallAtK(retrieved: number[], relevant: number[], k: number): number {
  if (relevant.length === 0) return 0
  const topK = retrieved.slice(0, k)
  const hit = topK.filter(id => relevant.includes(id)).length
  return hit / relevant.length
}

// ── MRR：第一个相关文档排名的倒数 ──
function mrr(retrieved: number[], relevant: number[]): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (relevant.includes(retrieved[i])) return 1 / (i + 1)
  }
  return 0
}

// ── NDCG@K：归一化折损累积增益（支持分级相关度） ──
function ndcgAtK(
  retrieved: number[],
  relevanceMap: Map<number, number>,  // docId → relevance (0/1/2)
  k: number,
): number {
  const topK = retrieved.slice(0, k)
  const rels = topK.map(id => relevanceMap.get(id) ?? 0)

  // DCG
  let dcg = 0
  for (let i = 0; i < rels.length; i++) {
    dcg += (Math.pow(2, rels[i]) - 1) / Math.log2(i + 2)
  }

  // IDCG：理想排序
  const ideal = [...rels].sort((a, b) => b - a)
  let idcg = 0
  for (let i = 0; i < ideal.length; i++) {
    idcg += (Math.pow(2, ideal[i]) - 1) / Math.log2(i + 2)
  }

  return idcg === 0 ? 0 : dcg / idcg
}

// ── 主评估函数 ──
async function evaluateRetrieval(dataset: EvalItem[]): Promise<EvalReport> {
  const totalStart = Date.now()
  const perQuery: EvalReport['perQuery'] = []

  for (const item of dataset) {
    const t0 = Date.now()
    const chunks = await retrieve(item.question, 10)
    const latencyMs = Date.now() - t0

    const docIds = chunks.map(c => c.documentId)
    // 去重保持顺序
    const uniqueDocIds = [...new Set(docIds)]

    perQuery.push({
      id: item.id,
      question: item.question,
      retrieved: chunks.slice(0, 5),
      metrics: {
        recallAt3: recallAtK(uniqueDocIds, item.relevantDocIds, 3),
        recallAt5: recallAtK(uniqueDocIds, item.relevantDocIds, 5),
        recallAt10: recallAtK(uniqueDocIds, item.relevantDocIds, 10),
        mrr: mrr(uniqueDocIds, item.relevantDocIds),
        hitAt5: hitRate(uniqueDocIds, item.relevantDocIds, 5),
      },
    })
  }

  const avg = (key: keyof RetrievalMetrics) =>
    perQuery.reduce((s, r) => s + r.metrics[key], 0) / perQuery.length

  return {
    perQuery,
    average: {
      recallAt3: avg('recallAt3'),
      recallAt5: avg('recallAt5'),
      recallAt10: avg('recallAt10'),
      mrr: avg('mrr'),
      hitAt5: avg('hitAt5'),
    },
    totalLatencyMs: Date.now() - totalStart,
    avgLatencyMs: (Date.now() - totalStart) / dataset.length,
  }
}

// ── 运行入口 ──
async function main() {
  const dataset: EvalItem[] = [
    // 你的标注数据
  ]

  const report = await evaluateRetrieval(dataset)

  console.log('=== 检索评估报告 ===')
  console.log(`Recall@5:  ${(report.average.recallAt5 * 100).toFixed(1)}%`)
  console.log(`Recall@10: ${(report.average.recallAt10 * 100).toFixed(1)}%`)
  console.log(`MRR:       ${report.average.mrr.toFixed(4)}`)
  console.log(`Hit@5:     ${(report.average.hitAt5 * 100).toFixed(1)}%`)
  console.log(`平均延迟:  ${report.average.avgLatencyMs.toFixed(0)}ms`)
  console.log('')

  console.log('=== 逐 Query 详情 ===')
  for (const q of report.perQuery) {
    console.log(`\n[${q.id}] ${q.question}`)
    console.log(`  Recall@5: ${(q.metrics.recallAt5 * 100).toFixed(0)}%  Hit@5: ${q.metrics.hitAt5 ? '✓' : '✗'}  MRR: ${q.metrics.mrr.toFixed(3)}`)
    for (let i = 0; i < Math.min(5, q.retrieved.length); i++) {
      const c = q.retrieved[i]
      console.log(`  #${i + 1} [${c.documentTitle}] score=${c.score.toFixed(3)} "${c.content.slice(0, 50)}..."`)
    }
  }
}

main()
```

### 3.2 如何解读指标

| 指标 | 好 | 一般 | 差 | 含义 |
|------|-----|------|-----|------|
| Hit@5 | >80% | 50-80% | <50% | 前 5 个里至少有一篇有效文档 |
| MRR | >0.6 | 0.3-0.6 | <0.3 | 最佳文档排在第几位（1.0=第一位, 0.5=第二位） |
| Recall@5 | >0.6 | 0.3-0.6 | <0.3 | 相关文档被召回的比例 |
| Avg Latency | <500ms | 500-1500ms | >1500ms | 检索延迟 |

**RAG 场景下，Hit@5 和 MRR 是最关键的两个指标。**
- Hit@5 低 = LLM 经常拿不到任何有用信息 → 答案全靠编
- MRR 低 = 有用信息排在了第 4-5 位，前面被无关信息占了 → LLM 被噪声带偏

---

## 4. 生成质量评估（LLM-as-Judge）

### 4.1 为什么需要

检索找对了 chunk，LLM 照样可能：
- **编造事实**（faithfulness 问题）：chunk 里说"推荐用 Redis"，LLM 说"推荐用 Redis Cluster，至少 3 主 3 从"
- **答非所问**（relevance 问题）：用户问性能优化，LLM 回答部署步骤
- **遗漏关键信息**（completeness 问题）：答案只说了 A，没提 B 和 C

### 4.2 评估脚本

```typescript
// eval/judge.ts

const JUDGE_PROMPT = `你是严格但公正的 RAG 回答评分员。

## 评分维度

1. **忠实度** (1-5)：回答中的所有事实是否**严格**能在参考资料中找到？
   - 5分：全部事实来自参考资料，无外部知识
   - 3分：大部分来自资料，偶有无关的补充
   - 1分：大量编造或与资料矛盾

2. **相关性** (1-5)：回答是否精准切题？
   - 5分：直接回答问题核心，无废话
   - 3分：部分切题但有跑题内容
   - 1分：基本不相关

3. **完整性** (1-5)：是否覆盖了期望的关键信息点？
   - 5分：覆盖了下面列出的几乎所有关键点
   - 3分：覆盖了一半左右
   - 1分：遗漏了大部分关键点

## 期望覆盖的关键信息点
{expectedKeyPhrases}

## 参考资料（唯一的事实来源）
{chunks}

## AI 回答
{answer}

## 你的评分
请严格检查回答中的每一个断言是否能对应到参考资料。只输出 JSON：

{"faithfulness": N, "relevance": N, "completeness": N, "explanation": "一句话解释"}`

interface JudgeResult {
  faithfulness: number
  relevance: number
  completeness: number
  explanation: string
}

async function judgeAnswer(
  question: string,
  answer: string,
  chunks: { title: string; content: string }[],
  expectedKeyPhrases: string[],
): Promise<JudgeResult> {
  const chunksText = chunks
    .map((c, i) => `[参考资料${i + 1} — ${c.title}]\n${c.content}`)
    .join('\n\n')

  const prompt = JUDGE_PROMPT
    .replace('{expectedKeyPhrases}', expectedKeyPhrases.map(p => `- ${p}`).join('\n'))
    .replace('{chunks}', chunksText)
    .replace('{answer}', answer)

  // 调用 LLM（用现有的 DeepSeek 配置）
  const axios = (await import('axios')).default
  const res = await axios.post(
    `${process.env.MIMO_BASE_URL}/chat/completions`,
    {
      model: process.env.MIMO_MODEL || 'deepseek-v4-flash',
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: { Authorization: `Bearer ${process.env.MIMO_API_KEY}` },
    },
  )

  const json = JSON.parse(res.data.choices[0].message.content)
  return json as JudgeResult
}
```

### 4.3 评估结果示例

```typescript
// 每道题的评估输出
{
  questionId: 'q01',
  question: 'MySQL 主从复制怎么配置？',
  answer: 'MySQL 主从复制配置需要...',
  retrieval: { recallAt5: 0.67, hitAt5: true },
  generation: {
    faithfulness: 4,   // 基本忠实，仅一处引用了非文档内容
    relevance: 5,      // 精准切题
    completeness: 3,   // 缺了 relay-log 的说明
  },
  overall: '检索有效，但生成遗漏了 relay-log 配置细节 — 检查第5个 chunk 是否被截断',
}
```

---

## 5. 消融实验

### 5.1 实验设计

消融实验的核心思想：**逐个移除/替换 pipeline 中的环节，观察指标变化**。

```typescript
// eval/ablation.ts

// ── 策略变体 ──
const strategies = [
  {
    name: 'full',
    label: '完整 pipeline（双路+RRF+Rerank+MMR）',
  },
  {
    name: 'no-mmr',
    label: '去掉 MMR 去重',
  },
  {
    name: 'no-rerank',
    label: '去掉 Rerank 精排',
  },
  {
    name: 'vector-only',
    label: '仅向量检索',
  },
  {
    name: 'fts-only',
    label: '仅 FTS 全文检索',
  },
]

// ── 分块策略变体 ──
const chunkingStrategies = [
  {
    name: 'semantic',
    label: '语义分块（现行方案）',
  },
  {
    name: 'paragraph',
    label: '段落分块（回退方案）',
  },
  {
    name: 'fixed-window',
    label: '固定窗口分块（250字+50字重叠）',
  },
]

// ── MMR λ 参数扫描 ──
const mmrLambdaValues = [0.3, 0.5, 0.7, 0.9, 1.0]
```

### 5.2 实验报告模板

运行后会得到这样的表格：

| 策略 | Recall@5 | MRR | Hit@5 | 平均延迟 |
|------|---------|-----|-------|---------|
| 完整 pipeline | 40.0% | 0.420 | 60% | 1200ms |
| 去掉 MMR | **43.0%** | **0.445** | **65%** | 1150ms |
| 去掉 Rerank | 35.0% | 0.380 | 55% | 800ms |
| 仅向量检索 | 32.0% | 0.350 | 50% | 600ms |
| 仅 FTS 检索 | 28.0% | 0.310 | 45% | 400ms |

**读表方法**：
1. 去掉 MMR 后 Recall 反而涨了 → MMR 多干了坏事，当前的 Jaccard 度量在中文场景无效
2. Rerank 带来了 +8% 的提升，但多花了 400ms → 如果可以接受延迟，值得保留
3. 双路融合比单路有明显提升 → RRF 是有效的
4. FTS 单路有 45% 的 Hit@5 → 说明有相当一部分问题是关键词敏感的，中文 embedding 在这些 query 上不给力

### 5.3 什么叫"合理的消融结论"

好的消融实验会让你看到三种情况之一：

**A. 某环节确实有用**：
```
仅向量 48% → +双路 55% → +Rerank 62% → +MMR 60% (微降)
结论：保留双路和 Rerank，去掉 MMR
```

**B. 某环节是纯装饰**：
```
完整 pipeline 45% → 去掉 MMR 45%
结论：MMR 在当前实现下无任何作用，可以删除
```

**C. 某环节帮倒忙**：
```
完整 pipeline 40% → 去掉 MMR 48%
结论：MMR 当前实现在破坏检索质量，应立即下线
```

无论哪种结果，都比"我觉得它有用"强一万倍。

---

## 6. 30 分钟现场压力测试

### 6.1 目标

当场验证三件事：
1. 系统能跑出 recall 数字
2. MMR 和 Rerank 到底有没有用
3. 你有没有做过任何形式的自评

### 6.2 操作步骤

```
第一轮（10 分钟）：建评测集
  → 选 10 篇已上传文档
  → 手写 8 个 QA 对（标注相关文档 ID）
  → 跑 baseline：vector-only 的 recall@5

第二轮（10 分钟）：跑完整 pipeline
  → 跑完整 pipeline：双路+RRF+Rerank+MMR
  → 跑 no-mmr 变体
  → 对比三组数字

第三轮（10 分钟）：分析
  → 找出 recall=0 的 query，查分块和 embedding
  → 找出 MMR 导致的 diff
  → 当场解释"你的系统在哪些 query 上失败了，为什么"
```

### 6.3 会暴露什么问题

**如果 recall@5 很低（<30%）**：
→ 根因可能是分块策略有问题、chunk 太碎或太长、embedding 模型选型不匹配

**如果去掉 MMR 后 recall 显著提升（>10%）**：
→ 说明 MMR 的 Jaccard 实现在中文场景下是负优化
→ 这是当场无法推脱的 bug，不是"我觉得"能圆回来的

**如果某个 query 的 recall=0**：
→ 说明标注相关的文档里根本没有包含可检索的信息
→ 或者文档被切成了检索不到的碎片
→ 这暴露了分块策略的硬伤

---

## 7. 持续评测工作流

### 7.1 融入 CI

```json
// backend/package.json
{
  "scripts": {
    "eval": "ts-node eval/evaluate.ts",
    "eval:quick": "ts-node eval/evaluate.ts --limit 10",
    "precommit": "npm run eval:quick && npm test"
  }
}
```

每次改了检索逻辑、调了参数、换了模型，跑一遍 `npm run eval` 看指标是否劣化。

### 7.2 评测驱动的开发循环

```
     ┌──────────────────────┐
     │ 1. 设定目标指标       │  ← recall@5 从 0.4 提到 0.55
     └──────┬───────────────┘
            ▼
     ┌──────────────────────┐
     │ 2. 跑 baseline       │  ← 记下当前 0.4
     └──────┬───────────────┘
            ▼
     ┌──────────────────────┐
     │ 3. 修改代码           │  ← 换个 chunk 策略 / 调整 RRF 权重
     └──────┬───────────────┘
            ▼
     ┌──────────────────────┐
     │ 4. 跑评估             │  ← 0.42 — 有进步但不够
     └──────┬───────────────┘
            ▼
     ┌──────────────────────┐
     │ 5. 对比 diff，分析错误 │  ← 哪几个 query 没变好？为什么？
     └──────┬───────────────┘
            ▼
     ┌──────────────────────┐
     │ 6. 迭代直到达标        │
     └──────────────────────┘
```

### 7.3 每次迭代要回答的四个问题

1. 这次改动让哪些 query 变好了？（看 per-query diff）
2. 让哪些 query 变差了？（改出回归了）
3. 整体指标的提升是不是统计显著的？（30 个样本跑 3 次取平均）
4. 改动的代价是什么？（延迟、存储、API 费用）

---

## 附录：常见反驳与回应

### 反驳 1："评估脚本很简单，我回去就写"

**回应**：既然是简单的，现在就写。选 10 篇文档，出 8 个问题，当场跑。回去写 = 永远不会写。

### 反驳 2："我的系统我自己试过，能回答问题"

**回应**：你自己试过 10 个问题觉得"还行"，但你的 MMR λ 是 0.7，Rerank 引入了额外的 API 延迟，双路检索代码 100 行。你不知道这里面哪些环节在产生价值，哪些在浪费资源。评测的目的不是证明系统能跑，是证明每个环节值它的复杂度。

### 反驳 3："指标太高不现实，用户满意就行"

**回应**：你没有用户满意度的数据。你也没有任何指标。你现在的状态是"不知道系统好不好，但假设它好"。评测不是为了追求 100%，是为了一旦系统变坏你能第一时间知道。

### 反驳 4："LLM-as-Judge 自己也会犯错"

**回应**：对，LLM-as-Judge 不是完美的，但它是目前可用的最佳实践。它比人类评估快 100 倍，比什么都不做强 1000 倍。你可以用"对 10 个样本同时做人工评分和 LLM 评分，计算相关系数"来验证你的 judge 是否可靠。

---

## 总结

| 你现在的情况 | 你该有的样子 |
|------------|------------|
| 不知道 recall 是多少 | 每次改动前跑一遍评估 |
| 不知道 MMR 有没有用 | 消融实验告诉你 0.7 的 λ 是否合理 |
| 不知道哪个 query 会失败 | per-query 错误分析 locate 失败的根因 |
| 不知道系统有没有退化 | git hook + CI 自动跑评估 |

**评估不是证明你厉害，是让你知道哪里不厉害。这是工程师唯一诚实的镜子。**
