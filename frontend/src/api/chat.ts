import client from './client'

export function ask(question: string, documentId?: number) {
  return client.post('/chat/ask', { question, documentId })
}
