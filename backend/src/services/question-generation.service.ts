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
1. 出题前，先确认参考资料中对这个知识点是否有至少 3 句话的连续展开。如果只有一句话提及，跳过这个知识点，不要出题
2. 答案中的所有细节必须能在参考资料中找到原文对应。你"本来就懂"的知识一律不准用
3. 如果参考资料中对某概念只给了名称和一句简介但没有具体解释，不要出关于它的题目
4. 以 JSON 数组格式输出: [{"q": "题目", "a": "答案"}, ...]
5. 题干必须自包含：禁止出现"根据面经""结合本文""参考资料""根据文档""文中提到"等引用来源的表述
6. 答案中禁止引用来源，直接给出知识点的核心内容

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
- 5：全部来自原文，无任何外部知识
- 3：大部分来自原文，少量合理归纳
- 1：大量编造

只输出 JSON：
{"score":N,"detail":"如果<4分解释原因，否则写无"}`

  const apiBase = process.env.MIMO_BASE_URL || 'https://api.deepseek.com/v1'
  const apiKey = process.env.MIMO_API_KEY || ''

  try {
    const res = await axios.post(
      `${apiBase}/chat/completions`,
      {
        model: 'deepseek-v4-flash',
        temperature: 0,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      },
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

  for (let i = 0; i < chunks.length; i++) {
    const cStart = Date.now()
    const chunk = chunks[i]
    try {
      const prompt = GENERATION_PROMPT.replace('{count}', String(perChunk)).replace(
        '{chunk}',
        chunk,
      )
      logger.info(`[预生成]   块${i + 1}/${chunks.length}: 发送LLM请求 (chunk长度=${chunk.length}字符)`)
      const response = await retry429(() => generationLlm.invoke(prompt), 'pregen')
      const text = typeof response.content === 'string' ? response.content : ''
      const questions = parseExtractionResponse(text)
      logger.info(`[预生成]   块${i + 1}/${chunks.length}: LLM返回${text.length}字符 → 解析出${questions.length}题 (耗时${Date.now() - cStart}ms)`)

      // 忠实度闸门
      const validQuestions: typeof questions = []
      for (const q of questions) {
        const { pass, score, detail } = await judgeFaithfulness(q.q, q.a, chunk)
        if (pass) {
          validQuestions.push(q)
          logger.info(`[预生成]   块${i + 1} 验证通过: "${q.q.slice(0, 30)}..." faithfulness=${score}`)
        } else {
          logger.warn(`[预生成]   块${i + 1} 弃题: "${q.q.slice(0, 30)}..." faithfulness=${score} — ${detail}`)
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
        logger.info(`[预生成]   块${i + 1}: 闸门过滤 ${questions.length - validQuestions.length}/${questions.length} 题, 入库${validQuestions.length}题, 累计${totalGenerated}题`)
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
