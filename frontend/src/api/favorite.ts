import client from './client'

export function list(page = 1, pageSize = 20) {
  return client.get('/favorites', { params: { page, pageSize } })
}

export function toggle(documentId: number) {
  return client.post(`/favorites/toggle/${documentId}`)
}

export function remove(documentId: number) {
  return client.delete(`/favorites/${documentId}`)
}
