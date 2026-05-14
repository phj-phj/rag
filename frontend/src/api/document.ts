import client from './client'

export interface DocumentListParams {
  page?: number
  pageSize?: number
  title?: string
  category_id?: number | null
  tags?: string
  is_featured?: string
}

export function list(params?: DocumentListParams) {
  return client.get('/documents', { params })
}

export function getById(id: number) {
  return client.get(`/documents/${id}`)
}

export function create(formData: FormData) {
  return client.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export function deleteDoc(id: number) {
  return client.delete(`/documents/${id}`)
}
