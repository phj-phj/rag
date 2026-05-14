<template>
  <div class="p-6">
    <h2 class="text-2xl font-bold mb-6">
      文档管理
    </h2>

    <!-- Search & Filter -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex gap-3 flex-wrap items-end">
      <div>
        <label class="block text-xs text-gray-500 mb-1">标题搜索</label>
        <input
          v-model="searchTitle"
          placeholder="搜索文档..."
          class="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          @input="debouncedSearch"
        >
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">分类</label>
        <select
          v-model="searchCategoryId"
          class="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
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
        class="px-4 py-2 text-sm rounded-lg text-white"
        style="background-color: #2c3e50;"
        @click="doSearch"
      >
        搜索
      </button>
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-left">
            <tr>
              <th class="px-4 py-3 font-medium">
                ID
              </th>
              <th class="px-4 py-3 font-medium">
                标题
              </th>
              <th class="px-4 py-3 font-medium">
                类型
              </th>
              <th class="px-4 py-3 font-medium">
                大小
              </th>
              <th class="px-4 py-3 font-medium">
                上传者
              </th>
              <th class="px-4 py-3 font-medium">
                分类
              </th>
              <th class="px-4 py-3 font-medium">
                标签
              </th>
              <th class="px-4 py-3 font-medium">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td
                colspan="8"
                class="px-4 py-8 text-center text-gray-400"
              >
                加载中...
              </td>
            </tr>
            <tr v-else-if="documents.length === 0">
              <td
                colspan="8"
                class="px-4 py-8 text-center text-gray-400"
              >
                暂无文档
              </td>
            </tr>
            <tr
              v-for="doc in documents"
              :key="doc.id"
              class="border-t border-gray-50 hover:bg-gray-50"
            >
              <td class="px-4 py-3">
                {{ doc.id }}
              </td>
              <td class="px-4 py-3 font-medium max-w-48 truncate">
                {{ doc.title }}
              </td>
              <td class="px-4 py-3">
                {{ doc.file_type }}
              </td>
              <td class="px-4 py-3">
                {{ formatSize(doc.file_size) }}
              </td>
              <td class="px-4 py-3">
                {{ doc.uploader?.username }}
              </td>
              <td class="px-4 py-3">
                {{ doc.category?.name || '-' }}
              </td>
              <td class="px-4 py-3">
                <span
                  v-for="tag in doc.tags"
                  :key="tag.id"
                  class="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs mr-1"
                >
                  {{ tag.name }}
                </span>
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-2">
                  <button
                    class="text-blue-600 hover:text-blue-800 text-xs"
                    @click="openEdit(doc)"
                  >
                    编辑
                  </button>
                  <label class="text-green-600 hover:text-green-800 text-xs cursor-pointer">
                    替换文件
                    <input
                      type="file"
                      class="hidden"
                      @change="(e) => handleReplace(doc.id, e)"
                    >
                  </label>
                  <button
                    class="text-red-600 hover:text-red-800 text-xs"
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
      <div class="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
        <span class="text-sm text-gray-500">共 {{ total }} 篇</span>
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

    <!-- Edit Modal -->
    <div
      v-if="editDoc"
      class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      @click.self="editDoc = null"
    >
      <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-semibold mb-4">
          编辑文档
        </h3>
        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">标题</label>
            <input
              v-model="editTitle"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">分类</label>
            <select
              v-model="editCategoryId"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none"
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
          <div class="flex justify-end gap-2 pt-3">
            <button
              class="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200"
              @click="editDoc = null"
            >
              取消
            </button>
            <button
              class="px-4 py-2 text-sm rounded-lg text-white"
              style="background-color: #2c3e50;"
              @click="saveEdit"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import * as adminApi from '../../api/admin'
import { getCategories } from '../../api/admin'

interface DocItem { id: number; title: string; file_type: string; file_size: number; category_id: number; category?: { name: string }; tags?: { id: number; name: string }[]; uploader?: { username: string } }
interface OptionItem { id: number; name: string }

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
  await adminApi.updateDocument(editDoc.value.id, {
    title: editTitle.value,
    category_id: editCategoryId.value,
  })
  editDoc.value = null
  await loadDocuments()
}

async function handleReplace(id: number, event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    alert('文件大小不能超过 10MB')
    return
  }
  await adminApi.replaceFile(id, file)
  target.value = ''
  await loadDocuments()
}

async function handleDelete(id: number) {
  if (!confirm('确定要删除此文档吗？')) return
  await adminApi.deleteDocument(id)
  await loadDocuments()
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

onMounted(async () => {
  const { data } = await getCategories()
  categories.value = data
  await loadDocuments()
})
</script>
