import client from './client'

export type { DocumentListParams } from '../types/api'

export function list(params?: import('../types/api').DocumentListParams) {
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

export function getContent(id: number) {
  return client.get(`/documents/${id}/content`)
}

export function deleteDoc(id: number) {
  return client.delete(`/documents/${id}`)
}
