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
