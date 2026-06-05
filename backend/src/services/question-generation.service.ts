import path from 'path'
import { ChatOpenAI } from '@langchain/openai'
import { Question } from '../models'
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
  model: process.env.MIMO_TRAIN_MODEL || 'deepseek-chat',
  temperature: 0.3,
  maxTokens: 4096,
  apiKey: process.env.MIMO_API_KEY || '',
  configuration: {
    baseURL:
      process.env.MIMO_BASE_URL || 'https://api.deepseek.com/v1',
  },
})

const GENERATION_PROMPT = `你是 Papier 出题助手。根据以下参考资料生成论述题。

要求：
1. 生成至少 {count} 道论述题，覆盖参考资料中的核心知识点。数量只多不少
2. 每道题的答案要详细、准确，从参考资料中提取关键信息
3. 以 JSON 数组格式输出: [{"q": "题目", "a": "详细答案/解析"}, ...]
4. 题目要有思考价值
5. 题干必须自包含：禁止出现"根据面经""结合本文""参考资料""根据文档""文中提到"等引用来源的表述
6. 答案中禁止引用来源，直接给出知识点的核心内容

参考资料：
{chunk}`

export async function preGenerateQuestions(
  docId: number,
  filePath: string,
  fileType: string,
): Promise<number> {
  const t0 = Date.now()
  console.log(`[预生成] ── 文档${docId} 开始预生成题目 ──`)
  console.log(`[预生成]   文件: ${filePath} | 类型: ${fileType}`)

  const fullPath = path.resolve(process.cwd(), filePath)
  const fullText = await getDocumentTextForChunking(fullPath, fileType)
  if (!fullText || fullText.trim().length < 200) {
    console.log(`[预生成]   文本太短 (${fullText?.length || 0}字符)，跳过`)
    return 0
  }

  console.log(`[预生成]   提取文本: ${fullText.length} 字符`)
  const chunks = splitForExtraction(fullText, 3000)
  const perChunk = 5
  console.log(`[预生成]   切分为 ${chunks.length} 块 | 每块目标: ${perChunk}题 | 预计总量: ${perChunk * chunks.length}题`)
  let totalGenerated = 0

  for (let i = 0; i < chunks.length; i++) {
    const cStart = Date.now()
    const chunk = chunks[i]
    try {
      const prompt = GENERATION_PROMPT.replace('{count}', String(perChunk)).replace(
        '{chunk}',
        chunk,
      )
      console.log(`[预生成]   块${i + 1}/${chunks.length}: 发送LLM请求 (chunk长度=${chunk.length}字符)`)
      const response = await retry429(() => generationLlm.invoke(prompt), 'pregen')
      const text = typeof response.content === 'string' ? response.content : ''
      const questions = parseExtractionResponse(text)
      console.log(`[预生成]   块${i + 1}/${chunks.length}: LLM返回${text.length}字符 → 解析出${questions.length}题 (耗时${Date.now() - cStart}ms)`)

      if (questions.length > 0) {
        await Question.bulkCreate(
          questions.map((q) => ({
            stem: q.q.trim(),
            explanation: q.a.trim(),
            type: 'essay' as const,
            source_type: 'ai_pregenerated' as const,
            source_document_id: docId,
            knowledge_point: extractKnowledgePoint(q.q),
            difficulty_votes: [] as number[],
          } as any)),
        )
        totalGenerated += questions.length
        console.log(`[预生成]   块${i + 1}: 已写入数据库，累计${totalGenerated}题`)
      } else {
        console.warn(`[预生成]   块${i + 1}: 未解析出有效题目 (LLM原始响应前200字: ${text.slice(0, 200)})`)
      }
    } catch (err) {
      console.error(`[预生成]   块${i + 1} 失败:`, (err as Error).message)
    }
  }

  console.log(`[预生成] ── 文档${docId} 预生成完成: ${totalGenerated}题 | 总耗时${Date.now() - t0}ms ──`)
  return totalGenerated
}
