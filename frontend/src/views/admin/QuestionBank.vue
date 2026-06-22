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
            <router-link to="/" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">文档库</router-link>
            <router-link to="/admin" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">数据概览</router-link>
            <router-link to="/admin/docs" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">文档管理</router-link>
            <router-link to="/admin/questions" class="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg">题库管理</router-link>
            <router-link to="/admin/users" class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">用户管理</router-link>
            <router-link to="/" class="ml-4 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors">返回前台</router-link>
            <div v-if="authStore.user" class="avatar-wrapper">
              <div class="avatar" @click="showLogout = !showLogout">{{ authStore.user.username[0].toUpperCase() }}</div>
              <Transition name="fade">
                <div v-if="showLogout" class="avatar-dropdown">
                  <div class="dropdown-user">
                    <span class="dropdown-name">{{ authStore.user.username }}</span>
                    <span class="dropdown-role">{{ authStore.isAdmin ? '管理员' : '用户' }}</span>
                  </div>
                  <button class="dropdown-item" @click="handleLogout">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
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
      <div class="flex items-center justify-between mb-8">
        <div>
          <h2 class="text-2xl font-bold text-gray-900">题库管理</h2>
          <p class="mt-1 text-sm text-gray-500">管理 AI 提取和预生成的题库，支持搜索与批量删除</p>
        </div>
        <button
          v-if="selectedIds.size > 0"
          class="px-4 py-2.5 text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-2"
          @click="showBatchConfirm = true"
        >
          删除已选 ({{ selectedIds.size }})
        </button>
      </div>

      <!-- Search -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div class="flex gap-3 flex-wrap items-end">
          <div class="flex-1 min-w-[200px]">
            <label class="block text-xs font-medium text-gray-500 mb-1.5">关键词搜索</label>
            <input
              v-model="keyword"
              placeholder="搜索题目或知识点..."
              class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all"
              @input="debouncedSearch"
            >
          </div>
          <div class="w-44">
            <label class="block text-xs font-medium text-gray-500 mb-1.5">来源类型</label>
            <select v-model="sourceType" class="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm outline-none bg-white focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-all" @change="doSearch">
              <option value="all">全部</option>
              <option value="extracted">题库提取</option>
              <option value="ai_pregenerated">AI 预生成</option>
            </select>
          </div>
          <button class="px-5 py-2.5 text-sm font-medium rounded-lg text-white bg-[#2c3e50] hover:bg-[#1a2b3a] transition-colors" @click="doSearch">搜索</button>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4"><div class="text-2xl font-bold text-gray-900">{{ total }}</div><div class="text-xs text-gray-400 mt-1">题库总数</div></div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4"><div class="text-2xl font-bold text-green-600">{{ extractedCount }}</div><div class="text-xs text-gray-400 mt-1">题库提取</div></div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4"><div class="text-2xl font-bold text-blue-600">{{ pregeneratedCount }}</div><div class="text-xs text-gray-400 mt-1">AI 预生成</div></div>
        <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4"><div class="text-2xl font-bold text-amber-600">{{ knowledgePoints }}</div><div class="text-xs text-gray-400 mt-1">知识点数</div></div>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-gray-100">
                <th class="text-left px-4 py-3.5 w-10">
                  <input
                    type="checkbox"
                    class="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    :checked="selectableIds.length > 0 && selectedIds.size === selectableIds.length"
                    :indeterminate="selectedIds.size > 0 && selectedIds.size < selectableIds.length"
                    @change="toggleSelectAll"
                  >
                </th>
                <th class="text-left px-3 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-14">#</th>
                <th class="text-left px-3 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">题干</th>
                <th class="text-left px-3 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">来源</th>
                <th class="text-left px-3 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-28">知识点</th>
                <th class="text-left px-3 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-40">时间</th>
                <th class="text-right px-4 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-if="loading">
                <td colspan="7" class="px-5 py-20 text-center">
                  <div class="flex flex-col items-center gap-3"><div class="w-8 h-8 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" /><span class="text-sm text-gray-400">加载中...</span></div>
                </td>
              </tr>
              <tr v-else-if="questions.length === 0">
                <td colspan="7" class="px-5 py-20 text-center">
                  <div class="flex flex-col items-center gap-3"><p class="text-sm text-gray-400 font-medium">暂无题目</p><p class="text-xs text-gray-300">上传文档后 AI 将自动提取或生成题目</p></div>
                </td>
              </tr>
              <tr v-for="(q, index) in questions" :key="q.id" class="hover:bg-amber-50/30 transition-colors group" :class="{ 'bg-amber-50/50': selectedIds.has(q.id) }">
                <td class="px-4 py-3.5">
                  <input
                    type="checkbox"
                    class="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                    :checked="selectedIds.has(q.id)"
                    @change="toggleSelect(q.id)"
                  >
                </td>
                <td class="px-3 py-3.5 text-xs text-gray-400 font-mono">{{ (page - 1) * pageSize + index + 1 }}</td>
                <td class="px-3 py-3.5">
                  <div class="max-w-lg">
                    <p class="text-gray-900 truncate group-hover:text-amber-800 transition-colors">{{ q.stem }}</p>
                    <p class="text-xs text-gray-400 mt-0.5 truncate">答案: {{ q.explanation.slice(0, 60) }}{{ q.explanation.length > 60 ? '...' : '' }}</p>
                  </div>
                </td>
                <td class="px-3 py-3.5">
                  <span :class="q.source_type === 'extracted' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'" class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium">
                    {{ q.source_type === 'extracted' ? '题库提取' : 'AI预生成' }}
                  </span>
                </td>
                <td class="px-3 py-3.5 text-xs text-gray-500">{{ q.knowledge_point || '-' }}</td>
                <td class="px-3 py-3.5 text-xs text-gray-400">{{ formatDate(q.created_at) }}</td>
                <td class="px-4 py-3.5 text-right">
                  <button class="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors" @click="confirmDelete(q)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Pagination -->
        <div v-if="total > pageSize" class="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-gray-50/50">
          <span class="text-xs text-gray-400" v-if="selectedIds.size === 0">共 {{ total }} 题，第 {{ page }} / {{ totalPages }} 页</span>
          <span class="text-xs text-amber-600" v-else>已选 {{ selectedIds.size }} 题</span>
          <div class="flex gap-1">
            <button :disabled="page <= 1" class="px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors" @click="changePage(page - 1)">上一页</button>
            <button :disabled="page >= totalPages" class="px-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-colors" @click="changePage(page + 1)">下一页</button>
          </div>
        </div>
      </div>
    </main>

    <!-- Single Delete Modal -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50" @click.self="deleteTarget = null">
        <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
          <p class="text-sm text-gray-500 mb-2">确定要删除这道题目吗？此操作不可撤销。</p>
          <p class="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 line-clamp-3">{{ deleteTarget.stem }}</p>
          <div class="flex justify-end gap-2 mt-4">
            <button class="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors" @click="deleteTarget = null">取消</button>
            <button class="px-4 py-2 text-sm rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors" :disabled="deleting" @click="doDelete">{{ deleting ? '删除中...' : '确认删除' }}</button>
          </div>
          <p v-if="deleteError" class="mt-2 text-sm text-red-600">{{ deleteError }}</p>
        </div>
      </div>
    </Teleport>

    <!-- Batch Delete Modal -->
    <Teleport to="body">
      <div v-if="showBatchConfirm" class="fixed inset-0 bg-black/30 flex items-center justify-center z-50" @click.self="showBatchConfirm = false">
        <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">批量删除</h3>
          <p class="text-sm text-gray-500 mb-4">确定要删除已选的 <span class="font-bold text-red-600">{{ selectedIds.size }}</span> 道题目吗？此操作不可撤销。</p>
          <div class="flex justify-end gap-2">
            <button class="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors" @click="showBatchConfirm = false">取消</button>
            <button class="px-4 py-2 text-sm rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors" :disabled="batchDeleting" @click="doBatchDelete">{{ batchDeleting ? '删除中...' : '确认删除' }}</button>
          </div>
          <p v-if="batchDeleteError" class="mt-2 text-sm text-red-600">{{ batchDeleteError }}</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import client from '../../api/client'
import { getQuestions, deleteQuestion, batchDeleteQuestions, type QuestionItem } from '../../api/admin'

const router = useRouter()
const authStore = useAuthStore()
const showLogout = ref(false)

const questions = ref<QuestionItem[]>([])
const loading = ref(false)
const keyword = ref('')
const sourceType = ref('all')
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const extractedCount = ref(0)
const pregeneratedCount = ref(0)
const knowledgePoints = ref(0)

const selectedIds = ref<Set<number>>(new Set())
const deleteTarget = ref<QuestionItem | null>(null)
const deleting = ref(false)
const deleteError = ref('')
const showBatchConfirm = ref(false)
const batchDeleting = ref(false)
const batchDeleteError = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const selectableIds = computed(() => questions.value.map(q => q.id))

let timer: ReturnType<typeof setTimeout> | null = null

function toggleSelect(id: number) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}

function toggleSelectAll() {
  if (selectedIds.value.size === selectableIds.value.length) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(selectableIds.value)
  }
}

function debouncedSearch() {
  if (timer) clearTimeout(timer)
  timer = setTimeout(doSearch, 400)
}

async function fetchStats() {
  try {
    const { data } = await client.get('/training/questions/stats')
    extractedCount.value = data.extracted || 0
    pregeneratedCount.value = data.pregenerated || 0
    knowledgePoints.value = data.knowledgePoints || 0
  } catch { /* ignore */ }
}

async function doSearch() {
  page.value = 1
  selectedIds.value = new Set()
  await fetchQuestions()
}

async function fetchQuestions() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (sourceType.value !== 'all') params.source_type = sourceType.value
    const { data } = await getQuestions(params)
    questions.value = data.items
    total.value = data.total
  } catch { /* ignore */ }
  loading.value = false
}

function changePage(p: number) {
  page.value = p
  selectedIds.value = new Set()
  fetchQuestions()
}

function confirmDelete(q: QuestionItem) {
  deleteError.value = ''
  deleteTarget.value = q
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await deleteQuestion(deleteTarget.value.id)
    selectedIds.value = new Set([...selectedIds.value].filter(id => id !== deleteTarget.value!.id))
    deleteTarget.value = null
    await fetchQuestions()
    await fetchStats()
  } catch (err: any) {
    deleteError.value = err?.response?.data?.message || '删除失败'
  }
  deleting.value = false
}

async function doBatchDelete() {
  batchDeleting.value = true
  batchDeleteError.value = ''
  try {
    await batchDeleteQuestions([...selectedIds.value])
    showBatchConfirm.value = false
    selectedIds.value = new Set()
    await fetchQuestions()
    await fetchStats()
  } catch (err: any) {
    batchDeleteError.value = err?.response?.data?.message || '批量删除失败'
  }
  batchDeleting.value = false
}

function formatDate(d: string) {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
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
  fetchQuestions()
  fetchStats()
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
</style>
