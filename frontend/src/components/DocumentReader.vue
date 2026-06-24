<template>
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
  </div>

  <!-- Reader -->
  <main
    v-else-if="doc"
    class="reader-wrapper"
    :class="{ embedded }"
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

      <!-- PDF: pdfjs-dist continuous scroll -->
      <div
        v-if="fileTypeCategory === 'pdf'"
        class="article-body"
      >
        <div
          v-if="pdfLoading"
          class="pdf-status"
        >
          加载 PDF 中...
        </div>
        <div
          v-else-if="pdfError"
          class="pdf-status pdf-status-error"
        >
          {{ pdfError }}
        </div>

        <div
          v-if="!pdfLoading && !pdfError"
          class="pdf-toolbar"
        >
          <button
            :disabled="pdfScale <= 0.5"
            @click="setScale(-0.25)"
          >
            -
          </button>
          <span>{{ Math.round(pdfScale * 100) }}%</span>
          <button
            :disabled="pdfScale >= 3"
            @click="setScale(+0.25)"
          >
            +
          </button>
        </div>

        <div
          ref="pdfContainerRef"
          class="pdf-scroll-container"
        />

        <div class="pdf-native-link">
          <a
            :href="fileDownloadUrl"
            target="_blank"
            class="btn-ghost"
          >在原生 PDF 查看器中打开</a>
        </div>
      </div>

      <!-- Word: HTML rendering -->
      <div
        v-else-if="fileTypeCategory === 'word'"
        class="article-body"
      >
        <div
          v-if="docHtml"
          class="docx-html"
          v-html="docHtml"
        />
        <div
          v-else-if="embeddedImages.length > 0"
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
        <pre
          v-else
          class="txt-content"
        >{{ rawContent || '（文件内容为空）' }}</pre>
      </div>

      <!-- Text-based Content (TXT) -->
      <div
        v-else-if="fileTypeCategory === 'txt'"
        class="article-body"
      >
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

      <footer
        v-if="!embedded"
        class="reader-footer"
      >
        <span>Papier 文档库</span>
        <span>安全存储 · 团队共享</span>
      </footer>
    </article>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { getById, getContent } from '../api/document'
import * as pdfjsLib from 'pdfjs-dist'
import type { DocItem } from '../types/api'

// ── PDF Worker 调试 ──
const WORKER_PATH = '/pdf.worker.js'
function logPdf(msg: string, detail?: any) {
  const ts = new Date().toISOString().slice(11, 23)
  const prefix = `[PDF ${ts}]`
  if (detail !== undefined) {
    console.log(`${prefix} ${msg}`, detail)
  } else {
    console.log(`${prefix} ${msg}`)
  }
}
logPdf('worker 路径:', WORKER_PATH)
logPdf('当前 origin:', window.location.origin)
logPdf('worker 完整 URL:', window.location.origin + WORKER_PATH)

pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_PATH

const props = defineProps<{
  docId: number
  embedded?: boolean
}>()

const emit = defineEmits<{
  loaded: [doc: DocItem, downloadUrl: string]
}>()

const doc = ref<DocItem | null>(null)
const rawContent = ref('')
const docHtml = ref('')
const embeddedImages = ref<string[]>([])
const loading = ref(true)
const error = ref('')

// ── PDF rendering state ──
const pdfContainerRef = ref<HTMLDivElement | null>(null)
const pdfTotalPages = ref(0)
const pdfScale = ref(1)
const pdfLoading = ref(false)
const pdfError = ref('')
let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null

const fileDownloadUrl = computed(() => {
  if (!doc.value?.file_url) return ''
  return doc.value.file_url
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

async function loadPdf(url: string) {
  pdfLoading.value = true
  pdfError.value = ''
  if (pdfDoc) { pdfDoc.destroy(); pdfDoc = null }
  pdfTotalPages.value = 0
  pdfScale.value = 1

  if (!url) {
    pdfError.value = 'PDF 文件地址为空，无法加载'
    pdfLoading.value = false
    logPdf('加载失败: URL 为空')
    return
  }

  logPdf('开始加载 PDF:', url)
  try {
    logPdf('调用 getDocument, workerSrc:', pdfjsLib.GlobalWorkerOptions.workerSrc)
    const loadingTask = pdfjsLib.getDocument(url)
    pdfDoc = await loadingTask.promise
    logPdf('PDF 加载成功, 页数:', pdfDoc.numPages)
    pdfTotalPages.value = pdfDoc.numPages
    pdfLoading.value = false
  } catch (e: unknown) {
    const msg = `PDF 加载失败：${(e as Error).message || '未知错误'}`
    pdfError.value = msg
    logPdf('加载异常:', msg)
    console.error('[PDF] 完整错误:', e)
    pdfLoading.value = false
  }
}

async function renderAllPages() {
  const container = pdfContainerRef.value
  if (!pdfDoc || !container) return

  container.innerHTML = ''
  const displayWidth = (container.clientWidth || 700) - 32
  const renderDpr = Math.max(window.devicePixelRatio || 1, 2) // 至少2x，1x屏幕也清晰

  for (let i = 1; i <= pdfTotalPages.value; i++) {
    try {
      const page = await pdfDoc.getPage(i)
      const viewport = page.getViewport({ scale: 1 })
      const fitScale = Math.min(1, displayWidth / viewport.width) * pdfScale.value
      const cssW = viewport.width * fitScale
      const cssH = viewport.height * fitScale
      const renderViewport = page.getViewport({ scale: fitScale * renderDpr })

      const wrapper = document.createElement('div')
      wrapper.className = 'pdf-page-wrapper'

      const canvas = document.createElement('canvas')
      canvas.width = cssW * renderDpr
      canvas.height = cssH * renderDpr
      canvas.style.width = cssW + 'px'
      canvas.style.height = cssH + 'px'

      wrapper.appendChild(canvas)
      container.appendChild(wrapper)

      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      await page.render({ canvas, viewport: renderViewport, canvasContext: ctx }).promise
    } catch {
      // page render failed, continue to next
    }
  }
}

function setScale(delta: number) {
  pdfScale.value = Math.max(0.5, Math.min(3, pdfScale.value + delta))
  nextTick(() => renderAllPages())
}

async function fetchDoc() {
  loading.value = true
  error.value = ''
  try {
    const id = props.docId
    if (!id) throw new Error('无效的文档ID')

    const { data } = await getById(id)
    doc.value = data as DocItem

    emit('loaded', doc.value, fileDownloadUrl.value)

    const type = data.file_type?.toLowerCase() || ''
    const contentTypes = ['txt', 'plain', 'doc', 'docx']
    const imageTypes = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif']
    const viewableTypes = ['pdf', ...contentTypes, ...imageTypes]

    if (viewableTypes.includes(type)) {
      if (type === 'pdf') {
        await loadPdf(fileDownloadUrl.value)
      } else if (contentTypes.includes(type)) {
        try {
          const { data: contentData } = await getContent(id)
          rawContent.value = contentData.text || ''
          docHtml.value = contentData.html || ''
          embeddedImages.value = contentData.images || []
        } catch {
          rawContent.value = ''
          docHtml.value = ''
          embeddedImages.value = []
        }
      }
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } }; message?: string }
    error.value = err?.response?.data?.message || err.message || '加载文档失败'
  } finally {
    loading.value = false
  }

  if (doc.value?.file_type?.toLowerCase() === 'pdf' && pdfDoc) {
    await nextTick()
    await renderAllPages()
  }
}

onMounted(() => fetchDoc())

watch(() => props.docId, () => {
  if (pdfDoc) { pdfDoc.destroy(); pdfDoc = null }
  fetchDoc()
})

onBeforeUnmount(() => {
  if (pdfDoc) pdfDoc.destroy()
})
</script>

<style scoped>
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
.reader-wrapper.embedded {
  padding: 0;
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
.embedded .reader {
  box-shadow: none;
  border-radius: 0;
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

/* ── DOCX HTML ── */
.docx-html {
  font-size: 0.92rem;
  line-height: 1.85;
  color: #1a1815;
}
.docx-html :deep(h1),
.docx-html :deep(h2),
.docx-html :deep(h3) {
  font-family: 'Noto Serif SC', serif;
  margin: 24px 0 10px;
}
.docx-html :deep(p) { margin: 0 0 10px; }
.docx-html :deep(ul),
.docx-html :deep(ol) { margin: 8px 0; padding-left: 22px; }
.docx-html :deep(img) { max-width: 100%; margin: 12px 0; border-radius: 4px; }
.docx-html :deep(table) { border-collapse: collapse; width: 100%; margin: 12px 0; }
.docx-html :deep(td),
.docx-html :deep(th) { border: 1px solid #e8e2d7; padding: 8px 12px; font-size: 0.85rem; }

/* ── PDF Status ── */
.pdf-status {
  text-align: center;
  padding: 40px 20px;
  color: #9c9488;
  font-size: 0.9rem;
}
.pdf-status-error {
  color: #dc2626;
}

/* ── PDF Toolbar ── */
.pdf-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 8px 0;
  margin-bottom: 16px;
  border-bottom: 1px solid #e8e2d7;
  position: sticky;
  top: 0;
  background: #faf9f6;
  z-index: 10;
}
.pdf-toolbar button {
  padding: 4px 12px;
  border: 1px solid #d4cdc0;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 0.85rem;
  color: #5c5548;
}
.pdf-toolbar button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pdf-toolbar button:hover:not(:disabled) {
  background: #f0ece4;
}

/* ── PDF Scroll Container ── */
.pdf-scroll-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 16px 0;
}
.pdf-page-wrapper canvas {
  max-width: 100%;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

/* ── PDF Native Link ── */
.pdf-native-link {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e8e2d7;
  text-align: center;
}

/* ── Ghost Button (for PDF native link) ── */
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

/* ── Page Break ── */
.page-break {
  border: none;
  border-top: 2px dashed #d4cdc0;
  margin: 32px 0;
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
  .reader-wrapper:not(.embedded) {
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
  .reader-wrapper:not(.embedded) {
    padding: 16px 8px 32px;
  }
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
  .embedded-images { gap: 8px; }
  .embedded-image { max-height: 250px; }
  .preview-image { max-height: 400px; }
}
</style>
