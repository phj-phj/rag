import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import app from '../../app'
import { initTestDb } from '../helpers/test-setup'

beforeAll(() => initTestDb())

describe('Auth 集成测试', () => {
  let cookies: string[]

  describe('POST /api/auth/register', () => {
    it('注册新用户 → 201 + cookie', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'newuser', password: 'test123' })

      expect(res.status).toBe(201)
      expect(res.body.message).toBe('注册成功')
      expect(res.body.user.username).toBe('newuser')
      expect(res.body.user.role).toBe('user')
      expect(res.headers['set-cookie']).toBeDefined()
    })

    it('重复用户名 → 409', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'newuser', password: 'test123' })

      expect(res.status).toBe(409)
      expect(res.body.message).toContain('已被注册')
    })

    it('密码太短 → 校验失败', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'abc', password: '12' })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/auth/login', () => {
    it('正确密码 → 200 + cookie', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'admin123' })

      expect(res.status).toBe(200)
      expect(res.body.user.username).toBe('admin')
      expect(res.body.user.role).toBe('admin')
      expect(res.headers['set-cookie']).toBeDefined()
      cookies = res.headers['set-cookie']
    })

    it('错误密码 → 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongpass' })

      expect(res.status).toBe(401)
    })

    it('不存在用户 → 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'ghost', password: 'whatever' })

      expect(res.status).toBe(401)
    })
  })

  describe('GET /api/auth/me', () => {
    it('带 cookie → 200 + 当前用户', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies)

      expect(res.status).toBe(200)
      expect(res.body.user.username).toBe('admin')
    })

    it('无 cookie → 401', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /api/auth/logout', () => {
    it('清除 cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)

      expect(res.status).toBe(200)
      expect(res.body.message).toBe('已登出')
    })
  })
})
