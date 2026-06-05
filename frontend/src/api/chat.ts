import client from './client'

export function ask(question: string, documentId?: number) {
  return client.post('/chat/ask', { question, documentId })
}

export function askStream(question: string, thinking = false): Promise<ReadableStream<Uint8Array>> {
  const baseURL = (import.meta.env.VITE_API_BASE_URL as string) || '/api'

  return fetch(`${baseURL}/chat/ask/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, thinking }),
  }).then(res => {
    if (!res.ok) throw new Error(`请求失败: ${res.status}`)
    if (!res.body) throw new Error('浏览器不支持流式读取')
    return res.body
  })
}

export function trainStream(question: string): Promise<ReadableStream<Uint8Array>> {
  const baseURL = (import.meta.env.VITE_API_BASE_URL as string) || '/api'

  return fetch(`${baseURL}/chat/train/stream`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  }).then(res => {
    if (!res.ok) throw new Error(`请求失败: ${res.status}`)
    if (!res.body) throw new Error('浏览器不支持流式读取')
    return res.body
  })
}
