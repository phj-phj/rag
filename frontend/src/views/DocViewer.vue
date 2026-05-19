<template>
  <div class="viewer-page">
    <!-- Top Bar -->
    <header class="topbar">
      <div class="topbar-inner">
        <router-link
          to="/"
          class="logo"
        >
          Pap<em>ier</em>
        </router-link>
        <div class="topbar-actions">
          <button
            class="btn-ghost"
            @click="$router.back()"
          >
            ← 返回
          </button>
          <a
            v-if="doc?.file_url"
            class="btn-ghost"
            :href="fileDownloadUrl"
            download
          >
            下载
          </a>
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
        </div>
      </div>
    </header>

    <!-- Loading -->
    <div
      v-if="loading"
      class="loading-container"
    >
      <div class="loading-spinner" />
      <p class="loading-text">
        加载文档中...
      </p>
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="error-container"
    >
      <p class="error-text">
        {{ error }}
      </p>
      <button
        class="btn-ghost"
        @click="$router.back()"
      >
        ← 返回
      </button>
    </div>

    <!-- Reader -->
    <main
      v-else-if="doc"
      class="reader-wrapper"
    >
      <article class="reader">
        <header class="article-header">
          <div class="kicker">
            <span class="badge badge--type">{{ doc.file_type?.toUpperCase() }}</span>
            <span class="kicker-sep" />
            <span
              v-if="doc.category?.name"
              class="badge badge--cat"
            >{{ doc.category.name }}</span>
          </div>
          <h1 class="article-title">
            {{ doc.title }}
          </h1>
          <div class="byline">
            <span>{{ doc.uploader?.username || '未知' }}</span>
            <span class="byline-dot" />
            <span>{{ formatDate(doc.created_at) }}</span>
            <span class="byline-dot" />
            <span>{{ formatSize(doc.file_size) }}</span>
          </div>
        </header>

        <!-- Text-based Content (TXT / PDF / Word) -->
        <div
          v-if="fileTypeCategory === 'txt' || fileTypeCategory === 'pdf' || fileTypeCategory === 'word'"
          class="article-body"
        >
          <!-- Embedded images from PDF / DOCX -->
          <div
            v-if="embeddedImages.length > 0"
            class="embedded-images"
          >
            <img
              v-for="(img, idx) in embeddedImages"
              :key="idx"
              :src="img"
              class="embedded-image"
              :alt="`${doc.title} - 内嵌图片 ${idx + 1}`"
            >
          </div>
          <pre class="txt-content">{{ rawContent || '（文件内容为空）' }}</pre>
        </div>

        <!-- Image Content -->
        <div
          v-else-if="fileTypeCategory === 'image'"
          class="article-body image-body"
        >
          <img
            :src="fileDownloadUrl"
            :alt="doc.title"
            class="preview-image"
          >
        </div>

        <!-- Unsupported -->
        <div
          v-else
          class="unsupported-body"
        >
          <div class="unsupported-icon">
            <svg
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2"
            ><rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="3"
            /><line
              x1="8"
              y1="8"
              x2="16"
              y2="8"
            /><line
              x1="8"
              y1="12"
              x2="16"
              y2="12"
            /><line
              x1="8"
              y1="16"
              x2="12"
              y2="16"
            /></svg>
          </div>
          <p class="unsupported-title">
            暂不支持预览此文件类型
          </p>
          <p class="unsupported-sub">
            {{ doc.file_type?.toUpperCase() }} 文件暂无可预览内容
          </p>
          <a
            v-if="doc.file_url"
            class="btn-download"
            :href="fileDownloadUrl"
            download
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            ><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line
              x1="12"
              y1="15"
              x2="12"
              y2="3"
            /></svg>
            下载文件
          </a>
        </div>

        <footer class="reader-footer">
          <span>Papier 文档库</span>
          <span>安全存储 · 团队共享</span>
        </footer>
      </article>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { getById, getContent } from '../api/document'

interface DocData {
  id: number
  title: string
  file_type: string
  file_size: number
  file_url?: string
  created_at: string
  uploader?: { username: string }
  category?: { name: string }
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const doc = ref<DocData | null>(null)
const rawContent = ref('')
const embeddedImages = ref<string[]>([])
const loading = ref(true)
const error = ref('')
const showLogout = ref(false)

const BASE = 'http://localhost:3000'

const fileDownloadUrl = computed(() => {
  if (!doc.value?.file_url) return ''
  return `${BASE}${doc.value.file_url}`
})

const IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif'])

const fileTypeCategory = computed(() => {
  const t = doc.value?.file_type?.toLowerCase() || ''
  if (t === 'txt' || t === 'plain') return 'txt'
  if (t === 'pdf') return 'pdf'
  if (t === 'docx' || t === 'doc') return 'word'
  if (IMAGE_TYPES.has(t)) return 'image'
  return 'unsupported'
})

function formatSize(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).replace(/\//g, '.')
}

async function fetchDoc() {
  loading.value = true
  error.value = ''
  try {
    const id = Number(route.params.id)
    if (!id) throw new Error('无效的文档ID')

    const { data } = await getById(id)
    doc.value = data as DocData

    const type = data.file_type?.toLowerCase() || ''
    const supportedTypes = ['txt', 'plain', 'pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif']

    if (supportedTypes.includes(type)) {
      try {
        const { data: contentData } = await getContent(id)
        rawContent.value = contentData.text || ''
        embeddedImages.value = contentData.images || []
      } catch {
        rawContent.value = ''
        embeddedImages.value = []
      }
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = err?.response?.data?.message || err.message || '加载文档失败'
  } finally {
    loading.value = false
  }
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
  fetchDoc()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
.viewer-page {
  min-height: 100vh;
  background: #faf7f2;
  font-family: 'DM Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #1a1815;
}

/* ── Top Bar ── */
.topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(250, 247, 242, 0.88);
  backdrop-filter: blur(16px) saturate(1.4);
  border-bottom: 1px solid #e8e2d7;
}
.topbar-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}
.logo {
  font-family: 'Playfair Display', 'Noto Serif SC', serif;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1a1815;
  letter-spacing: -0.2px;
  text-decoration: none;
  display: flex;
  align-items: baseline;
  gap: 1px;
}
.logo em {
  font-style: normal;
  color: #d97706;
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.btn-ghost {
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  color: #5c554a;
  background: none;
  border: 1px solid transparent;
  padding: 7px 16px;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
.btn-ghost:hover {
  background: #fff;
  border-color: #e8e2d7;
  color: #1a1815;
}

/* ── Avatar ── */
.avatar-wrapper {
  position: relative;
  z-index: 200;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #d97706, #92400e);
  cursor: pointer;
  margin-left: 6px;
  box-shadow: 0 2px 8px rgba(217, 119, 6, 0.25);
  transition: transform 0.2s, box-shadow 0.2s;
}
.avatar:hover {
  transform: scale(1.06);
  box-shadow: 0 4px 16px rgba(217, 119, 6, 0.35);
}
.avatar-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 180px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
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

/* ── Loading ── */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 20px;
  gap: 16px;
}
.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e8e2d7;
  border-top-color: #d97706;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.loading-text {
  font-size: 0.85rem;
  color: #9c9488;
}

/* ── Error ── */
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120px 20px;
  gap: 16px;
}
.error-text {
  font-size: 0.95rem;
  color: #dc2626;
}

/* ── Reader ── */
.reader-wrapper {
  padding: 48px 20px 80px;
}
.reader {
  position: relative;
  z-index: 1;
  max-width: 780px;
  margin: 0 auto;
  background: #fff;
  border-radius: 2px;
  box-shadow: 0 1px 0 #e8e2d7, 0 4px 32px rgba(0, 0, 0, 0.03);
}

/* Article Header */
.article-header {
  padding: 56px 64px 40px;
  border-bottom: 1px solid #e8e2d7;
  position: relative;
}
.article-header::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: 64px;
  width: 48px;
  height: 2px;
  background: #d97706;
}
.kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
.badge {
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: 3px;
}
.badge--type {
  background: #fef2f2;
  color: #dc2626;
}
.badge--cat {
  background: #fef3c7;
  color: #92400e;
}
.kicker-sep {
  width: 1px;
  height: 12px;
  background: #e8e2d7;
}
.article-title {
  font-family: 'Noto Serif SC', 'Playfair Display', serif;
  font-size: 1.8rem;
  font-weight: 900;
  line-height: 1.35;
  letter-spacing: -0.3px;
  color: #1a1815;
  margin-bottom: 20px;
}
.byline {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 0.8rem;
  color: #9c9488;
}
.byline-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #d97706;
  opacity: 0.5;
}

/* Article Body */
.article-body {
  padding: 48px 64px 60px;
}

/* TXT Content */
.txt-content {
  font-family: 'DM Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', monospace;
  font-size: 0.88rem;
  line-height: 1.9;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

/* ── Unsupported ── */
.unsupported-body {
  padding: 100px 64px;
  text-align: center;
}
.unsupported-icon {
  color: #d1d5db;
  margin-bottom: 20px;
}
.unsupported-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1a1815;
  margin-bottom: 6px;
}
.unsupported-sub {
  font-size: 0.85rem;
  color: #9c9488;
  margin-bottom: 32px;
}
.btn-download {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  background: linear-gradient(135deg, #d97706, #b45309);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(180, 83, 9, 0.2);
  font-family: inherit;
}
.btn-download:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(180, 83, 9, 0.3);
}

/* Reader Footer */
.reader-footer {
  border-top: 1px solid #e8e2d7;
  padding: 20px 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #9c9488;
}

/* ── Embedded Images ── */
.embedded-images {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e8e2d7;
}
.embedded-image {
  max-width: 100%;
  max-height: 400px;
  border-radius: 6px;
  border: 1px solid #e8e2d7;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  object-fit: contain;
}

/* ── Image Preview ── */
.image-body {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.preview-image {
  max-width: 100%;
  max-height: 600px;
  border-radius: 8px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
}
/* ── Responsive ── */
@media (max-width: 768px) {
  .topbar-inner {
    padding: 0 20px;
  }
  .reader-wrapper {
    padding: 24px 12px 48px;
  }
  .article-header,
  .article-body,
  .reader-footer,
  .unsupported-body {
    padding-left: 28px;
    padding-right: 28px;
  }
  .article-header { padding-top: 36px; }
  .article-header::after { left: 28px; }
  .article-title { font-size: 1.35rem; }
  .byline { flex-wrap: wrap; gap: 8px; }
  .embedded-images { gap: 12px; margin-bottom: 24px; }
  .embedded-image { max-height: 300px; }
}

@media (max-width: 640px) {
  .topbar-inner { padding: 0 14px; height: 48px; }
  .reader-wrapper { padding: 16px 8px 32px; }
  .article-header,
  .article-body,
  .reader-footer,
  .unsupported-body {
    padding-left: 18px;
    padding-right: 18px;
  }
  .article-header { padding-top: 28px; padding-bottom: 28px; }
  .article-header::after { left: 18px; width: 36px; }
  .article-title { font-size: 1.15rem; }
  .kicker { gap: 6px; margin-bottom: 14px; }
  .badge { font-size: 0.6rem; padding: 3px 8px; }
  .txt-content { font-size: 0.82rem; }
  .btn-ghost { padding: 6px 12px; font-size: 0.75rem; }
  .logo { font-size: 1.1rem; }
  .embedded-images { gap: 8px; }
  .embedded-image { max-height: 250px; }
  .preview-image { max-height: 400px; }
}
</style>
