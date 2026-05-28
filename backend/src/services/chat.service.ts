import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate } from '@langchain/core/prompts'

// ── 模型配置 ──

const llm = new ChatOpenAI({
  model: process.env.MIMO_MODEL || 'mimo-v2.5-pro',
  temperature: 0.3,
  maxTokens: 1024,
  apiKey: process.env.MIMO_API_KEY || '',
  configuration: {
    baseURL: process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
  },
})

const trainingLlm = new ChatOpenAI({
  model: process.env.MIMO_MODEL || 'mimo-v2.5-pro',
  temperature: 0.3,
  maxTokens: 4096,
  modelKwargs: {
    enable_thinking: false,
  },
  apiKey: process.env.MIMO_API_KEY || '',
  configuration: {
    baseURL: process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1',
  },
})

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
1. 直接回答问题，不要提及"参考资料"、"片段X"、"文档X"等来源信息
2. 回答简洁，控制在 3-5 句话以内
3. 如果所有资料都不包含答案，请说"当前文档库中未找到相关信息"

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
    `[参考资料${i + 1}：《${c.title}》]\n${c.content}`
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
    `[参考资料${i + 1}：《${c.title}》]\n${c.content}`
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
): Promise<string> {
  const chunksText = chunks.map((c, i) =>
    `[参考资料${i + 1}：《${c.title}》]\n${c.content}`
  ).join('\n\n---\n\n')

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', TRAINING_SYSTEM_PROMPT],
    ['user', '{question}'],
  ])

  const messages = await prompt.formatMessages({
    chunks: chunksText,
    question,
  })

  const res = await trainingLlm.invoke(messages)
  return typeof res.content === 'string' ? res.content : ''
}

const TRAINING_SYSTEM_PROMPT = `你是 Papier 出题助手。根据以下参考资料生成题目。

要求：
1. 生成用户需要的题目数量
2. 每道题目附带答案，答案要详细、从参考资料中提取
3. 必须以 JSON 数组格式输出，不要输出其他内容
4. JSON 格式：[{{"q": "题目", "a": "答案"}}, ...]

参考资料：
{chunks}`
