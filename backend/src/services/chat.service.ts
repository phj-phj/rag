const BASE_URL = process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1'
const API_KEY = process.env.MIMO_API_KEY || ''
const MODEL = process.env.MIMO_MODEL || 'mimo-v2.5-pro'

interface ChatResult {
  answer: string
  model: string
}

interface ChunkInput {
  title: string
  content: string
  score: number
}

function buildPrompt(question: string, chunks: ChunkInput[]): { system: string; user: string } {
  const chunksText = chunks.map((c, i) =>
    `[参考资料${i + 1}：《${c.title}》]\n${c.content}`
  ).join('\n\n---\n\n')

  return {
    system: `你是 Papier 文档助手。根据以下参考资料回答用户问题。

要求：
1. 直接回答问题，不要提及"参考资料"、"片段X"、"文档X"等来源信息
2. 回答简洁，控制在 3-5 句话以内
3. 如果所有资料都不包含答案，请说"当前文档库中未找到相关信息"

参考资料：
${chunksText}`,
    user: question,
  }
}

// ── 非流式（保留兼容） ──

export async function askDocument(
  question: string,
  chunks: ChunkInput[],
): Promise<ChatResult> {
  const { system, user } = buildPrompt(question, chunks)

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Mimo API 错误 (${res.status}): ${err}`)
  }

  const data = (await res.json()) as {
    choices: { message: { content: string } }[]
    model: string
  }

  return {
    answer: data.choices[0]?.message?.content || '（未获取到回答）',
    model: data.model || MODEL,
  }
}

// ── 流式（SSE） ──

export async function* askDocumentStream(
  question: string,
  chunks: ChunkInput[],
): AsyncGenerator<string, string, unknown> {
  const { system, user } = buildPrompt(question, chunks)

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      max_tokens: 500,
      stream: true,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Mimo API 错误 (${res.status}): ${err}`)
  }

  let model = MODEL
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const json = line.slice(6).trim()
      if (json === '[DONE]') continue
      try {
        const data = JSON.parse(json)
        if (data.model) model = data.model
        const content = data.choices?.[0]?.delta?.content
        if (content) yield content
      } catch { /* skip malformed JSON */ }
    }
  }

  return model
}
