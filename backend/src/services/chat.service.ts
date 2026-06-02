import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate } from '@langchain/core/prompts'

// ── 模型配置 ──

const llm = new ChatOpenAI({
  model: process.env.MIMO_MODEL || 'mimo-v2.5-pro',
  temperature: 0.3,
  maxTokens: 2048,
  apiKey: process.env.MIMO_API_KEY || '',
  configuration: {
    baseURL: process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
  },
})

// 训练专用模型 — mimo-v2.5（非 pro，无推理延迟，TTFB < 3s）
const trainingLlm = new ChatOpenAI({
  model: process.env.MIMO_TRAIN_MODEL || 'mimo-v2.5',
  temperature: 0.3,
  maxTokens: 4096,
  apiKey: process.env.MIMO_API_KEY || '',
  configuration: {
    baseURL: process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
  },
})

console.log('[chat.service] trainingLlm 初始化: model=' + trainingLlm.model + ' maxTokens=' + trainingLlm.maxTokens)

// ── 类型 ──

interface ChatResult {
  answer: string
  model: string
}

interface ChunkInput {
  title: string
  content: string
  score: number
}

// ── Prompt 模板 ──

const SYSTEM_PROMPT = `你是 Papier 文档助手。根据以下参考资料回答用户问题。

要求：
1. 像人一样自然回答，直接给出答案
2. 回答简洁，控制在 3-5 句话以内
3. 如果提供的内容不包含答案，回答"当前文档库中未找到相关信息"

参考资料：
{chunks}`

const promptTemplate = ChatPromptTemplate.fromMessages([
  ['system', SYSTEM_PROMPT],
  ['user', '{question}'],
])

// ── 非流式 ──

export async function askDocument(
  question: string,
  chunks: ChunkInput[],
): Promise<ChatResult> {
  const chunksText = chunks.map((c, i) =>
    `【${c.title}】\n${c.content}`
  ).join('\n\n---\n\n')

  const messages = await promptTemplate.formatMessages({
    chunks: chunksText,
    question,
  })

  const res = await llm.invoke(messages)
  const content = typeof res.content === 'string' ? res.content : ''

  return {
    answer: content || '（未获取到回答）',
    model: (res.response_metadata as any)?.model_name || llm.model,
  }
}

// ── 流式 ──

export async function* askDocumentStream(
  question: string,
  chunks: ChunkInput[],
): AsyncGenerator<string, string, unknown> {
  const chunksText = chunks.map((c, i) =>
    `【${c.title}】\n${c.content}`
  ).join('\n\n---\n\n')

  const messages = await promptTemplate.formatMessages({
    chunks: chunksText,
    question,
  })

  const stream = await llm.stream(messages)

  for await (const chunk of stream) {
    const content = typeof chunk.content === 'string' ? chunk.content : ''
    if (content) yield content
  }

  return llm.model
}

// ── 每日训练：AI 出题 ──

export async function askDocumentForTraining(
  question: string,
  chunks: ChunkInput[],
  systemPrompt: string,
): Promise<string> {
  const chunksText = chunks.map((c, i) =>
    `【${c.title}】\n${c.content}`
  ).join('\n\n---\n\n')

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['user', '{question}'],
  ])

  const messages = await prompt.formatMessages({
    chunks: chunksText,
    question,
  })

  const res = await trainingLlm.invoke(messages)
  return typeof res.content === 'string' ? res.content : ''
}

// ── 每日训练：流式出题 ──

export interface TrainingQuestion {
  q: string
  a: string
}

export interface TrainingDiagnostics {
  chunkCount: number
  chunkPreviews: Array<{ title: string; score: number; preview: string }>
  model: string
  maxTokens: number
}

export type TrainingStreamEvent =
  | { type: 'question'; question: TrainingQuestion }
  | { type: 'llmDone'; ttfbMs: number; llmMs: number; totalChunks: number }

export async function startTrainingStream(
  question: string,
  chunks: ChunkInput[],
  systemPrompt: string,
): Promise<{
  diagnostics: TrainingDiagnostics
  stream: AsyncGenerator<TrainingStreamEvent, void, unknown>
}> {
  const chunksText = chunks.map((c, i) =>
    `【${c.title}】\n${c.content}`
  ).join('\n\n---\n\n')

  const diagnostics: TrainingDiagnostics = {
    chunkCount: chunks.length,
    chunkPreviews: chunks.map(c => ({ title: c.title, score: c.score, preview: c.content.slice(0, 50) })),
    model: trainingLlm.model,
    maxTokens: (trainingLlm as any).maxTokens ?? 4096,
  }

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemPrompt],
    ['user', '{question}'],
  ])

  const messages = await prompt.formatMessages({ chunks: chunksText, question })
  const llmStream = await trainingLlm.stream(messages)

  async function* streamGenerator(): AsyncGenerator<TrainingStreamEvent, void, unknown> {
    const llmStart = Date.now()
    const parser = new IncrementalJsonParser()
    let collected = ''
    let totalChunks = 0
    let firstToken = true
    let ttfbMs = 0

    for await (const chunk of llmStream) {
      totalChunks++
      const content = typeof chunk.content === 'string' ? chunk.content : ''
      if (!content) continue

      if (firstToken) { firstToken = false; ttfbMs = Date.now() - llmStart }
      collected += content
      for (const q of parser.feed(content)) {
        yield { type: 'question', question: q }
      }
    }

    const llmMs = Date.now() - llmStart
    console.log(`[train] stream: ${totalChunks}chunk ${collected.length}字 TTFB=${ttfbMs}ms 总=${llmMs}ms`)
    console.log(`[train] 原始输出: ${collected.slice(0, 300).replace(/\n/g, '\\n')}`)
    yield { type: 'llmDone' as const, ttfbMs, llmMs, totalChunks }
  }

  return { diagnostics, stream: streamGenerator() }
}

/**
 * 增量 JSON 解析器 — 追踪花括号深度，逐 token 提取完整对象
 * 专门处理 LLM 流式输出的 JSON 数组: [{"q":"...", "a":"..."}, ...]
 */
class IncrementalJsonParser {
  private buf = ''
  private depth = 0
  private inString = false
  private escape = false
  private objectStart = -1  // 当前对象开始的 buf 位置

  feed(chunk: string): TrainingQuestion[] {
    const results: TrainingQuestion[] = []

    for (const ch of chunk) {
      const pos = this.buf.length
      this.buf += ch

      if (this.escape) { this.escape = false; continue }
      if (ch === '\\') { this.escape = true; continue }
      if (ch === '"') { this.inString = !this.inString; continue }
      if (this.inString) continue

      if (ch === '{') {
        if (this.depth === 0) this.objectStart = pos
        this.depth++
      } else if (ch === '}') {
        this.depth--
        if (this.depth === 0 && this.objectStart >= 0) {
          try {
            const obj = JSON.parse(this.buf.slice(this.objectStart, pos + 1)) as TrainingQuestion
            if (obj.q && obj.a) results.push(obj)
          } catch { /* JSON parse failed, skip */ }
          this.objectStart = -1
        }
      }
    }

    return results
  }

  getRemaining(): string {
    return this.buf
  }
}
