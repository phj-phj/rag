import path from 'path'
import { ChatOpenAI } from '@langchain/openai'
import { Question } from '../models'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('question-extraction')

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
import { getDocumentTextForChunking } from './extraction.service'
import {
  splitForExtraction,
  parseExtractionResponse,
  extractKnowledgePoint,
  stripQuestionNumber,
} from './question-utils'


const extractionLlm = new ChatOpenAI({
  model: process.env.MIMO_TRAIN_MODEL || 'deepseek-v3.2',
  temperature: 0.1,
  maxTokens: 4096,
  apiKey: process.env.MIMO_API_KEY || '',
  configuration: {
    baseURL:
      process.env.MIMO_BASE_URL || 'https://api.deepseek.com/v1',
  },
})

const EXTRACTION_PROMPT = `你是题目提取助手。从文档中提取所有真实的题目（含题干和答案）。

规则：
1. 总原则：每道题提取后，自问一句——"这道题单独拿出来，一个没看过原文的人能看懂吗？"
   看不懂的，直接丢弃。宁可少提取，不提取不合格的题。
2. 合格题目的具体标准：
   - 所指对象清晰：题干中不能有依赖上下文才能理解的指代词（如"这个""这种""这样""它""你项目""我们公司"等）。一条判断标准：把题干中的指代词替换为具体内容后，题干仍然通顺才算合格
   - 疑问要求明确：必须以问号（？）结尾，提问意图清楚
   - 题干必须完整：不能截断在半句话，不能有未闭合的括号
3. 不合格的例子（不要提取）：
   ❌ "为什么会这样呢" — "这样"不知道指什么
   ❌ "你项目中使用到了IntersectionObserver能讲一下为什么用这个替代监听滚动吗？" — "你项目"和"这个"让题干无法独立理解
4. 合格的例子：
   ✅ "IntersectionObserver API 是什么？为什么可以用它替代传统的滚动监听？"
5. 文档中的小节标题（如"核心作用"、"未来计划"、"概述"）不是题目，忽略
6. 答案从原文对应段落提取，必须详细完整，不少于100字
7. 答案过短或原文找不到完整答案的，不要提取该题
8. 输出 JSON 数组: [{"q": "题目", "a": "答案"}, ...]
9. 没有任何符合要求的题目时，返回 []

示例输出：
[{"q": "IntersectionObserver API 是什么？为什么可以用它替代传统的滚动监听？", "a": "IntersectionObserver 是一种浏览器 API..."}]

文档内容：
{chunk}`

export async function extractQuestionsFromDocument(
  docId: number,
  filePath: string,
  fileType: string,
): Promise<number> {
  const t0 = Date.now()
  logger.info(`[提取] ── 文档${docId} 开始提取题目 ──`)
  logger.info(`[提取]   文件: ${filePath} | 类型: ${fileType}`)

  const fullPath = path.resolve(process.cwd(), filePath)
  const fullText = await getDocumentTextForChunking(fullPath, fileType)
  if (!fullText || fullText.trim().length < 50) {
    logger.info(`[提取]   文本太短 (${fullText?.length || 0}字符)，跳过`)
    return 0
  }

  logger.info(`[提取]   提取文本: ${fullText.length} 字符`)
  const chunks = splitForExtraction(fullText, 2000)
  logger.info(`[提取]   切分为 ${chunks.length} 块`)
  let totalExtracted = 0

  for (let i = 0; i < chunks.length; i++) {
    const cStart = Date.now()
    const chunk = chunks[i]
    try {
      const prompt = EXTRACTION_PROMPT.replace('{chunk}', chunk)
      logger.info(`[提取]   块${i + 1}/${chunks.length}: 发送LLM请求 (chunk长度=${chunk.length}字符)`)
      const response = await retry429(() => extractionLlm.invoke(prompt), 'extract')
      const text = typeof response.content === 'string' ? response.content : ''
      const questions = parseExtractionResponse(text)
      logger.info(`[提取]   块${i + 1}/${chunks.length}: LLM返回${text.length}字符 → 解析出${questions.length}题 (耗时${Date.now() - cStart}ms)`)

      if (questions.length > 0) {
        const valid = questions.filter((q) => q.a.trim().length >= 100)
        if (valid.length < questions.length) {
          logger.info(`[提取]   块${i + 1}: 过滤掉 ${questions.length - valid.length} 道答案过短的题`)
        }
        if (valid.length > 0) {
          await Question.bulkCreate(
            valid.map((q) => ({
              stem: stripQuestionNumber(q.q),
              explanation: q.a.trim(),
              type: 'essay' as const,
              source_type: 'extracted' as const,
              source_document_id: docId,
              knowledge_point: extractKnowledgePoint(q.q),
              difficulty_votes: [] as number[],
            } as any)),
          )
          totalExtracted += valid.length
          logger.info(`[提取]   块${i + 1}: 已写入数据库，累计${totalExtracted}题`)
        }
      } else {
        logger.warn(`[提取]   块${i + 1}: 未解析出有效题目 (LLM原始响应前200字: ${text.slice(0, 200)})`)
      }
    } catch (err) {
      logger.error(`[提取]   块${i + 1} 失败:`, (err as Error).message)
    }
  }

  logger.info(`[提取] ── 文档${docId} 提取完成: ${totalExtracted}题 | 总耗时${Date.now() - t0}ms ──`)
  return totalExtracted
}
