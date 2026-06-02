import path from 'path'
import { ChatOpenAI } from '@langchain/openai'
import { Question } from '../models'
import { getDocumentTextForChunking } from './extraction.service'
import {
  splitForExtraction,
  parseExtractionResponse,
  extractKnowledgePoint,
} from './question-utils'

const generationLlm = new ChatOpenAI({
  model: process.env.MIMO_TRAIN_MODEL || 'mimo-v2.5',
  temperature: 0.3,
  maxTokens: 4096,
  apiKey: process.env.MIMO_API_KEY || '',
  configuration: {
    baseURL:
      process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
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
  targetCount: number,
  filePath: string,
  fileType: string,
): Promise<number> {
  const fullPath = path.resolve(process.cwd(), filePath)
  const fullText = await getDocumentTextForChunking(fullPath, fileType)
  if (!fullText || fullText.trim().length < 200) return 0

  const chunks = splitForExtraction(fullText, 3000)
  // 每个 chunk 多要 40%，确保最终总量足够
  const perChunk = Math.max(1, Math.ceil((targetCount / chunks.length) * 1.4))
  let totalGenerated = 0

  for (const chunk of chunks) {
    try {
      const prompt = GENERATION_PROMPT.replace('{count}', String(perChunk)).replace(
        '{chunk}',
        chunk,
      )
      const response = await generationLlm.invoke(prompt)
      const text = typeof response.content === 'string' ? response.content : ''
      const questions = parseExtractionResponse(text)

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
      }
    } catch (err) {
      console.error(`[pregeneration] chunk 处理失败:`, (err as Error).message)
    }
  }

  console.log(`[pregeneration] 文档 ${docId} 预生成完成: ${totalGenerated} 题`)
  return totalGenerated
}
