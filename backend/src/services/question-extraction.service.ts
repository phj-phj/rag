import path from 'path'
import { ChatOpenAI } from '@langchain/openai'
import { Question } from '../models'

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
  model: process.env.MIMO_TRAIN_MODEL || 'deepseek-chat',
  temperature: 0.1,
  maxTokens: 4096,
  apiKey: process.env.MIMO_API_KEY || '',
  configuration: {
    baseURL:
      process.env.MIMO_BASE_URL || 'https://api.deepseek.com/v1',
  },
})

const EXTRACTION_PROMPT = `你是一个题目提取助手。从以下文档内容中识别并提取所有论述题。

要求：
1. 只提取明确是"题目"或"问题"的内容，不要自己编造
2. 题干原样提取，只修正明显的排版问题（多余空行、混乱标点），不改变文字内容
3. 答案从原文对应部分提取，不添加原文没有的内容
4. 每道题包含: {"q": "题目/问题", "a": "参考答案/解析"}
5. 以 JSON 数组格式输出: [{"q": "...", "a": "..."}, ...]
6. 如果内容中没有题目或问题，返回空数组 []

文档内容：
{chunk}`

export async function extractQuestionsFromDocument(
  docId: number,
  filePath: string,
  fileType: string,
): Promise<number> {
  const t0 = Date.now()
  console.log(`[提取] ── 文档${docId} 开始提取题目 ──`)
  console.log(`[提取]   文件: ${filePath} | 类型: ${fileType}`)

  const fullPath = path.resolve(process.cwd(), filePath)
  const fullText = await getDocumentTextForChunking(fullPath, fileType)
  if (!fullText || fullText.trim().length < 50) {
    console.log(`[提取]   文本太短 (${fullText?.length || 0}字符)，跳过`)
    return 0
  }

  console.log(`[提取]   提取文本: ${fullText.length} 字符`)
  const chunks = splitForExtraction(fullText, 4000)
  console.log(`[提取]   切分为 ${chunks.length} 块`)
  let totalExtracted = 0

  for (let i = 0; i < chunks.length; i++) {
    const cStart = Date.now()
    const chunk = chunks[i]
    try {
      const prompt = EXTRACTION_PROMPT.replace('{chunk}', chunk)
      console.log(`[提取]   块${i + 1}/${chunks.length}: 发送LLM请求 (chunk长度=${chunk.length}字符)`)
      const response = await retry429(() => extractionLlm.invoke(prompt), 'extract')
      const text = typeof response.content === 'string' ? response.content : ''
      const questions = parseExtractionResponse(text)
      console.log(`[提取]   块${i + 1}/${chunks.length}: LLM返回${text.length}字符 → 解析出${questions.length}题 (耗时${Date.now() - cStart}ms)`)

      if (questions.length > 0) {
        await Question.bulkCreate(
          questions.map((q) => ({
            stem: stripQuestionNumber(q.q),
            explanation: q.a.trim(),
            type: 'essay' as const,
            source_type: 'extracted' as const,
            source_document_id: docId,
            knowledge_point: extractKnowledgePoint(q.q),
            difficulty_votes: [] as number[],
          } as any)),
        )
        totalExtracted += questions.length
        console.log(`[提取]   块${i + 1}: 已写入数据库，累计${totalExtracted}题`)
      } else {
        console.warn(`[提取]   块${i + 1}: 未解析出有效题目 (LLM原始响应前200字: ${text.slice(0, 200)})`)
      }
    } catch (err) {
      console.error(`[提取]   块${i + 1} 失败:`, (err as Error).message)
    }
  }

  console.log(`[提取] ── 文档${docId} 提取完成: ${totalExtracted}题 | 总耗时${Date.now() - t0}ms ──`)
  return totalExtracted
}
