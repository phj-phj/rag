import client from './client'

export function ask(question: string, documentId?: number) {
  return client.post('/chat/ask', { question, documentId })
}

/**
 * 流式提问 — 返回 ReadableStream，前端逐字读取
 */
export function askStream(question: string): Promise<ReadableStream<Uint8Array>> {
  // 用 fetch 直接调（axios 不支持流式读取 body）
  const baseURL = (import.meta.env.VITE_API_BASE_URL as string) || '/api'
  const token = localStorage.getItem('token')

  return fetch(`${baseURL}/chat/ask/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question }),
  }).then(res => {
    if (!res.ok) throw new Error(`请求失败: ${res.status}`)
    if (!res.body) throw new Error('浏览器不支持流式读取')
    return res.body
  })
}

/**
 * 流式训练出题 — 返回 ReadableStream，前端逐题展示
 */
export function trainStream(question: string): Promise<ReadableStream<Uint8Array>> {
  const baseURL = (import.meta.env.VITE_API_BASE_URL as string) || '/api'
  const token = localStorage.getItem('token')

  return fetch(`${baseURL}/chat/train/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question }),
  }).then(res => {
    if (!res.ok) throw new Error(`请求失败: ${res.status}`)
    if (!res.body) throw new Error('浏览器不支持流式读取')
    return res.body
  })
}
