<template>
  <div class="p-6">
    <h2 class="text-2xl font-bold mb-6">
      用户管理
    </h2>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left">
            <tr>
              <th class="px-4 py-3 font-medium">
                ID
              </th>
              <th class="px-4 py-3 font-medium">
                用户名
              </th>
              <th class="px-4 py-3 font-medium">
                角色
              </th>
              <th class="px-4 py-3 font-medium">
                文档数
              </th>
              <th class="px-4 py-3 font-medium">
                注册时间
              </th>
              <th class="px-4 py-3 font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td
                colspan="6"
                class="px-4 py-8 text-center text-gray-400"
              >
                加载中...
              </td>
            </tr>
            <tr v-else-if="users.length === 0">
              <td
                colspan="6"
                class="px-4 py-8 text-center text-gray-400"
              >
                暂无用户
              </td>
            </tr>
            <tr
              v-for="u in users"
              :key="u.id"
              class="border-t border-gray-50 hover:bg-gray-50"
            >
              <td class="px-4 py-3">
                {{ u.id }}
              </td>
              <td class="px-4 py-3 font-medium">
                {{ u.username }}
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-block px-2 py-0.5 rounded-full text-xs"
                  :class="u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'"
                >
                  {{ u.role === 'admin' ? '管理员' : '普通用户' }}
                </span>
              </td>
              <td class="px-4 py-3">
                {{ u.document_count }}
              </td>
              <td class="px-4 py-3">
                {{ formatDate(u.created_at) }}
              </td>
              <td class="px-4 py-3">
                <button
                  class="text-blue-600 hover:text-blue-800 text-xs"
                  @click="openPasswordModal(u)"
                >
                  修改密码
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <span class="text-sm text-gray-500">共 {{ total }} 个用户</span>
        <div class="flex gap-1">
          <button
            v-for="p in totalPages"
            :key="p"
            class="px-3 py-1 rounded text-sm"
            :class="page === p ? 'text-white' : 'hover:bg-gray-100'"
            :style="page === p ? { backgroundColor: '#2c3e50' } : {}"
            @click="changePage(p)"
          >
            {{ p }}
          </button>
        </div>
      </div>
    </div>

    <!-- Password Modal -->
    <div
      v-if="passwordUser"
      class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      @click.self="passwordUser = null"
    >
      <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
        <h3 class="text-lg font-semibold mb-4">
          修改密码 - {{ passwordUser.username }}
        </h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">新密码</label>
            <input
              v-model="newPassword"
              type="password"
              minlength="6"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="至少6位"
            >
          </div>
          <p
            v-if="message"
            class="text-sm"
            :class="msgError ? 'text-red-600' : 'text-green-600'"
          >
            {{ message }}
          </p>
          <div class="flex justify-end gap-2 pt-2">
            <button
              class="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200"
              @click="passwordUser = null"
            >
              取消
            </button>
            <button
              :disabled="updating"
              class="px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50"
              style="background-color: #2c3e50;"
              @click="doUpdatePassword"
            >
              {{ updating ? '保存中...' : '确认修改' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAdminStore } from '../../stores/admin'

interface UserItem { id: number; username: string; role: string; document_count: number; created_at: string }

const adminStore = useAdminStore()
const { users, totalUsers: total, loading } = adminStore

const page = ref(1)
const pageSize = ref(20)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const passwordUser = ref<UserItem | null>(null)
const newPassword = ref('')
const message = ref('')
const msgError = ref(false)
const updating = ref(false)

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
    message.value = '密码长度不能少于6位'
    msgError.value = true
    return
  }
  updating.value = true
  try {
    await adminStore.updateUserPassword(passwordUser.value.id, newPassword.value)
    message.value = '密码修改成功'
    msgError.value = false
    passwordUser.value = null
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

onMounted(() => {
  loadUsers()
})
</script>
