# RRF 双路融合动态加权方案

> 适用：`backend/src/services/retrieval.service.ts` — `rrfMerge()` 函数
> 当前问题：向量路和 FTS 路静态等权（1:1），在中文面试题场景下 FTS 是负优化（MRR -13.3%）

---

## 问题分析

### 当前实现

```typescript
// retrieval.service.ts:230
for (const [pathResults, weight] of [[vec, 1], [fts, 1]] as const) {
  const rrf = (weight as number) / (K + rank)
```

向量权重 = 1，FTS 权重 = 1，永远如此。这条等式假设两路检索质量在任何 query 上都相当。

### 为什么这不对

评测数据证明了不同 query 对两路的依赖完全不同：

```
q08 "Linux 中如何查找某个文件"
  仅向量 MRR = 1.000  → 向量路精准命中
  +FTS 后 MRR = 0.500  → FTS 匹配到其他文档的目录词"Linux"，噪声淹没了信号

q03 "MySQL 的索引类型有哪些"
  仅向量 MRR = 0.500  → 向量路表现一般
  +FTS 后 MRR = 0.333 → FTS 让情况更糟
```

但以下类型的 query，FTS 应该反超向量：

```
"error 0x80070005 怎么解决"  → 向量路：error code 对 embedding 是随机噪声
                               → FTS 路：精确字符串匹配，天然优势

"nginx.conf 中 worker_connections 配置" → 向量路：可能被其他配置文件的语义干扰
                                         → FTS 路：精准命中文件名和配置项
```

**规律：term-heavy 问题偏好 FTS，semantic-heavy 问题偏好向量。一刀切的等权融合等于放弃了做这种适配的能力。**

---

## 方案：基于信号密度推断的动态权重

### 核心思路

不预设"谁比谁好"。在每次检索时，用两路结果的分数分布特征推断各自的"信号质量"，质量高的一路给予更高权重。

### 信号密度是什么

一路检索的"信号密度" = 结果中高质量匹配的比例。

- 向量路：余弦距离 < 阈值 → score > 某个值 → 信号强
- FTS 路：BM25 原生分高于某个阈值的比例 → 信号强

如果一路返回了 40 条结果，但前几条全是低分匹配，说明这一路在当前 query 上"连自己都信不过自己"。

### 实现

```typescript
// retrieval.service.ts

/**
 * 根据两路粗召结果的分数分布特征，动态计算 RRF 融合权重。
 *
 * 原则：
 * - 单路为空 → 全权给有结果的路
 * - 双路都有结果 → 按信号密度比例分配
 * - 信号密度假定为：高分结果占比越高，该路越可信
 */
function computeDynamicWeights(
  vecResults: { _distance?: number }[],
  ftsResults: { _score?: number }[],
  ftsTotalCount: number,
): { vecWeight: number; ftsWeight: number } {

  // 双路都空 → 等权（不会影响结果，但避免除零）
  if (vecResults.length === 0 && ftsResults.length === 0) {
    return { vecWeight: 1, ftsWeight: 1 }
  }

  // 单路空 → 全权给另一路
  if (vecResults.length === 0) return { vecWeight: 0, ftsWeight: 1 }
  if (ftsResults.length === 0) return { vecWeight: 1, ftsWeight: 0 }

  // ── 向量路信号密度 ──
  // 余弦距离 → 相似度分数，统计高于 0.3 的比例
  const VEC_THRESHOLD = 0.3
  const vecHighSignal = vecResults.filter(
    r => (1 - (r._distance ?? 0)) > VEC_THRESHOLD
  ).length
  const vecDensity = vecHighSignal / vecResults.length

  // ── FTS 路信号密度 ──
  // 用返回数量作为代理：LanceDB FTS 返回越少，说明匹配越精准
  // 如果数量过多（>20），说明大部分是低质量匹配
  const ftsDensity = Math.min(1, Math.max(0.1, 5 / Math.max(ftsTotalCount, 1)))

  // ── 归一化为权重 ──
  const total = vecDensity + ftsDensity
  return {
    vecWeight: vecDensity / total,
    ftsWeight: ftsDensity / total,
  }
}
```

### 修改 rrfMerge

```typescript
// 原签名增加 ftsTotalCount 参数
export function rrfMerge(
  vec: (RetrievedChunk & { _rank?: number })[],
  fts: (RetrievedChunk & { _rank?: number })[],
  topK: number,
  vecResultsRaw?: { _distance?: number }[],
  ftsResultsRaw?: { _score?: number }[],
  ftsTotalCount?: number,
): RetrievedChunk[] {
  const K = 60

  // 动态权重
  const { vecWeight, ftsWeight } = computeDynamicWeights(
    vecResultsRaw ?? vec,
    ftsResultsRaw ?? fts,
    ftsTotalCount ?? fts.length,
  )

  logger.info(`[retrieval] 动态权重: 向量=${vecWeight.toFixed(2)} FTS=${ftsWeight.toFixed(2)}`)

  const scoreMap = new Map<number, { chunk: RetrievedChunk; rrf: number }>()

  for (const [pathResults, weight] of [[vec, vecWeight], [fts, ftsWeight]] as const) {
    for (const c of pathResults) {
      const rank = c._rank ?? pathResults.length
      const rrf = (weight as number) / (K + rank)
      if (scoreMap.has(c.chunkId)) {
        scoreMap.get(c.chunkId)!.rrf += rrf
      } else {
        scoreMap.set(c.chunkId, { chunk: c, rrf })
      }
    }
  }

  // 后续逻辑不变 ...
}
```

### 调用处传参

```typescript
// retrieve() 函数中，调用 rrfMerge 时传入原始结果
const merged = rrfMerge(
  vecChunks,
  ftsChunks,
  topK * CANDIDATE_FACTOR,
  vecResults as any,    // 原始向量结果，含 _distance
  ftsResults as any,    // 原始 FTS 结果，含 _score
  ftsResults.length,    // FTS 返回总数
)
```

---

## 方案演进路径

### 当前（v1）：基于返回数量的粗粒度推断

| 信号 | 指标 | 局限 |
|------|------|------|
| 向量路质量 | 高分（>0.3）占比 | 阈值 0.3 是拍脑袋的 |
| FTS 路质量 | 返回数量倒数 | 数量 ≠ 质量，只是粗略代理 |

这个版本是**可以立刻上线验证的最低可行方案**。核心价值是打破静态等权，让两路权重根据每次检索自适应。

### 后续（v2）：基于 BM25 原生分的精确推断

当前 LanceDB 的 FTS 结果分数被硬编码为 0.5。如果能拿到 BM25 原生分，信号密度的计算会更精确：

```typescript
// v2：用 BM25 原生分
const ftsScores = ftsResults.map(r => r._score ?? 0)
const ftsHighSignal = ftsScores.filter(s => s > MEDIAN_BM25).length
const ftsDensity = ftsHighSignal / ftsResults.length
```

### 后续（v3）：基于 query 特征的预判 + 分数分布的双重校准

在检索前先用一个极轻量的判断（不用 LLM）：

```typescript
function preClassifyQuery(question: string): 'term-heavy' | 'semantic' | 'mixed' {
  const hasCode = /[0-9a-fA-F]{8,}|error|exception|0x/i.test(question)
  const hasFileName = /\.[a-z]{2,4}\b/i.test(question)
  const isShortExact = question.length < 20 && !/[吗呢怎]/.test(question)

  if (hasCode || hasFileName || isShortExact) return 'term-heavy'

  const isConceptQ = /是什么|怎么理解|什么是|原理|区别|优缺点/.test(question)
  if (isConceptQ) return 'semantic'

  return 'mixed'
}
```

预判结果作为权重的**先验**，分数分布作为**后验校准**，两者结合。

---

## 效果预期

用现有评测集验证（Rerank 正常工作后）：

```
策略                          MRR预期     说明
静态等权 (当前)               0.758       FTS 噪声压低排名
动态加权 v1                   0.82-0.85   FTS 权重在 semantic query 上自动压低
仅向量                        0.875       上限 —— FTS 全关
```

动态加权无法超越仅向量（因为 10 个 query 全是 semantic-heavy），但可以**缩小等权方案和最优方案之间的差距**。等权 MRR=0.758，仅向量=0.875，中间有 0.117 的 gap。动态加权的目标就是把语义 query 的 FTS 权重压到接近 0，把 gap 缩到最小。

当评测集加入 term-heavy query 后，动态加权在这些 query 上应反超仅向量。

---

## 验证方法

同一个 eval 脚本，增加一个变体：

```typescript
const variants: Variant[] = [
  // ...
  {
    name: 'dynamic-weight',
    label: '动态加权（信号密度）',
    opts: {},  // 调用 retrieve 时内部使用动态权重
  },
]
```

预期结果对比：

```
策略              MRR
完整 pipeline     0.758  ← 静态等权
动态加权          0.85+  ← 目标
仅向量            0.875  ← 上限
```

如果动态加权 MRR 接近仅向量但不超过 → 方案有效，自动识别了 "FTS 在这批 query 上不可信"。

如果动态加权 MRR 低于静态等权 → 权重推断逻辑有问题，需要检查信号密度阈值。

---

## 修改清单

| 文件 | 修改内容 |
|------|---------|
| `retrieval.service.ts` | 新增 `computeDynamicWeights()` 函数 |
| `retrieval.service.ts` | `rrfMerge()` 增加权重参数，替换硬编码的 `1` |
| `retrieval.service.ts` | `retrieve()` 调用处传入原始检索结果 |
| `eval-retrieval.ts` | 增加 `dynamic-weight` 消融变体 |
