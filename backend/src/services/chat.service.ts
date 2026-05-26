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

export async function askDocument(
  question: string,
  chunks: ChunkInput[],
): Promise<ChatResult> {
  const chunksText = chunks.map((c, i) =>
    `[片段${i + 1}，来源：《${c.title}》，相关度：${c.score.toFixed(3)}]\n${c.content}`
  ).join('\n\n---\n\n')

  const systemPrompt = `你是 Papier 文档助手。根据以下文档片段回答用户问题。

要求：
1. 回答简洁，控制在 3-5 句话以内
2. 如果答案来自某个片段，请指出来源于哪个文档
3. 如果所有片段都不包含答案，请说"当前文档库中未找到相关信息"

参考片段：
${chunksText}`

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
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
