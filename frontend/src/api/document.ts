import client from './client'

export type { DocumentListParams } from '../types/api'

export type ProgressCallback = (percent: number) => void

export function list(params?: import('../types/api').DocumentListParams) {
  return client.get('/documents', { params })
}

export function getById(id: number) {
  return client.get(`/documents/${id}`)
}

export function create(formData: FormData, onProgress?: ProgressCallback) {
  return client.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total && onProgress) {
        onProgress(Math.round((e.loaded * 100) / e.total))
      }
    },
  })
}

export function getContent(id: number) {
  return client.get(`/documents/${id}/content`)
}

export function deleteDoc(id: number) {
  return client.delete(`/documents/${id}`)
}
