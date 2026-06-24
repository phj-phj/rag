import path from 'path'
import { ChatOpenAI } from '@langchain/openai'
import axios from 'axios'
import { Question } from '../models'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('question-generation')
import { getDocumentTextForChunking } from './extraction.service'
import {
  splitForExtraction,
  parseExtractionResponse,
  extractKnowledgePoint,
} from './question-utils'

async function retry429<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let i = 0; i < 5; i++) {
    try { return await fn() }
    catch (e: any) {
      if (e?.status === 429 || e?.lc_error_code === 'MODEL_RATE_LIMIT') {
        await new Promise(r => setTimeout(r, (i + 1) * 2000))
        continue
      }
      throw e
    }
  }
  throw new Error(`[${label}] 重试5次后仍失败`)
}

const generationLlm = new ChatOpenAI({
  model: process.env.MIMO_TRAIN_MODEL || 'deepseek-v4-flash',
  temperature: 0.3,
  maxTokens: 4096,
  apiKey: process.env.MIMO_API_KEY || '',
  configuration: {
    baseURL:
      process.env.MIMO_BASE_URL || 'https://api.deepseek.com/v1',
  },
})

const GENERATION_PROMPT = `你是一个只能看到以下参考资料的人。你没有学过任何编程语言和数据库，没有背过八股文，不知道任何参考资料之外的知识。

请根据参考资料出论述题。

规则：
1. 答案中的所有细节必须能在参考资料中找到原文对应。你"本来就懂"的知识一律不准用
2. 以 JSON 数组格式输出: [{"q": "题目", "a": "答案"}, ...]
3. 题干必须自包含：禁止出现"根据面经""结合本文""参考资料""根据文档""文中提到"等引用来源的表述
4. 答案中禁止引用来源，直接给出知识点的核心内容

出 {count} 道题。

参考资料：
{chunk}`

// ── 忠实度闸门：逐题验证答案是否来自原文 ──

const FAITHFULNESS_THRESHOLD = 4

async function judgeFaithfulness(
  stem: string,
  explanation: string,
  chunk: string,
): Promise<{ pass: boolean; score: number; detail: string }> {
  const prompt = `你是一个严格的审题人。判断这道题的答案是否忠实于原始资料。

## 原始资料（唯一的事实来源）
${chunk.slice(0, 5000)}

## 题目
${stem}

## 答案
${explanation}

## 检查步骤
逐句对照答案与原始资料：答案中的每一个细节是否都能在原始资料中找到对应原文？
- 如果原文只提了概念名但没给具体解释，而答案给出了详细解释 → 不忠实
- 如果原文给了完整解释，答案的表达与此一致 → 忠实
- 如果答案引用了原文没有的数字、步骤、版本号、命令 → 不忠实

你的评分（1-5）：
- 5：全部来自原文，无任何外部知识或主观扩展
- 4：主体来自原文，仅做了不影响正确性的表述转换（如换说法、合并句子）
- 3：大部分来自原文，少量合理归纳，但有个别细节原文未明确支持
- 2：只有一部分能在原文找到依据，存在明显的外部知识补全
- 1：大量编造，几乎没有原文支撑

只输出 JSON：
{"score":N,"detail":"逐句对比结论，如果≥4分写无"}`

  const apiBase = process.env.MIMO_BASE_URL || 'https://api.deepseek.com/v1'
  const apiKey = process.env.MIMO_API_KEY || ''
  const judgeModel = process.env.FAITHFULNESS_JUDGE_MODEL || 'deepseek-reasoner'

  try {
    const body: Record<string, any> = {
      model: judgeModel,
      temperature: 0,
      max_tokens: judgeModel.includes('reasoner') ? 4000 : 300,
      messages: [{ role: 'user', content: prompt }],
    }
    if (judgeModel.includes('reasoner')) {
      body.reasoning_effort = 'medium'
    }
    const res = await axios.post(
      `${apiBase}/chat/completions`,
      body,
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      },
    )

    const text = res.data?.choices?.[0]?.message?.content || '{}'
    let json: any
    try { json = JSON.parse(text) } catch { json = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]) }
    return {
      pass: (json.score || 0) >= FAITHFULNESS_THRESHOLD,
      score: json.score || 0,
      detail: json.detail || '',
    }
  } catch (err) {
    logger.warn(`[预生成] 忠实度检查失败，默认通过: ${(err as Error).message}`)
    return { pass: true, score: FAITHFULNESS_THRESHOLD, detail: '检查失败，默认放行' }
  }
}

// ── 语义信息密度：实体数量 / 总字符数 ──

const DENSITY_THRESHOLD = 0.01 // 每 100 字符至少 1 个实体

const ENTITY_PATTERNS: RegExp[] = [
  // 数字（含小数、百分比、版本号）
  /\d+(?:\.\d+)?%?/g,
  // 公式：赋值、数学/化学表达式（含希腊字母 Unicode）
  /[=+\-*/^±×÷√∑∏∫∂∇∈∉⊂⊃∧∨¬⇒⇔α-ωΑ-Ω∞≈≠≤≥]|:=|=>|->/g,
  // 代码标识符：camelCase / snake_case / UPPER_CASE
  /\b[a-z]+(?:[A-Z][a-z]+)+|\b[a-z]+_[a-z]+(?:_[a-z]+)*|\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g,
  // 英文专有名词（连续大写开头字母，至少 2 字符）
  /\b[A-Z][a-zA-Z]{1,}(?:\s+[A-Z][a-zA-Z]{1,}){0,3}\b/g,
  // 书名号 / 引号内的专名
  /《[^》]+》/g,
  /「[^」]+」/g,
  // 路径 / URL / IP
  /(?:\/[a-zA-Z0-9._-]+)+\.[a-z]{2,}|\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
  // 命令行参数 / 环境变量
  /--?[a-zA-Z][a-zA-Z0-9-]*|\b[A-Z_][A-Z0-9_]{2,}\b/g,
  // 日期时间
  /\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}:\d{2}(?::\d{2})?/g,
]

export function computeSemanticDensity(text: string): number {
  if (!text || text.length === 0) return 0

  const entities = new Set<number>()
  for (const pattern of ENTITY_PATTERNS) {
    // 重置 lastIndex（global regex 有状态）
    pattern.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = pattern.exec(text)) !== null) {
      // 用匹配位置去重（同一段文本被多个 pattern 命中只计一次）
      entities.add(m.index)
    }
  }

  return entities.size / text.length
}

export async function preGenerateQuestions(
  docId: number,
  filePath: string,
  fileType: string,
): Promise<number> {
  const t0 = Date.now()
  logger.info(`[预生成] ── 文档${docId} 开始预生成题目 ──`)
  logger.info(`[预生成]   文件: ${filePath} | 类型: ${fileType}`)

  const fullPath = path.resolve(process.cwd(), filePath)
  const fullText = await getDocumentTextForChunking(fullPath, fileType)
  if (!fullText || fullText.trim().length < 200) {
    logger.info(`[预生成]   文本太短 (${fullText?.length || 0}字符)，跳过`)
    return 0
  }

  logger.info(`[预生成]   提取文本: ${fullText.length} 字符`)
  const chunks = splitForExtraction(fullText, 3000)
  const perChunk = 2
  logger.info(`[预生成]   切分为 ${chunks.length} 块 | 每块目标: ${perChunk}题 | 预计总量: ${perChunk * chunks.length}题`)
  let totalGenerated = 0

  const CONSECUTIVE_REJECT_THRESHOLD = 5

  let consecutiveRejects = 0
  let rechunked = false

  for (let i = 0; i < chunks.length; i++) {
    const cStart = Date.now()
    const chunk = chunks[i]
    try {
      const density = computeSemanticDensity(chunk)

      if (density < DENSITY_THRESHOLD) {
        logger.info(`[预生成]   块${i + 1}/${chunks.length}: 跳过 (密度=${(density * 100).toFixed(1)}% < ${(DENSITY_THRESHOLD * 100).toFixed(0)}%, chunk长度=${chunk.length})`)
        continue
      }

      const prompt = GENERATION_PROMPT.replace('{count}', String(perChunk)).replace(
        '{chunk}',
        chunk,
      )
      logger.info(`[预生成]   块${i + 1}/${chunks.length}: 发送LLM请求 (密度=${(density * 100).toFixed(1)}%, chunk长度=${chunk.length}字符)`)
      const response = await retry429(() => generationLlm.invoke(prompt), 'pregen')
      const text = typeof response.content === 'string' ? response.content : ''
      const questions = parseExtractionResponse(text)
      logger.info(`[预生成]   块${i + 1}/${chunks.length}: LLM返回${text.length}字符 → 解析出${questions.length}题 (耗时${Date.now() - cStart}ms)`)

      // 忠实度闸门
      const validQuestions: typeof questions = []
      let blockRejects = 0
      for (const q of questions) {
        const { pass, score, detail } = await judgeFaithfulness(q.q, q.a, chunk)
        if (pass) {
          validQuestions.push(q)
          consecutiveRejects = 0
          logger.info(`[预生成]   块${i + 1} 验证通过: "${q.q.slice(0, 30)}..." faithfulness=${score}`)
        } else {
          blockRejects++
          consecutiveRejects++
          logger.warn(`[预生成]   块${i + 1} 弃题: "${q.q.slice(0, 30)}..." faithfulness=${score} — ${detail} (连续拒收=${consecutiveRejects})`)
        }
      }

      // 连续拒收 ≥5 题 → 回退到生成前，对剩余原文做更细粒度的重切
      if (!rechunked && consecutiveRejects >= CONSECUTIVE_REJECT_THRESHOLD) {
        rechunked = true
        const remainingText = chunks.slice(i + 1).join('\n')
        if (remainingText.trim().length >= 200) {
          const finerChunks = splitForExtraction(remainingText, 1500) // 3000 → 1500
          logger.warn(`[预生成]   连续拒收${consecutiveRejects}题，对剩余${chunks.length - i - 1}块重切: ${chunks.length - i - 1}块 → ${finerChunks.length}块 (粒度 3000→1500)`)
          chunks.splice(i + 1, chunks.length - i - 1, ...finerChunks)
          consecutiveRejects = 0
        } else {
          logger.warn(`[预生成]   连续拒收${consecutiveRejects}题，但剩余文本过短 (${remainingText.length}字符)，跳过重切`)
        }
      }

      if (validQuestions.length > 0) {
        await Question.bulkCreate(
          validQuestions.map((q) => ({
            stem: q.q.trim(),
            explanation: q.a.trim(),
            type: 'essay' as const,
            source_type: 'ai_pregenerated' as const,
            source_document_id: docId,
            knowledge_point: extractKnowledgePoint(q.q),
            difficulty_votes: [] as number[],
          } as any)),
        )
        totalGenerated += validQuestions.length
        logger.info(`[预生成]   块${i + 1}: 闸门过滤 ${blockRejects}/${questions.length} 题, 入库${validQuestions.length}题, 累计${totalGenerated}题`)
      } else {
        logger.warn(`[预生成]   块${i + 1}: 闸门过滤全部${questions.length}题, 无有效题目入库`)
      }
    } catch (err) {
      const e = err as any
      const detail = e?.constructor?.name + ' | ' + (e?.message || '') + ' | ' + (e?.response?.status || '') + ' | ' + JSON.stringify(Object.keys(e||{}))
      logger.error(`[预生成]   块${i + 1} 失败: ${detail}`)
    }
  }

  logger.info(`[预生成] ── 文档${docId} 预生成完成: ${totalGenerated}题 | 总耗时${Date.now() - t0}ms ──`)
  return totalGenerated
}
