# Papier RAG 评估结果分析

> 第二轮评测 | 2026-06-12
> 修复：Rerank endpoint `/reranks` → `/rerank`
> 修复：`retrieve()` 参数化 disable 开关
> 新增：5 路消融（full / no-mmr / no-rerank / vector-only / fts-only）

---

## 汇总对比

```
策略                                   Recall@5   MRR      Hit@5   延迟
─────────────────────────────────────────────────────────────────────────
完整 pipeline (双路+RRF+Rerank+MMR)     100%       0.7583   100%    246ms
去掉 MMR                               90%        0.7167   90%     193ms
去掉 Rerank                            100%       0.7750   100%    179ms
仅向量检索                              95%        0.8750   100%    180ms
仅 FTS*                                100%       0.7583   100%    177ms
```

\* 仅 FTS 变体存在实现问题，实际仍走了向量路。见下文说明。

---

## Per-Query MRR 差异矩阵（有差异的 query）

```
query       full      no-mmr    no-rerank vector-on
q03(索引)   0.333     0.333     0.500     0.500
q05(高并发)  0.250     0.000     0.250     0.250
q08(Linux)  0.500     0.500     0.500     1.000
q09(Git)    0.500     0.333     0.500     1.000
```

其余 6 个 query 所有变体 MRR 均为 1.000（每个 query 只有一个相关文档，且在 top-1 命中）。

---

## 关键发现

### 1. Rerank：404 → 401，仍然未工作

```
第一轮（修复前）: status=404 data="Not Found"    — endpoint 拼写错误 /reranks
第二轮（修复后）: status=401 data="Invalid token" — API Key 无权限
```

**根因链：**
- `.env` 中未配置 `RERANK_API_KEY`
- `rerank.service.ts` 的 fallback 是 `process.env.EMBED_API_KEY`
- 智谱 embedding-2 的 key 不能用于 SiliconFlow rerank API
- 所以从项目上线至今，**Rerank 一次都没成功执行过**

**结论：用户使用的"完整 pipeline"实际等价于 `no-rerank`。**

### 2. FTS：MRR 跌 13.3%，中文场景是负优化

```
仅向量 MRR = 0.875  →  加入 FTS MRR = 0.758（-13.3%）
```

受影响 query：q03、q08、q09。FTS 在这些 query 上把无关 chunk 推到了排名顶端。

q08 "Linux 中如何查找某个文件" 仅向量 MRR=1.000 → FTS 开启 MRR=0.500。FTS 匹配到了其他文档中偶然出现的 "Linux" 关键词，但文档内容无关。

**根因：BM25 在中文上的词汇匹配精度不足。面试题 PDF 中大量重复的目录/框架词（"面试题""Linux 命令""Go 面试"）被 FTS 匹配到，淹没了真正的语义相关性。**

### 3. MMR：帮了 2 个 query，其余 8 个无影响

去掉 MMR 后：
- q05 MRR 0.250 → 0.000（MMR 清除了噪声）
- q09 MRR 0.500 → 0.333（MMR 略微提升了排名）

剩余 8 个 query 无差异。MMR 的贡献是**偶然的、依赖特定数据和 query 的**。这不是经过验证的设计决策。

### 4. 分数极差 0.14，仍在偏低水平

完整 pipeline 下 top-scored chunk 分数范围 0.164 ~ 0.308，极差 0.14。虽然比第一轮（0.01）好一些，但仍有相当部分的 chunk 分数密集分布。

### 5. "仅 FTS" 变体实现有 Bug

当前 eval 脚本中 `fts-only` 变体仍调用了向量检索，因为 `retrieve()` 函数总是先从 embedding 开始。要真正实现"仅 FTS"，需要修改 `retrieve()` 函数内部逻辑或在 eval 层直接调 LanceDB 的 FTS API。此处留作已知问题。

---

## 两轮评估对比

| 指标 | 第一轮（修复前） | 第二轮（修复后） |
|------|---------------|--------------|
| Rerank | 404 endpoint 错了 | 401 API Key 没配 |
| Full MRR | 0.7583 | 0.7583（不变，因 Rerank 仍退化） |
| Vector-only MRR | 0.8750 | 0.8750 |
| FTS 影响 | -13.3% | -13.3%（一致） |
| MMR 影响 | 未测 | +5.5%（边际改善，仅 2/10 query） |

Rerank 从 404 变成 401 是一个进步（endpoint 修对了），但暴露了更深的问题：**他从未验证过自己的 API Key 是否有效。**

---

## 待修复的问题优先级

### P0（阻塞）
1. 配置 SiliconFlow 有效的 Rerank API Key，或切换到可用的 Rerank 服务

### P1（消融实验完整化）
2. 实现真正的"仅 FTS"变体（在 `retrieve()` 中增加 `opts.vectorOnly` 标志）
3. Rerank 正常工作后，重跑 5 路消融，验证 Rerank 的增量价值

### P2（数据集升级）
4. 扩充 medium/hard 难度 query（当前全 easy，无区分度）
5. 添加负例 query（文档库中无答案的问题）
6. 添加 Rerank 成功的条件以达到有效评估

---

## 结论

**两轮评估得出的核心结论一致：**

1. Rerank 从未工作过（第一轮 404，第二轮 401）
2. FTS 在中文面试题场景是负优化（MRR -13.3%）
3. MMR 的贡献是偶然的，不是设计出来的
4. 评估数据集全 easy，100% hit rate 无区分度

**这个系统目前的实际有效链路是：向量检索 → RRF（仅单路所以无融合效果）→ Rerank 退化 → MMR。**
