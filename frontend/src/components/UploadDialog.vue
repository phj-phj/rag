<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      @click.self="$emit('close')"
    >
      <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold mb-4">
          上传文档
        </h3>

        <!-- Drop Zone -->
        <div
          class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
          :class="{ 'border-blue-500 bg-blue-50': dragging }"
          @click="triggerFileInput"
          @dragover.prevent="dragging = true"
          @dragleave="dragging = false"
          @drop.prevent="handleDrop"
        >
          <p class="text-gray-400 mb-2">
            拖拽文件到此区域或点击选择
          </p>
          <p class="text-xs text-gray-300">
            支持 PDF、Word、PPT、Excel、TXT、图片（单文件最大 10MB，最多 10 个文件）
          </p>
        </div>

        <input
          ref="fileInput"
          type="file"
          multiple
          class="hidden"
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.gif"
          @change="handleFileChange"
        >

        <!-- File List -->
        <div
          v-if="files.length > 0"
          class="mt-4 space-y-2"
        >
          <div
            v-for="(f, idx) in files"
            :key="idx"
            class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
          >
            <div class="flex items-center gap-3 text-sm">
              <span class="truncate max-w-48">{{ f.name }}</span>
              <span class="text-gray-400">{{ formatSize(f.size) }}</span>
            </div>
            <button
              class="text-red-400 hover:text-red-600 text-sm"
              @click="removeFile(idx)"
            >
              删除
            </button>
          </div>
        </div>

        <!-- Form -->
        <div class="mt-4 space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">标题</label>
            <input
              v-model="title"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="文档标题（单文件时默认使用文件名）"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">分类</label>
            <select
              v-model="categoryId"
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
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">标签</label>
            <TagSelector
              :tags="allTags"
              :selected-tags="selectedTags"
              @update:selected-tags="selectedTags = $event"
            />
          </div>
        </div>

        <!-- Error -->
        <p
          v-if="error"
          class="mt-3 text-sm text-red-600"
        >
          {{ error }}
        </p>

        <!-- Actions -->
        <div class="flex justify-end gap-2 mt-4">
          <button
            class="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200"
            @click="$emit('close')"
          >
            取消
          </button>
          <button
            :disabled="files.length === 0 || uploading"
            class="px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50"
            style="background-color: #2c3e50;"
            @click="handleUpload"
          >
            {{ uploading ? '上传中...' : `上传 (${files.length} 个文件)` }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getCategories, getTags } from '../api/admin'
import TagSelector from './TagSelector.vue'

defineProps<{ visible: boolean }>()
defineEmits<{ close: [] }>()

const fileInput = ref<HTMLInputElement | null>(null)
const files = ref<File[]>([])
const title = ref('')
const categoryId = ref<number | null>(null)
const selectedTags = ref<number[]>([])
interface OptionItem { id: number; name: string }
const categories = ref<OptionItem[]>([])
const allTags = ref<OptionItem[]>([])
const dragging = ref(false)
const uploading = ref(false)
const error = ref('')

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  addFiles((event.target as HTMLInputElement).files)
}

function handleDrop(event: DragEvent) {
  dragging.value = false
  addFiles(event.dataTransfer?.files || null)
}

function addFiles(fileList: FileList | null) {
  if (!fileList) return
  error.value = ''

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    if (files.value.length >= 10) {
      error.value = '最多上传 10 个文件'
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      error.value = `文件 ${file.name} 超过 10MB 限制`
      return
    }
    files.value.push(file)
  }
}

function removeFile(idx: number) {
  files.value.splice(idx, 1)
}

async function handleUpload() {
  if (files.value.length === 0) return
  uploading.value = true
  error.value = ''

  const formData = new FormData()
  files.value.forEach((f) => formData.append('files', f))
  if (title.value) formData.append('title', title.value)
  if (categoryId.value) formData.append('category_id', String(categoryId.value))
  if (selectedTags.value.length > 0) {
    formData.append('tags', JSON.stringify(selectedTags.value))
  }

  try {
    const { create } = await import('../api/document')
    await create(formData)
    files.value = []
    title.value = ''
    categoryId.value = null
    selectedTags.value = []
    // Refresh parent
    window.location.reload()
  } catch (err: unknown) {
    error.value = (err as { response?: { data?: { message?: string } } }).response?.data?.message || '上传失败'
  } finally {
    uploading.value = false
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

onMounted(async () => {
  try {
    const [catRes, tagRes] = await Promise.all([getCategories(), getTags()])
    categories.value = catRes.data
    allTags.value = tagRes.data
  } catch { /* ignore */ }
})
</script>
