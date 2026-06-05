import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi } from '../api/auth'
import type { AuthUser } from '../types/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null)
  const user = ref<AuthUser | null>(null)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function initAuth() {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        user.value = data.user
        token.value = 'cookie' // 标记已登录，实际 token 在 httpOnly cookie
      }
    } catch {
      token.value = null
      user.value = null
    }
  }

  async function login(username: string, password: string) {
    const { data } = await loginApi(username, password)
    token.value = 'cookie'
    user.value = data.user
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch { /* cookie 清除即使 API 失败也无妨 */ }
    token.value = null
    user.value = null
  }

  return { token, user, isAuthenticated, isAdmin, initAuth, login, logout }
})
