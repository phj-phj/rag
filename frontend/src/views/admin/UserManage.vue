<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center gap-3">
            <h1 class="text-xl font-bold text-gray-900">
              Pap<span class="text-amber-600">ier</span>
            </h1>
            <span class="text-sm text-gray-400">|</span>
            <span class="text-sm text-gray-600">后台管理</span>
          </div>
          <nav class="flex items-center gap-1">
            <router-link
              to="/"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              文档库
            </router-link>
            <router-link
              to="/admin"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              数据概览
            </router-link>
            <router-link
              to="/admin/docs"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              文档管理
            </router-link>
            <router-link
              to="/admin/users"
              class="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg"
            >
              用户管理
            </router-link>
            <router-link
              to="/"
              class="ml-4 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
            >
              返回前台
            </router-link>
            <div
              v-if="authStore.user"
              class="avatar-wrapper"
            >
              <div
                class="avatar"
                @click="showLogout = !showLogout"
              >
                {{ authStore.user.username[0].toUpperCase() }}
              </div>
              <Transition name="fade">
                <div
                  v-if="showLogout"
                  class="avatar-dropdown"
                >
                  <div class="dropdown-user">
                    <span class="dropdown-name">{{ authStore.user.username }}</span>
                    <span class="dropdown-role">{{ authStore.isAdmin ? '管理员' : '用户' }}</span>
                  </div>
                  <button
                    class="dropdown-item"
                    @click="handleLogout"
                  >
                    <svg
                      class="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    ><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line
                      x1="21"
                      y1="12"
                      x2="9"
                      y2="12"
                    /></svg>
                    退出登录
                  </button>
                </div>
              </Transition>
            </div>
          </nav>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-900">
          用户管理
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          管理平台注册用户，支持密码重置
        </p>
      </div>

      <!-- Stats Mini Cards -->
      <div class="grid grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <svg
              class="w-5 h-5 text-amber-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle
              cx="9"
              cy="7"
              r="4"
            /></svg>
          </div>
          <div>
            <div class="text-2xl font-bold text-gray-900">
              {{ total }}
            </div>
            <div class="text-xs text-gray-400">
              平台用户
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <svg
              class="w-5 h-5 text-purple-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
          </div>
          <div>
            <div class="text-2xl font-bold text-gray-900">
              {{ adminCount }}
            </div>
            <div class="text-xs text-gray-400">
              管理员
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-center gap-4">
          <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <svg
              class="w-5 h-5 text-blue-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle
              cx="9"
              cy="7"
              r="4"
            /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          </div>
          <div>
            <div class="text-2xl font-bold text-gray-900">
              {{ userCount }}
            </div>
            <div class="text-xs text-gray-400">
              普通用户
            </div>
          </div>
        </div>
      </div>

      <!-- User Table -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100">
                <th class="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-14">
                  ID
                </th>
                <th class="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  用户名
                </th>
                <th class="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">
                  角色
                </th>
                <th class="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">
                  文档数
                </th>
                <th class="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">
                  注册时间
                </th>
                <th class="text-right px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-32">
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-if="loading">
                <td
                  colspan="6"
                  class="px-5 py-20 text-center"
                >
                  <div class="flex flex-col items-center gap-3">
                    <div class="w-8 h-8 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                    <span class="text-sm text-gray-400">加载中...</span>
                  </div>
                </td>
              </tr>
              <tr v-else-if="users.length === 0">
                <td
                  colspan="6"
                  class="px-5 py-20 text-center"
                >
                  <div class="flex flex-col items-center gap-3">
                    <div class="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                      <svg
                        class="w-8 h-8 text-gray-300"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                      ><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle
                        cx="9"
                        cy="7"
                        r="4"
                      /></svg>
                    </div>
                    <p class="text-sm text-gray-400 font-medium">
                      暂无用户
                    </p>
                  </div>
                </td>
              </tr>
              <tr
                v-for="u in users"
                :key="u.id"
                class="hover:bg-amber-50/30 transition-colors"
              >
                <td class="px-5 py-3.5 text-xs text-gray-400 font-mono">
                  {{ u.id }}
                </td>
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      :style="{ background: userGradient(u.username) }"
                    >
                      {{ u.username[0].toUpperCase() }}
                    </div>
                    <span class="font-medium text-gray-900">{{ u.username }}</span>
                  </div>
                </td>
                <td class="px-5 py-3.5">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                    :class="u.role === 'admin'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'"
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full mr-1.5"
                      :class="u.role === 'admin' ? 'bg-amber-500' : 'bg-blue-500'"
                    />
                    {{ u.role === 'admin' ? '管理员' : '普通用户' }}
                  </span>
                </td>
                <td class="px-5 py-3.5">
                  <span class="font-semibold text-gray-700">{{ u.document_count }}</span>
                  <span class="text-xs text-gray-400 ml-0.5">篇</span>
                </td>
                <td class="px-5 py-3.5 text-xs text-gray-500">
                  {{ formatDate(u.created_at) }}
                </td>
                <td class="px-5 py-3.5 text-right">
                  <button
                    class="px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                    @click="openPasswordModal(u)"
                  >
                    修改密码
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-if="total > 0"
          class="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50"
        >
          <span class="text-xs text-gray-500">共 <span class="font-semibold text-gray-700">{{ total }}</span> 个用户</span>
          <div class="flex items-center gap-1">
            <button
              :disabled="page <= 1"
              class="px-2.5 py-1.5 text-xs rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              @click="changePage(page - 1)"
            >
              ‹
            </button>
            <button
              v-for="p in totalPages"
              :key="p"
              class="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
              :class="page === p ? 'bg-[#2c3e50] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'"
              @click="changePage(p)"
            >
              {{ p }}
            </button>
            <button
              :disabled="page >= totalPages"
              class="px-2.5 py-1.5 text-xs rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              @click="changePage(page + 1)"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Password Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="passwordUser"
          class="fixed inset-0 z-50 flex items-center justify-center"
          @click.self="passwordUser = null"
        >
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div class="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div class="flex items-center gap-3 mb-5">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                :style="{ background: userGradient(passwordUser.username) }"
              >
                {{ passwordUser.username[0].toUpperCase() }}
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900">
                  修改密码
                </h3>
                <p class="text-xs text-gray-400">
                  {{ passwordUser.username }}
                </p>
              </div>
            </div>
            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">新密码</label>
                <input
                  v-model="newPassword"
                  type="password"
                  minlength="6"
                  class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
                  placeholder="至少输入 6 位密码"
                >
              </div>
              <p
                v-if="message"
                class="text-sm flex items-center gap-1.5"
                :class="msgError ? 'text-red-600' : 'text-green-600'"
              >
                <svg
                  v-if="!msgError"
                  class="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                ><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                {{ message }}
              </p>
            </div>
            <div class="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
              <button
                class="px-5 py-2.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                @click="passwordUser = null"
              >
                取消
              </button>
              <button
                :disabled="updating"
                class="px-5 py-2.5 text-sm font-medium rounded-lg bg-[#2c3e50] text-white hover:bg-[#1a2b3a] transition-colors disabled:opacity-50"
                @click="doUpdatePassword"
              >
                {{ updating ? '保存中...' : '确认修改' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../../stores/admin'
import { useAuthStore } from '../../stores/auth'

interface UserItem { id: number; username: string; role: string; document_count: number; created_at: string }

const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()
const showLogout = ref(false)

const users = computed(() => adminStore.users)
const total = computed(() => adminStore.totalUsers)
const loading = computed(() => adminStore.loading)

const adminCount = computed(() => users.value.filter(u => u.role === 'admin').length)
const userCount = computed(() => users.value.filter(u => u.role !== 'admin').length)

const page = ref(1)
const pageSize = ref(20)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const passwordUser = ref<UserItem | null>(null)
const newPassword = ref('')
const message = ref('')
const msgError = ref(false)
const updating = ref(false)

const USER_GRADIENTS = [
  'linear-gradient(135deg, #7a3b3b, #a06a28)',
  'linear-gradient(135deg, #6b7c5e, #4a6741)',
  'linear-gradient(135deg, #c4873b, #8b5e34)',
  'linear-gradient(135deg, #2c2418, #5a4d3a)',
  'linear-gradient(135deg, #6b8db5, #4a6b8a)',
  'linear-gradient(135deg, #8b6b4a, #5a7a5a)',
  'linear-gradient(135deg, #3b6b5a, #2a4a3a)',
  'linear-gradient(135deg, #7a5a8b, #4a3a6b)',
]

function userGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return USER_GRADIENTS[Math.abs(hash) % USER_GRADIENTS.length]
}

function changePage(p: number) {
  page.value = p
  loadUsers()
}

async function loadUsers() {
  await adminStore.fetchUsers({ page: page.value, pageSize: pageSize.value })
}

function openPasswordModal(user: UserItem) {
  passwordUser.value = user
  newPassword.value = ''
  message.value = ''
}

async function doUpdatePassword() {
  if (!newPassword.value || newPassword.value.length < 6) {
    message.value = '密码长度不能少于 6 位'
    msgError.value = true
    return
  }
  updating.value = true
  try {
    await adminStore.updateUserPassword(passwordUser.value!.id, newPassword.value)
    message.value = '密码修改成功'
    msgError.value = false
    setTimeout(() => { passwordUser.value = null }, 800)
  } catch (err: unknown) {
    message.value = (err as { response?: { data?: { message?: string } } }).response?.data?.message || '修改失败'
    msgError.value = true
  } finally {
    updating.value = false
  }
}

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN')
}

function handleLogout() {
  showLogout.value = false
  authStore.logout()
  router.push('/login')
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.avatar-wrapper')) showLogout.value = false
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  loadUsers()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
.avatar-wrapper { position: relative; z-index: 100; margin-left: 4px; }
.avatar { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #c4873b, #7a3b3b); display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: transform 0.2s; }
.avatar:hover { transform: scale(1.08); }
.avatar-dropdown { position: absolute; top: calc(100% + 8px); right: 0; min-width: 180px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.12); overflow: hidden; z-index: 200; }
.dropdown-user { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; display: flex; flex-direction: column; gap: 2px; }
.dropdown-name { font-size: 0.9rem; font-weight: 600; color: #111827; }
.dropdown-role { font-size: 0.75rem; color: #9ca3af; }
.dropdown-item { width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 16px; font-size: 0.85rem; color: #6b7280; background: none; border: none; cursor: pointer; transition: all 0.15s; font-family: inherit; }
.dropdown-item:hover { background: #fef2f2; color: #dc2626; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active > div:last-child,
.modal-leave-active > div:last-child {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from > div:last-child {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}
.modal-leave-to > div:last-child {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}
</style>
