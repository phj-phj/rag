import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../app'
import { initTestDb } from '../helpers/test-setup'

beforeAll(() => initTestDb())

let adminCookies: string[]
let userCookies: string[]
let testDocId: number

describe('Documents 集成测试', () => {
  beforeAll(async () => {
    const adminRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
    adminCookies = adminRes.headers['set-cookie']

    const userRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'user', password: 'admin123' })
    userCookies = userRes.headers['set-cookie']
  })

  describe('GET /api/documents', () => {
    it('空列表 → 返回 items=[]', async () => {
      const res = await request(app).get('/api/documents')
      expect(res.status).toBe(200)
      expect(res.body.items).toEqual([])
      expect(res.body.total).toBe(0)
    })
  })

  describe('POST /api/documents', () => {
    it('未登录 → 401', async () => {
      const res = await request(app)
        .post('/api/documents')
        .attach('files', Buffer.from('hello world'), 'test.txt')

      expect(res.status).toBe(401)
    })

    it('登录后上传文件 → 201', async () => {
      const res = await request(app)
        .post('/api/documents')
        .set('Cookie', adminCookies)
        .field('title', '测试文档')
        .field('category_id', '1')
        .field('tags', JSON.stringify([1]))
        .attach('files', Buffer.from('这是测试文件内容'), 'test.txt')

      expect(res.status).toBe(201)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].title).toBe('测试文档')
      expect(res.body[0].file_url).toBeTruthy()
      testDocId = res.body[0].id
    })
  })

  describe('GET /api/documents/:id', () => {
    it('存在 → 200', async () => {
      const res = await request(app).get(`/api/documents/${testDocId}`)
      expect(res.status).toBe(200)
      expect(res.body.title).toBe('测试文档')
    })

    it('不存在 → 404', async () => {
      const res = await request(app).get('/api/documents/99999')
      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/documents/:id', () => {
    it('非上传者 → 403', async () => {
      const res = await request(app)
        .delete(`/api/documents/${testDocId}`)
        .set('Cookie', userCookies)

      expect(res.status).toBe(403)
    })

    it('管理员可删除 → 200', async () => {
      const res = await request(app)
        .delete(`/api/documents/${testDocId}`)
        .set('Cookie', adminCookies)

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('文档已删除')
    })
  })
})
