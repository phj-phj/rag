import client from './client'

export function getStats() {
  return client.get('/admin/stats')
}

export function getDocuments(params?: Record<string, unknown>) {
  return client.get('/admin/documents', { params })
}

export function updateDocument(id: number, data: Record<string, unknown>) {
  return client.put(`/admin/documents/${id}`, data)
}

export function replaceFile(id: number, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return client.post(`/admin/documents/${id}/replace`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function deleteDocument(id: number) {
  return client.delete(`/admin/documents/${id}`)
}

export function getUsers(params?: Record<string, unknown>) {
  return client.get('/admin/users', { params })
}

export function updatePassword(userId: number, password: string) {
  return client.put(`/admin/users/${userId}/password`, { password })
}

export function getCategories() {
  return client.get('/categories')
}

export function getTags() {
  return client.get('/tags')
}

// 题库管理
export interface QuestionItem {
  id: number
  stem: string
  explanation: string
  type: string
  source_type: 'extracted' | 'ai_pregenerated'
  source_document_id: number | null
  knowledge_point: string | null
  difficulty: number | null
  created_at: string
}

export function getQuestions(params?: Record<string, unknown>) {
  return client.get('/admin/questions', { params })
}

export function deleteQuestion(id: number) {
  return client.delete(`/admin/questions/${id}`)
}

export function batchDeleteQuestions(ids: number[]) {
  return client.post('/admin/questions/batch-delete', { ids })
}
