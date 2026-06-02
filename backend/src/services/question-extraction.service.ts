import path from 'path'
import { ChatOpenAI } from '@langchain/openai'
import { Question } from '../models'
import { getDocumentTextForChunking } from './extraction.service'
import {
  splitForExtraction,
  parseExtractionResponse,
  extractKnowledgePoint,
  stripQuestionNumber,
} from './question-utils'

const extractionLlm = new ChatOpenAI({
  model: process.env.MIMO_TRAIN_MODEL || 'mimo-v2.5',
  temperature: 0.1,
  maxTokens: 4096,
  apiKey: process.env.MIMO_API_KEY || '',
  configuration: {
    baseURL:
      process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
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
  const fullPath = path.resolve(process.cwd(), filePath)
  const fullText = await getDocumentTextForChunking(fullPath, fileType)
  if (!fullText || fullText.trim().length < 50) return 0

  const chunks = splitForExtraction(fullText, 4000)
  let totalExtracted = 0

  for (const chunk of chunks) {
    try {
      const prompt = EXTRACTION_PROMPT.replace('{chunk}', chunk)
      const response = await extractionLlm.invoke(prompt)
      const text = typeof response.content === 'string' ? response.content : ''
      const questions = parseExtractionResponse(text)

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
      }
    } catch (err) {
      console.error(`[extraction] chunk 处理失败:`, (err as Error).message)
    }
  }

  console.log(`[extraction] 文档 ${docId} 提取完成: ${totalExtracted} 题`)
  return totalExtracted
}
