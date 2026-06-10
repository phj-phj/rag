import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { createModuleLogger } from '../utils/logger'

const logger = createModuleLogger('chat')

// ── 模型配置 ──

async function retryLlm<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn()
    } catch (e: any) {
      if (e?.status === 429 || e?.lc_error_code === 'MODEL_RATE_LIMIT') {
        const wait = (attempt + 1) * 2000
        logger.info(`[${label}] 429 限流，${wait}ms 后重试 (第${attempt + 1}次)`)
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      throw e
    }
  }
  throw new Error(`[${label}] 重试 5 次后仍失败`)
}

// AI 助手：默认 deepseek-v3.2（快），开启思考用 deepseek-reasoner
function getChatLlm(enableThinking: boolean): ChatOpenAI {
  return new ChatOpenAI({
    model: enableThinking ? 'deepseek-reasoner' : (process.env.MIMO_MODEL || 'deepseek-v3.2'),
    temperature: 0.3,
    maxTokens: enableThinking ? 65536 : 4096,
    apiKey: process.env.MIMO_API_KEY || '',
    configuration: {
      baseURL: process.env.MIMO_BASE_URL || 'https://api.deepseek.com/v1',
    },
  })
}

// 训练专用模型（出题、提取、预生成）
const trainingLlm = new ChatOpenAI({
  model: process.env.MIMO_TRAIN_MODEL || 'deepseek-v3.2',
  temperature: 0.3,
  maxTokens: 4096,
  apiKey: process.env.MIMO_API_KEY || '',
  configuration: {
    baseURL: process.env.MIMO_BASE_URL || 'https://api.deepseek.com/v1',
  },
})

logger.info('[chat.service] trainingLlm 初始化: model=' + trainingLlm.model + ' maxTokens=' + trainingLlm.maxTokens)

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
2. 回答详细完整，控制在 3-8 句话以内
3. 如果提供的内容不包含答案，回答"当前文档库中未找到相关信息"

参考资料：
{chunks}`

// ── 构建 messages（含对话历史）──

async function filterHistory(
  question: string,
  history: Array<{ role: string; content: string }>,
): Promise<Array<{ role: string; content: string }>> {
  // 提取历史中的 Q&A 对
  const pairs: Array<{ q: string; a: string; orig: Array<{ role: string; content: string }> }> = []
  for (let i = 0; i < history.length; i += 2) {
    if (history[i]?.role === 'user' && history[i + 1]?.role === 'assistant') {
      pairs.push({
        q: history[i].content,
        a: history[i + 1].content,
        orig: [history[i], history[i + 1]],
      })
    }
  }
  if (pairs.length <= 1) return history

  const numbered = pairs.map((p, i) => `${i + 1}. ${p.q}`).join('\n')
  const filterPrompt = `你的任务是判断哪些历史对话与当前问题相关。

当前问题: ${question}

历史对话:
${numbered}

请思考后回答：哪些序号的历史对话与当前问题相关？
- 如果某些历史对话讨论的主题和当前问题相同或延续，选出它们
- 如果当前问题是关于"对话本身"的（如"我们聊了什么""第一个问题是什么"），全部相关
- 如果都不相关，回答"无"

只输出序号（如"1,3"）或"无"，不要解释。`

  try {
    const llm = getChatLlm(false)
    const res = await retryLlm(
      () => llm.invoke([{ role: 'user', content: filterPrompt }]),
      'history-filter',
    )
    const answer = (typeof res.content === 'string' ? res.content : '').trim()
    logger.info(`[chat] 历史筛选: ${pairs.length}组 → 结果: ${answer}`)

    if (answer === '无') return []
    const indices = (answer.match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= pairs.length)
    const filtered: Array<{ role: string; content: string }> = []
    for (const idx of indices) {
      filtered.push(...pairs[idx - 1].orig)
    }
    logger.info(`[chat]   保留 ${indices.length}/${pairs.length} 组: ${indices.join(',')}`)
    return filtered
  } catch (err) {
    logger.warn('[chat] 历史筛选失败，使用全部历史:', (err as Error).message)
    return history
  }
}

async function buildMessages(
  question: string,
  chunksText: string,
  history?: Array<{ role: string; content: string }>,
): Promise<Array<{ role: string; content: string }>> {
  const systemContent = SYSTEM_PROMPT.replace('{chunks}', chunksText)

  const msgs: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemContent },
  ]

  if (history && history.length > 0) {
    const filtered = await filterHistory(question, history)

    const qCount = filtered.filter(h => h.role === 'user').length
    const aCount = filtered.filter(h => h.role === 'assistant').length
    const histChars = filtered.reduce((s, h) => s + h.content.length, 0)
    const totalPairs = history.length / 2
    logger.info(`[chat] 对话历史: ${qCount}问 + ${aCount}答, 共${histChars}字 (原始${totalPairs}组)`)
    filtered.forEach((h, i) => {
      const tag = h.role === 'user' ? 'Q' : 'A'
      logger.info(`[chat]   ${tag}${i+1}: ${h.content.slice(0, 50)}...`)
    })
    for (const h of filtered) {
      const role = h.role === 'assistant' ? 'ai' : 'user'
      msgs.push({ role, content: h.content })
    }
  } else {
    logger.info('[chat] 对话历史: 无')
  }

  msgs.push({ role: 'user', content: question })
  return msgs
}

// ── 思考优先：LLM 先判断能不能不靠文档回答 ──

// ── AI 智能路由：一次思考判断走哪条路 ──

const ROUTE_PROMPT = `你是路由助手。分析用户问题和对话历史，判断走哪条路。

当前问题: {question}

对话历史:
{history}

判断规则：
1. 如果问题是统计类问题（如"有多少""一共""列表""查询""排名"），且涉及数据库中的文档/用户/标签/分类，回复: SQL
2. 如果问题可以用对话历史+常识直接回答（如元问题"第一个问题是什么""刚才聊了什么"、追问上一轮的具体细节），直接给出答案
3. 其他情况（需要查上传的文档），回复: DOCS

只回复 SQL、DOCS，或直接给出答案。`

export interface RouteResult {
  route: 'sql' | 'docs' | 'direct'
  answer?: string
}

export async function routeWithLLM(
  question: string,
  history?: Array<{ role: string; content: string }>,
): Promise<RouteResult> {
  const historyText = history?.length
    ? history.map(h => `${h.role === 'user' ? '用户' : 'AI'}: ${h.content.slice(0, 200)}`).join('\n')
    : '(无)'

  const prompt = ROUTE_PROMPT
    .replace('{history}', historyText)
    .replace('{question}', question)

  try {
    const llm = getChatLlm(false)
    const res = await retryLlm(() => llm.invoke([{ role: 'user', content: prompt }]), 'route')
    const content = (typeof res.content === 'string' ? res.content : '').trim()

    if (content === 'SQL') {
      logger.info('[chat] 路由: SQL')
      return { route: 'sql' }
    }
    if (content === 'DOCS') {
      logger.info('[chat] 路由: DOCS')
      return { route: 'docs' }
    }
    logger.info(`[chat] 路由: 直接回答 (${content.length}字)`)
    return { route: 'direct', answer: content }
  } catch (err) {
    logger.warn('[chat] 路由调用失败，走默认 DOCS:', (err as Error).message)
    return { route: 'docs' }
  }
}

// ── 非流式 ──

export async function askDocument(
  question: string,
  chunks: ChunkInput[],
  enableThinking = false,
  history?: Array<{ role: string; content: string }>,
): Promise<ChatResult> {
  const chunksText = chunks.map((c, i) =>
    `【${c.title}】\n${c.content}`
  ).join('\n\n---\n\n')

  const messages = await buildMessages(question, chunksText, history)

  const totalChars = messages.reduce((s, m) => s + m.content.length, 0)
  logger.info(`[chat] LLM 输入: ${messages.length}条消息, 共${totalChars}字`)

  const llm = getChatLlm(enableThinking)
  const res = await retryLlm(() => llm.invoke(messages), 'chat')
  const content = typeof res.content === 'string' ? res.content : ''

  logger.info(`[chat] LLM 输出: ${content.length}字, 前80字: ${content.slice(0, 80)}`)

  return {
    answer: content || '（未获取到回答）',
    model: (res.response_metadata as any)?.model_name || llm.model,
  }
}

// ── 流式 ──

export async function* askDocumentStream(
  question: string,
  chunks: ChunkInput[],
  enableThinking = false,
  history?: Array<{ role: string; content: string }>,
): AsyncGenerator<string, string, unknown> {
  const chunksText = chunks.map((c, i) =>
    `【${c.title}】\n${c.content}`
  ).join('\n\n---\n\n')

  const messages = await buildMessages(question, chunksText, history)

  const totalChars = messages.reduce((s, m) => s + m.content.length, 0)
  logger.info(`[chat-stream] LLM 输入: ${messages.length}条消息, 共${totalChars}字`)

  const llm = getChatLlm(enableThinking)
  const stream = await retryLlm(() => llm.stream(messages), 'chat-stream')

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

  const res = await retryLlm(() => trainingLlm.invoke(messages), 'training')
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
  const llmStream = await retryLlm(() => trainingLlm.stream(messages), 'training-stream')

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
    logger.info(`[train] stream: ${totalChunks}chunk ${collected.length}字 TTFB=${ttfbMs}ms 总=${llmMs}ms`)
    logger.info(`[train] 原始输出: ${collected.slice(0, 300).replace(/\n/g, '\\n')}`)
    yield { type: 'llmDone' as const, ttfbMs, llmMs, totalChunks }
  }

  return { diagnostics, stream: streamGenerator() }
}

/**
 * 增量 JSON 解析器 — 追踪花括号深度，逐 token 提取完整对象
 * 专门处理 LLM 流式输出的 JSON 数组: [{"q":"...", "a":"..."}, ...]
 */
export class IncrementalJsonParser {
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
