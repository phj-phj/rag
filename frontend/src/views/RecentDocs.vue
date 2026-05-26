<template>
  <div class="recent-page">
    <!-- TOP BAR -->
    <header class="topbar">
      <button
        class="hamburger"
        @click="mobileMenuOpen = !mobileMenuOpen"
      >
        <span /><span /><span />
      </button>
      <router-link
        to="/"
        class="logo"
      >
        Pap<em>ier</em>
      </router-link>
      <ul class="top-nav">
        <li>
          <router-link to="/">
            文档库
          </router-link>
        </li>
        <li><a href="#">集合</a></li>
        <li>
          <router-link
            to="/recent"
            class="active"
          >
            最近
          </router-link>
        </li>
        <li><a href="#">共享给我</a></li>
        <li><a href="#">每日训练</a></li>
      </ul>
      <div class="topbar-right">
        <div class="search-box">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          ><circle
            cx="11"
            cy="11"
            r="8"
          /><path d="M21 21l-4.35-4.35" /></svg>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索我上传的文档..."
            @input="debouncedSearch"
          >
        </div>
        <router-link
          v-if="authStore.isAdmin"
          to="/admin"
          class="btn-admin"
        >
          后台管理
        </router-link>
        <button
          v-if="authStore.isAuthenticated"
          class="btn-upload"
          @click="showUpload = true"
        >
          + 上传文档
        </button>
        <router-link
          v-else
          to="/login"
          class="btn-upload"
          style="text-decoration:none;"
        >
          登录
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
                退出登录
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- Mobile Nav Overlay -->
    <Transition name="slide-down">
      <div
        v-if="mobileMenuOpen"
        class="mobile-nav-overlay"
        @click="mobileMenuOpen = false"
      >
        <nav
          class="mobile-nav-panel"
          @click.stop
        >
          <router-link
            to="/"
            class="mobile-nav-link"
            @click="mobileMenuOpen = false"
          >
            文档库
          </router-link>
          <router-link
            to="/recent"
            class="mobile-nav-link active"
            @click="mobileMenuOpen = false"
          >
            最近
          </router-link>
          <a
            href="#"
            class="mobile-nav-link"
            @click.prevent="mobileMenuOpen = false"
          >集合</a>
          <a
            href="#"
            class="mobile-nav-link"
            @click.prevent="mobileMenuOpen = false"
          >共享给我</a>
          <a
            href="#"
            class="mobile-nav-link"
            @click.prevent="mobileMenuOpen = false"
          >每日训练</a>
        </nav>
      </div>
    </Transition>

    <!-- MAIN CONTENT -->
    <main class="main">
      <div class="page-header">
        <h1>最近文档</h1>
        <p>你最近上传的文档</p>
      </div>

      <!-- Loading -->
      <div
        v-if="loading"
        class="loading-container"
      >
        <div class="loading-spinner" />
        <p class="loading-text">
          加载中...
        </p>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="documents.length === 0"
        class="empty-state"
      >
        <div class="empty-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          >
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
        </div>
        <h3>还没有上传任何文档</h3>
        <p>点击上方按钮开始上传你的第一个文档</p>
        <button
          class="btn-upload-large"
          @click="showUpload = true"
        >
          + 上传文档
        </button>
      </div>

      <!-- Document Grid -->
      <div
        v-else
        class="doc-grid"
      >
        <div
          v-for="(doc, idx) in documents"
          :key="doc.id"
          class="doc-card"
          :style="{ '--stripe': stripeColors[idx % stripeColors.length], animationDelay: idx * 0.06 + 's' }"
          @click="openDoc(doc)"
        >
          <div
            class="card-top-stripe"
            :class="doc.file_type?.toLowerCase()"
          />
          <span
            class="doc-type-badge"
            :class="doc.file_type?.toLowerCase()"
          >{{ doc.file_type?.toUpperCase() }}</span>
          <h3>{{ doc.title }}</h3>
          <div class="doc-meta">
            <span>{{ doc.uploader?.username || '未知' }}</span>
            <span class="doc-meta-dot" />
            <span>{{ formatDate(doc.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="pagination"
      >
        <button
          :disabled="page <= 1"
          @click="changePage(page - 1)"
        >
          ‹
        </button>
        <button
          v-for="p in visiblePages"
          :key="p"
          :class="{ active: p === page }"
          @click="changePage(p)"
        >
          {{ p }}
        </button>
        <button
          :disabled="page >= totalPages"
          @click="changePage(page + 1)"
        >
          ›
        </button>
      </div>
    </main>

    <!-- Upload Dialog -->
    <UploadDialog
      :visible="showUpload"
      @close="onUploadClose"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { list as listDocs } from '../api/document'
import UploadDialog from '../components/UploadDialog.vue'

interface DocItem {
  id: number; title: string; file_type: string; file_size: number
  file_url?: string; created_at: string
  uploader?: { username: string }
  category?: { name: string }
  tags?: { id: number; name: string }[]
}
const router = useRouter()
const authStore = useAuthStore()

const documents = ref<DocItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(12)
const loading = ref(false)
const searchQuery = ref('')
const showUpload = ref(false)
const showLogout = ref(false)
const mobileMenuOpen = ref(false)

let searchTimer: ReturnType<typeof setTimeout>

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const visiblePages = computed(() => {
  const pages: number[] = []
  const tp = totalPages.value
  if (tp <= 5) {
    for (let i = 1; i <= tp; i++) pages.push(i)
  } else {
    const start = Math.max(1, Math.min(page.value - 2, tp - 4))
    for (let i = start; i < start + 5; i++) pages.push(i)
  }
  return pages
})

const stripeColors = [
  'var(--burgundy)', 'var(--sage)', 'var(--blue-slate)',
  'var(--amber-deep)', 'var(--ink-light)', 'var(--amber)',
]

function debouncedSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadDocuments()
  }, 350)
}

async function loadDocuments() {
  if (!authStore.user) return
  loading.value = true
  try {
    const params: Record<string, unknown> = {
      page: page.value,
      pageSize: pageSize.value,
      uploader_id: authStore.user.id,
    }
    if (searchQuery.value) params.title = searchQuery.value
    const { data } = await listDocs(params)
    documents.value = data.items
    total.value = data.total
  } catch { /* empty */ }
  finally { loading.value = false }
}

function changePage(p: number) {
  page.value = p
  loadDocuments()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function openDoc(doc: DocItem) {
  const viewableTypes = ['txt', 'plain', 'pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'ico']
  const t = doc.file_type?.toLowerCase() || ''
  if (viewableTypes.includes(t)) {
    router.push(`/docs/${doc.id}`)
  } else if (doc.file_url) {
    window.open(doc.file_url, '_blank')
  }
}

async function onUploadClose() {
  showUpload.value = false
  await loadDocuments()
}

function handleLogout() {
  showLogout.value = false
  authStore.logout()
  router.push('/login')
}

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN')
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.avatar-wrapper')) showLogout.value = false
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  if (authStore.isAuthenticated) loadDocuments()
  else router.push('/login')
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
/* ── CSS Variables (mirrored from DocumentLibrary) ── */
.recent-page {
  --parchment: #f5f0e8;
  --cream: #ece5d8;
  --warm-gray: #b8ae9e;
  --ink: #2c2418;
  --ink-light: #5a4d3a;
  --amber: #c4873b;
  --amber-deep: #a06a28;
  --burgundy: #7a3b3b;
  --sage: #6b7c5e;
  --blue-slate: #6b8db5;
  --topbar-h: 64px;

  min-height: 100vh;
  background: var(--parchment);
  font-family: 'DM Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #1a1815;
}

/* ── Topbar ── */
.topbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: var(--topbar-h);
  background: var(--ink);
  display: flex; align-items: center;
  padding: 0 32px;
  z-index: 100;
  border-bottom: 2px solid var(--amber);
}
.logo {
  font-family: 'Playfair Display', serif;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--parchment);
  letter-spacing: 0.04em;
  margin-right: 48px;
  text-decoration: none;
  position: relative;
}
.logo em { color: var(--amber); font-style: italic; }

.top-nav { display: flex; list-style: none; gap: 2px; margin: 0; padding: 0; }
.top-nav a {
  display: block;
  padding: 8px 18px;
  border-radius: 6px;
  color: var(--warm-gray);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
}
.top-nav a:hover,
.top-nav a.active { color: var(--parchment); background: rgba(196,135,59,0.15); }

.topbar-right { display: flex; align-items: center; gap: 12px; margin-left: auto; }

.search-box { position: relative; display: flex; align-items: center; }
.search-box svg {
  position: absolute; left: 12px;
  width: 16px; height: 16px;
  color: var(--warm-gray); pointer-events: none;
}
.search-box input {
  width: 200px;
  padding: 8px 14px 8px 36px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: var(--parchment);
  font-size: 0.8rem;
  font-family: inherit;
  outline: none;
  transition: all 0.25s;
}
.search-box input::placeholder { color: rgba(255,255,255,0.3); }
.search-box input:focus {
  width: 260px;
  border-color: var(--amber);
  background: rgba(255,255,255,0.1);
}

.btn-upload {
  padding: 8px 18px;
  border-radius: 8px;
  border: none;
  background: var(--amber);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  transition: all 0.2s;
}
.btn-upload:hover { background: var(--amber-deep); }
.btn-admin {
  padding: 8px 16px;
  border-radius: 8px;
  background: rgba(196,135,59,0.12);
  color: var(--amber);
  text-decoration: none;
  font-size: 0.82rem;
  font-weight: 500;
  transition: all 0.2s;
}
.btn-admin:hover { background: rgba(196,135,59,0.2); }

/* ── Avatar ── */
.avatar-wrapper { position: relative; z-index: 200; }
.avatar {
  width: 34px; height: 34px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--amber), #92400e);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(196,135,59,0.25);
  transition: transform 0.2s;
}
.avatar:hover { transform: scale(1.06); }
.avatar-dropdown {
  position: absolute;
  top: calc(100% + 8px); right: 0;
  min-width: 180px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.12);
  overflow: hidden;
}
.dropdown-user { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; }
.dropdown-name { font-size: 0.9rem; font-weight: 600; color: #111827; }
.dropdown-role { font-size: 0.75rem; color: #9ca3af; display: block; }
.dropdown-item {
  width: 100%;
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px;
  font-size: 0.85rem; color: #6b7280;
  background: none; border: none; cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.dropdown-item:hover { background: #fef2f2; color: #dc2626; }

.fade-enter-active,
.fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; transform: translateY(-4px); }

/* ── Hamburger ── */
.hamburger { display: none; flex-direction: column; gap: 4px; background: none; border: none; cursor: pointer; padding: 8px; }
.hamburger span { width: 22px; height: 2px; background: var(--parchment); border-radius: 1px; }

/* ── Mobile Nav ── */
.mobile-nav-overlay {
  position: fixed;
  top: var(--topbar-h); left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.45);
  z-index: 150;
}
.mobile-nav-panel { background: var(--ink); padding: 8px 0; }
.mobile-nav-link {
  display: block;
  padding: 14px 24px;
  color: var(--warm-gray);
  text-decoration: none;
  font-size: 0.95rem;
  transition: all 0.15s;
}
.mobile-nav-link:hover,
.mobile-nav-link.active { color: var(--parchment); background: rgba(196,135,59,0.12); }

.slide-down-enter-active,
.slide-down-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.slide-down-enter-from,
.slide-down-leave-to { opacity: 0; transform: translateY(-8px); }

/* ── Main ── */
.main { padding: calc(var(--topbar-h) + 40px) 32px 80px; max-width: 1280px; margin: 0 auto; }

.page-header { padding-bottom: 8px; }
.page-header h1 {
  font-family: 'Noto Serif SC', 'Playfair Display', serif;
  font-size: 2rem;
  font-weight: 900;
  color: #1a1815;
  letter-spacing: -0.5px;
  margin-bottom: 6px;
}
.page-header p { font-size: 0.9rem; color: #9c9488; }

/* ── Loading ── */
.loading-container { display: flex; flex-direction: column; align-items: center; padding: 80px 20px; gap: 16px; }
.loading-spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--cream);
  border-top-color: var(--amber);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 0.85rem; color: var(--warm-gray); }

/* ── Empty State ── */
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 100px 20px; text-align: center; }
.empty-icon {
  width: 80px; height: 80px;
  border-radius: 50%;
  background: var(--cream);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 24px;
  color: var(--warm-gray);
}
.empty-icon svg { width: 36px; height: 36px; }
.empty-state h3 { font-family: 'Noto Serif SC', serif; font-size: 1.2rem; font-weight: 700; color: #1a1815; margin-bottom: 8px; }
.empty-state p { font-size: 0.9rem; color: #9c9488; margin-bottom: 24px; }
.btn-upload-large {
  padding: 12px 32px;
  border-radius: 10px;
  border: none;
  background: var(--amber);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-upload-large:hover { background: var(--amber-deep); }

/* ── Doc Grid ── */
.doc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 18px; }
.doc-card {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e8e2d7;
  padding: 22px 24px 18px;
  cursor: pointer;
  transition: all 0.25s;
  position: relative;
  overflow: hidden;
  animation: fadeUp 0.45s ease both;
}
.doc-card:hover { transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,0,0,0.06); border-color: var(--amber); }

.card-top-stripe { position: absolute; top: 0; left: 0; right: 0; height: 3px; }
.card-top-stripe.pdf { background: var(--burgundy); }
.card-top-stripe.doc,
.card-top-stripe.docx { background: var(--sage); }
.card-top-stripe.txt,
.card-top-stripe.plain { background: var(--blue-slate); }
.card-top-stripe.png,
.card-top-stripe.jpg,
.card-top-stripe.jpeg,
.card-top-stripe.gif,
.card-top-stripe.webp,
.card-top-stripe.bmp { background: var(--sage); }

.doc-type-badge {
  display: inline-block;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 3px;
  margin-bottom: 14px;
}
.doc-type-badge.pdf { background: rgba(122,59,59,0.08); color: var(--burgundy); }
.doc-type-badge.doc,
.doc-type-badge.docx { background: rgba(107,124,94,0.1); color: var(--sage); }
.doc-type-badge.txt,
.doc-type-badge.plain { background: rgba(107,141,181,0.1); color: var(--blue-slate); }
.doc-type-badge.png,
.doc-type-badge.jpg,
.doc-type-badge.jpeg,
.doc-type-badge.gif,
.doc-type-badge.webp,
.doc-type-badge.bmp { background: rgba(107,124,94,0.1); color: var(--sage); }

.doc-card h3 {
  font-family: 'Noto Serif SC', 'Playfair Display', serif;
  font-size: 1rem;
  font-weight: 700;
  color: #1a1815;
  line-height: 1.4;
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.doc-meta { display: flex; align-items: center; gap: 10px; font-size: 0.78rem; color: #9c9488; }
.doc-meta-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--amber); opacity: 0.5; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ── Pagination ── */
.pagination { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 40px; }
.pagination button {
  min-width: 36px; height: 36px;
  border-radius: 8px;
  border: 1px solid #e8e2d7;
  background: #fff;
  color: #5c554a;
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}
.pagination button:hover { border-color: var(--amber); }
.pagination button.active { background: var(--amber); color: #fff; border-color: var(--amber); }
.pagination button:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Responsive ── */
@media (max-width: 900px) {
  .hamburger { display: flex; }
  .top-nav { display: none; }
  .search-box input { width: 140px; }
  .search-box input:focus { width: 180px; }
  .doc-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .topbar { padding: 0 16px; }
  .main { padding: calc(var(--topbar-h) + 24px) 16px 60px; }
  .page-header h1 { font-size: 1.4rem; }
  .btn-upload { padding: 6px 14px; font-size: 0.78rem; }
  .btn-admin { display: none; }
  .logo { font-size: 1.3rem; margin-right: 24px; }
}
</style>
