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
              class="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg"
            >
              文档管理
            </router-link>
            <router-link
              to="/admin/users"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
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
          文档管理
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          管理平台所有文档，支持搜索、编辑与替换
        </p>
      </div>

      <!-- Search Card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div class="flex gap-3 flex-wrap items-end">
          <div class="flex-1 min-w-[200px]">
            <label class="block text-xs font-medium text-gray-500 mb-1.5">
              <span class="inline-block w-4 h-4 mr-1 align-text-bottom">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                ><circle
                  cx="11"
                  cy="11"
                  r="8"
                /><path d="m21 21-4.35-4.35" /></svg>
              </span>
              标题搜索
            </label>
            <input
              v-model="searchTitle"
              placeholder="输入文档标题关键词..."
              class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
              @input="debouncedSearch"
            >
          </div>
          <div class="w-44">
            <label class="block text-xs font-medium text-gray-500 mb-1.5">分类筛选</label>
            <select
              v-model="searchCategoryId"
              class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
              @change="doSearch"
            >
              <option :value="null">
                全部分类
              </option>
              <option
                v-for="cat in categories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
          <button
            class="px-5 py-2.5 text-sm font-medium rounded-lg text-white bg-[#2c3e50] hover:bg-[#1a2b3a] transition-colors flex items-center gap-1.5"
            @click="doSearch"
          >
            <svg
              class="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            ><circle
              cx="11"
              cy="11"
              r="8"
            /><path d="m21 21-4.35-4.35" /></svg>
            搜索
          </button>
        </div>
      </div>

      <!-- Table Card -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100">
                <th class="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-14">
                  ID
                </th>
                <th class="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  标题
                </th>
                <th class="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-20">
                  类型
                </th>
                <th class="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">
                  大小
                </th>
                <th class="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">
                  上传者
                </th>
                <th class="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">
                  分类
                </th>
                <th class="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  标签
                </th>
                <th class="text-right px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-48">
                  操作
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-if="loading">
                <td
                  colspan="8"
                  class="px-5 py-20 text-center"
                >
                  <div class="flex flex-col items-center gap-3">
                    <div class="w-8 h-8 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                    <span class="text-sm text-gray-400">加载中...</span>
                  </div>
                </td>
              </tr>
              <tr v-else-if="documents.length === 0">
                <td
                  colspan="8"
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
                      ><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line
                        x1="16"
                        y1="13"
                        x2="8"
                        y2="13"
                      /><line
                        x1="16"
                        y1="17"
                        x2="8"
                        y2="17"
                      /></svg>
                    </div>
                    <p class="text-sm text-gray-400 font-medium">
                      暂无文档
                    </p>
                    <p class="text-xs text-gray-300">
                      上传文档后将在此显示
                    </p>
                  </div>
                </td>
              </tr>
              <tr
                v-for="doc in documents"
                :key="doc.id"
                class="hover:bg-amber-50/30 transition-colors group"
              >
                <td class="px-5 py-3.5 text-xs text-gray-400 font-mono">
                  {{ doc.id }}
                </td>
                <td class="px-5 py-3.5">
                  <span class="font-medium text-gray-900 truncate max-w-[240px] block group-hover:text-amber-800 transition-colors">{{ doc.title }}</span>
                </td>
                <td class="px-5 py-3.5">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium"
                    :class="typeClass(doc.file_type)"
                  >
                    {{ (doc.file_type || '').toUpperCase() }}
                  </span>
                </td>
                <td class="px-5 py-3.5 text-xs text-gray-500">
                  {{ formatSize(doc.file_size) }}
                </td>
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-2">
                    <div
                      class="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0"
                      :style="{ background: userGradient(doc.uploader?.username || '') }"
                    >
                      {{ (doc.uploader?.username || '?')[0].toUpperCase() }}
                    </div>
                    <span class="text-xs text-gray-600">{{ doc.uploader?.username || '-' }}</span>
                  </div>
                </td>
                <td class="px-5 py-3.5 text-xs text-gray-500">
                  {{ doc.category?.name || '-' }}
                </td>
                <td class="px-5 py-3.5">
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="tag in doc.tags"
                      :key="tag.id"
                      class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100"
                    >
                      {{ tag.name }}
                    </span>
                  </div>
                </td>
                <td class="px-5 py-3.5 text-right">
                  <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      class="px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                      @click="openEdit(doc)"
                    >
                      编辑
                    </button>
                    <label class="px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-md transition-colors cursor-pointer">
                      替换
                      <input
                        type="file"
                        class="hidden"
                        @change="(e) => handleReplace(doc.id, e)"
                      >
                    </label>
                    <button
                      class="px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      @click="handleDelete(doc.id)"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div
          v-if="total > 0"
          class="px-5 py-3.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50"
        >
          <span class="text-xs text-gray-500">共 <span class="font-semibold text-gray-700">{{ total }}</span> 篇文档</span>
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

    <!-- Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="editDoc"
          class="fixed inset-0 z-50 flex items-center justify-center"
          @click.self="editDoc = null"
        >
          <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div class="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-lg font-semibold text-gray-900">
                编辑文档
              </h3>
              <button
                class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                @click="editDoc = null"
              >
                <svg
                  class="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                ><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>
            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">标题</label>
                <input
                  v-model="editTitle"
                  class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">分类</label>
                <select
                  v-model="editCategoryId"
                  class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
                >
                  <option :value="null">
                    未分类
                  </option>
                  <option
                    v-for="cat in categories"
                    :key="cat.id"
                    :value="cat.id"
                  >
                    {{ cat.name }}
                  </option>
                </select>
              </div>
            </div>
            <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button
                class="px-5 py-2.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                @click="editDoc = null"
              >
                取消
              </button>
              <button
                class="px-5 py-2.5 text-sm font-medium rounded-lg bg-[#2c3e50] text-white hover:bg-[#1a2b3a] transition-colors"
                @click="saveEdit"
              >
                保存更改
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
import { useAuthStore } from '../../stores/auth'
import * as adminApi from '../../api/admin'
import { getCategories } from '../../api/admin'

interface DocItem {
  id: number; title: string; file_type: string; file_size: number
  category_id: number; category?: { name: string }
  tags?: { id: number; name: string }[]
  uploader?: { username: string }
}
interface OptionItem { id: number; name: string }

const router = useRouter()
const authStore = useAuthStore()
const showLogout = ref(false)

const documents = ref<DocItem[]>([])
const categories = ref<OptionItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)

const searchTitle = ref('')
const searchCategoryId = ref<number | null>(null)

const editDoc = ref<DocItem | null>(null)
const editTitle = ref('')
const editCategoryId = ref<number | null>(null)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

let searchTimer: ReturnType<typeof setTimeout>

const TYPE_CLASSES: Record<string, string> = {
  pdf: 'bg-red-50 text-red-700 border border-red-100',
  doc: 'bg-green-50 text-green-700 border border-green-100',
  docx: 'bg-green-50 text-green-700 border border-green-100',
  ppt: 'bg-amber-50 text-amber-700 border border-amber-100',
  pptx: 'bg-amber-50 text-amber-700 border border-amber-100',
  xls: 'bg-gray-100 text-gray-700 border border-gray-200',
  xlsx: 'bg-gray-100 text-gray-700 border border-gray-200',
  txt: 'bg-blue-50 text-blue-700 border border-blue-100',
  png: 'bg-purple-50 text-purple-700 border border-purple-100',
  jpg: 'bg-purple-50 text-purple-700 border border-purple-100',
  jpeg: 'bg-purple-50 text-purple-700 border border-purple-100',
  gif: 'bg-purple-50 text-purple-700 border border-purple-100',
}

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

function typeClass(ft: string): string {
  return TYPE_CLASSES[(ft || '').toLowerCase()] || 'bg-gray-100 text-gray-700 border border-gray-200'
}

function userGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return USER_GRADIENTS[Math.abs(hash) % USER_GRADIENTS.length]
}

function debouncedSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(doSearch, 300)
}

async function doSearch() {
  page.value = 1
  await loadDocuments()
}

async function loadDocuments() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value }
    if (searchTitle.value) params.title = searchTitle.value
    if (searchCategoryId.value) params.category_id = searchCategoryId.value
    const { data } = await adminApi.getDocuments(params)
    documents.value = data.items
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function changePage(p: number) {
  page.value = p
  loadDocuments()
}

function openEdit(doc: DocItem) {
  editDoc.value = doc
  editTitle.value = doc.title
  editCategoryId.value = doc.category_id
}

async function saveEdit() {
  if (!editDoc.value) return
  await adminApi.updateDocument(editDoc.value.id, { title: editTitle.value, category_id: editCategoryId.value })
  editDoc.value = null
  await loadDocuments()
}

async function handleReplace(id: number, event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) { alert('文件大小不能超过 10MB'); return }
  await adminApi.replaceFile(id, file)
  target.value = ''
  await loadDocuments()
}

async function handleDelete(id: number) {
  if (!confirm('确定要删除此文档吗？此操作不可撤销。')) return
  await adminApi.deleteDocument(id)
  await loadDocuments()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
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

onMounted(async () => {
  document.addEventListener('click', onClickOutside)
  const { data } = await getCategories()
  categories.value = data
  await loadDocuments()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
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

.avatar-wrapper {
  position: relative;
  z-index: 100;
  margin-left: 4px;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, #c4873b, #7a3b3b);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.avatar:hover { transform: scale(1.08); }

.avatar-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 180px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.12);
  overflow: hidden;
  z-index: 200;
}

.dropdown-user {
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dropdown-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #111827;
}

.dropdown-role {
  font-size: 0.75rem;
  color: #9ca3af;
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 0.85rem;
  color: #6b7280;
  background: none;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}

.dropdown-item:hover {
  background: #fef2f2;
  color: #dc2626;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
