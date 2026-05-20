const BASE_URL = process.env.MIMO_BASE_URL || 'https://token-plan-cn.xiaomimimo.com/v1'
const API_KEY = process.env.MIMO_API_KEY || ''
const MODEL = process.env.MIMO_MODEL || 'mimo-v2.5-pro'

interface ChatResult {
  answer: string
  model: string
}

export async function askDocument(question: string, documentContent: string): Promise<ChatResult> {
  const messages = [
    {
      role: 'system',
      content: `你是一个文档助手，请根据以下内容简洁回答用户问题。要求：\n1. 回答尽量简短，控制在 3-5 句话以内\n2. 不要使用表格、代码块等复杂格式，用纯文本表述\n3. 如果找不到答案就说不知道\n\n文档内容：\n${documentContent}`,
    },
    { role: 'user', content: question },
  ]

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
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
