<template>
  <div class="document-library">
    <!-- TOP BAR -->
    <header class="topbar">
      <div class="logo">
        Pap<em>ier</em>
      </div>
      <ul class="top-nav">
        <li>
          <router-link
            to="/"
            class="active"
          >
            文档库
          </router-link>
        </li>
        <li><a href="#">集合</a></li>
        <li><a href="#">最近</a></li>
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
          >
            <circle
              cx="11"
              cy="11"
              r="8"
            />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            v-model="filters.title"
            type="text"
            placeholder="搜索文档..."
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
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  class="dropdown-icon"
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
    </header>

    <!-- SIDEBAR -->
    <nav class="sidebar">
      <div class="sidebar-section">
        <div class="sidebar-title">
          浏览
        </div>
        <ul class="sidebar-list">
          <li>
            <a
              href="#"
              :class="{ active: !filters.category_id && !showFavorites }"
              @click.prevent="clearFilters"
            >
              <svg
                class="sidebar-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              全部文档
              <span class="sidebar-count">{{ sidebarAllTotal }}</span>
            </a>
          </li>
          <li>
            <a
              href="#"
              :class="{ active: showFavorites }"
              @click.prevent="toggleFavorites"
            >
              <svg
                class="sidebar-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              收藏
              <span class="sidebar-count">{{ favTotal }}</span>
            </a>
          </li>
        </ul>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-title">
          分类
        </div>
        <ul class="sidebar-list">
          <li
            v-for="cat in categories"
            :key="cat.id"
          >
            <a
              href="#"
              :class="{ active: filters.category_id === cat.id }"
              @click.prevent="setFilter('category_id', cat.id)"
            >
              <span
                class="sidebar-tag"
                :style="{ background: catColors[cat.id % catColors.length] }"
              />
              {{ cat.name }}
              <span class="sidebar-count">{{ cat.docCount || 0 }}</span>
            </a>
          </li>
        </ul>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-title">
          标签
        </div>
        <ul class="sidebar-list">
          <li
            v-for="tag in tags"
            :key="tag.id"
          >
            <a
              href="#"
              @click.prevent="setFilter('tags', String(tag.id))"
            ># {{ tag.name }}</a>
          </li>
        </ul>
      </div>
    </nav>

    <!-- MAIN CONTENT -->
    <main class="main">
      <div class="page-header">
        <h1>{{ showFavorites ? '我的收藏' : '文档库' }}</h1>
        <p>{{ showFavorites ? '你收藏的文档' : '浏览和管理你所有的共享文档' }}</p>
      </div>

      <!-- Stats -->
      <div class="stats-row">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="stat-card"
        >
          <div class="stat-label">
            {{ stat.label }}
          </div>
          <div class="stat-value">
            {{ stat.value }}
          </div>
          <div :class="['stat-change', stat.changeType]">
            {{ stat.change }}
          </div>
        </div>
      </div>

      <!-- Featured -->
      <div
        v-if="featured && !showFavorites"
        class="featured"
        @click="openDoc(featured)"
      >
        <div class="featured-label">
          精选文档
        </div>
        <h2>{{ featured.title }}</h2>
        <p>{{ featured.uploader?.username }}</p>
        <div class="featured-meta">
          <span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle
                cx="12"
                cy="7"
                r="4"
              />
            </svg>
            {{ featured.uploader?.username }}
          </span>
          <span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
              />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {{ formatDate(featured.created_at) }}
          </span>
        </div>
      </div>

      <!-- Section header -->
      <div class="section-header">
        <h2>{{ showFavorites ? '收藏文档' : '最近更新' }}</h2>
      </div>

      <!-- Loading -->
      <div
        v-if="loading"
        class="text-center py-12 text-gray-400"
      >
        加载中...
      </div>

      <!-- Empty -->
      <div
        v-else-if="documents.length === 0"
        class="text-center py-12 text-gray-400"
      >
        {{ showFavorites ? '暂无收藏' : '暂无文档' }}
      </div>

      <!-- Doc Cards -->
      <div
        v-else
        class="doc-grid"
      >
        <div
          v-for="doc in documents"
          :key="doc.id"
          class="doc-card"
          @click="openDoc(doc)"
        >
          <div :class="['doc-type', (doc.file_type || '').toLowerCase()]">
            {{ doc.file_type?.toUpperCase() }}
          </div>
          <div class="doc-card-header">
            <h3>{{ doc.title }}</h3>
            <button
              v-if="authStore.isAuthenticated"
              class="fav-btn"
              :class="{ favorited: doc.isFavorited }"
              :title="doc.isFavorited ? '取消收藏' : '收藏'"
              @click.stop="handleFavorite(doc)"
            >
              {{ doc.isFavorited ? '★' : '☆' }}
            </button>
          </div>
          <p class="excerpt">
            {{ doc.file_size ? formatSize(doc.file_size) : '' }}
          </p>
          <div class="doc-footer">
            <div class="doc-author">
              <div
                class="doc-author-avatar"
                :style="{ background: avatarColor(doc.uploader?.username || '') }"
              >
                {{ (doc.uploader?.username || '?')[0].toUpperCase() }}
              </div>
              <span>{{ doc.uploader?.username || '未知' }}</span>
            </div>
            <span class="doc-date">{{ formatDate(doc.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="flex justify-center gap-2 mt-8 pb-8"
      >
        <button
          v-for="p in totalPages"
          :key="p"
          class="px-3 py-1.5 rounded text-sm"
          :class="page === p ? 'text-white' : 'bg-white border border-gray-200 hover:bg-gray-50'"
          :style="page === p ? { backgroundColor: '#c4873b' } : {}"
          @click="changePage(p)"
        >
          {{ p }}
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
import { ref, computed, onMounted, onBeforeUnmount, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { list as listDocs } from '../api/document'
import * as favoriteApi from '../api/favorite'
import { getCategories, getTags, getStats } from '../api/admin'
import UploadDialog from '../components/UploadDialog.vue'

const router = useRouter()
const authStore = useAuthStore()

interface DocItem { id: number; title: string; file_type: string; file_size: number; file_url?: string; created_at: string; uploader?: { username: string }; category?: { name: string }; tags?: { id: number; name: string }[]; isFavorited?: boolean }
interface OptionItem { id: number; name: string }
interface CategoryItem { id: number; name: string; docCount?: number }
interface DashboardStats { totalDocs: number; totalCategories: number; totalUsers: number }

const documents = ref<DocItem[]>([])
const categories = ref<CategoryItem[]>([])
const tags = ref<OptionItem[]>([])
const total = ref(0)
const allTotal = ref(0)
const favTotal = ref(0)
const page = ref(1)
const pageSize = ref(12)
const loading = ref(false)
const showFavorites = ref(false)
const showUpload = ref(false)
const showLogout = ref(false)

const filters = reactive({
  title: '',
  category_id: null as number | null,
  tags: '',
})

const featured = ref<DocItem | null>(null)
const dashboardStats = ref<DashboardStats | null>(null)

const catColors = ['#7a3b3b', '#c4873b', '#6b7c5e', '#5a4d3a', '#6b8db5', '#8b6b4a', '#5a7a5a', '#4a6b8a']

const sidebarAllTotal = computed(() => {
  if (dashboardStats.value?.totalDocs !== undefined) return dashboardStats.value.totalDocs
  return allTotal.value
})
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))

const stats = computed(() => {
  const s = dashboardStats.value
  return [
    { label: '总文档数', value: s?.totalDocs ?? '—', change: '总数', changeType: 'up' as const },
    { label: '分类数量', value: s?.totalCategories ?? '—', change: '个分类', changeType: 'up' as const },
    { label: '用户数量', value: s?.totalUsers ?? '—', change: '成员', changeType: 'up' as const },
    { label: '总存储量', value: '—', change: '本地', changeType: 'down' as const },
  ]
})

let searchTimer: ReturnType<typeof setTimeout>

function debouncedSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    loadDocuments()
  }, 300)
}

function setFilter(key: string, value: number | string) {
  showFavorites.value = false
  if (key === 'category_id') {
    filters.category_id = filters.category_id === value ? null : (value as number)
  } else if (key === 'tags') {
    filters.tags = filters.tags === value ? '' : (value as string)
  }
  page.value = 1
  loadDocuments()
  loadFeatured()
}

function clearFilters() {
  showFavorites.value = false
  filters.title = ''
  filters.category_id = null
  filters.tags = ''
  page.value = 1
  loadDocuments()
  loadFeatured()
  loadAllTotal()
}

async function toggleFavorites() {
  showFavorites.value = !showFavorites.value
  filters.category_id = null
  filters.tags = ''
  page.value = 1
  if (showFavorites.value) {
    await loadFavorites()
  } else {
    await loadDocuments()
    loadAllTotal()
  }
}

function changePage(p: number) {
  page.value = p
  if (showFavorites.value) loadFavorites()
  else loadDocuments()
}

async function loadDocuments() {
  loading.value = true
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value }
    if (filters.title) params.title = filters.title
    if (filters.category_id) params.category_id = filters.category_id
    if (filters.tags) params.tags = filters.tags

    const { data } = await listDocs(params)
    documents.value = (data.items || []).map((d: DocItem) => ({ ...d, isFavorited: false }))
    total.value = data.total
  } finally {
    loading.value = false
  }
}

async function loadAllTotal() {
  try {
    const { data } = await listDocs({ page: 1, pageSize: 1 })
    allTotal.value = data.total
  } catch { /* empty */ }
}

async function loadFavorites() {
  loading.value = true
  try {
    const { data } = await favoriteApi.list(page.value, pageSize.value)
    documents.value = (data.items || []).map((d: DocItem) => ({ ...d, isFavorited: true }))
    total.value = data.total
  } catch {
    documents.value = []
  } finally {
    loading.value = false
  }
}

async function loadFeatured() {
  try {
    const { data } = await listDocs({ is_featured: '1', pageSize: 1 })
    featured.value = data.items?.[0] || null
  } catch {
    featured.value = null
  }
}

async function handleFavorite(doc: DocItem) {
  if (!authStore.isAuthenticated) {
    router.push('/login')
    return
  }
  try {
    const { data } = await favoriteApi.toggle(doc.id)
    doc.isFavorited = data.favorited
    loadFavTotal()
  } catch { /* empty */ }
}

async function loadFavTotal() {
  try {
    const { data } = await favoriteApi.list(1, 1)
    favTotal.value = data.total
  } catch { /* empty */ }
}

function openDoc(doc: DocItem) {
  if (doc.file_type?.toLowerCase() === 'txt' || doc.file_type?.toLowerCase() === 'plain') {
    router.push(`/docs/${doc.id}`)
  } else if (doc.file_url) {
    window.open(doc.file_url, '_blank')
  }
}

async function loadStats() {
  try {
    const { data: statsData } = await getStats()
    dashboardStats.value = statsData
  } catch { /* empty */ }
}

async function onUploadClose() {
  showUpload.value = false
  await loadDocuments()
  loadFeatured()
  loadFavTotal()
  loadAllTotal()
  await loadStats()
  try {
    const { data: catData } = await getCategories()
    categories.value = catData
  } catch { /* empty */ }
}

function handleLogout() {
  showLogout.value = false
  authStore.logout()
  router.push('/login')
}

function onClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.avatar-wrapper')) {
    showLogout.value = false
  }
}

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN')
}

function formatSize(bytes: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function avatarColor(name: string): string {
  if (!name) return '#999'
  const colors = ['linear-gradient(135deg,#7a3b3b,#a06a28)', 'linear-gradient(135deg,#6b7c5e,#4a6741)', 'linear-gradient(135deg,#c4873b,#8b5e34)', 'linear-gradient(135deg,#2c2418,#5a4d3a)', 'linear-gradient(135deg,#6b8db5,#4a6b8a)']
  return colors[name.charCodeAt(0) % colors.length]
}

onMounted(async () => {
  document.addEventListener('click', onClickOutside)
  try {
    const { data: catData } = await getCategories()
    categories.value = catData
  } catch { /* empty */ }
  try {
    const { data: tagData } = await getTags()
    tags.value = tagData
  } catch { /* empty */ }
  await loadStats()
  await loadDocuments()
  loadAllTotal()
  await loadFeatured()
  if (authStore.isAuthenticated) {
    loadFavTotal()
  }

})
onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
.document-library {
  --parchment: #f5f0e8;
  --cream: #ece5d8;
  --warm-gray: #b8ae9e;
  --ink: #2c2418;
  --ink-light: #5a4d3a;
  --amber: #c4873b;
  --amber-deep: #a06a28;
  --burgundy: #7a3b3b;
  --sage: #6b7c5e;
  --sidebar-w: 280px;
  --topbar-h: 64px;
  --grain: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
}

.document-library::after {
  content: '';
  position: fixed;
  inset: 0;
  background: var(--grain);
  background-size: 256px;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.5;
}

.topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--topbar-h);
  background: var(--ink);
  display: flex;
  align-items: center;
  padding: 0 32px;
  z-index: 100;
  border-bottom: 2px solid var(--amber);
}

.topbar::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--grain);
  background-size: 256px;
  opacity: 0.3;
  pointer-events: none;
}

.logo {
  font-family: 'Playfair Display', serif;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--parchment);
  letter-spacing: 0.04em;
  margin-right: 48px;
  position: relative;
}

.logo em {
  color: var(--amber);
  font-style: italic;
}

.top-nav {
  display: flex;
  gap: 4px;
  list-style: none;
  height: 100%;
  align-items: center;
}

.top-nav li a {
  color: var(--warm-gray);
  text-decoration: none;
  font-size: 0.87rem;
  font-weight: 500;
  padding: 8px 18px;
  border-radius: 6px;
  transition: all 0.25s ease;
  letter-spacing: 0.02em;
  position: relative;
}

.top-nav li a:hover,
.top-nav li a.active {
  color: var(--parchment);
  background: rgba(196, 135, 59, 0.15);
}

.top-nav li a.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 20px;
  height: 2px;
  background: var(--amber);
  border-radius: 1px;
}

.topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-box { position: relative; }

.search-box input {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--parchment);
  padding: 8px 16px 8px 36px;
  border-radius: 20px;
  font-family: inherit;
  font-size: 0.85rem;
  width: 220px;
  transition: all 0.3s ease;
  outline: none;
}

.search-box input::placeholder { color: var(--warm-gray); }

.search-box input:focus {
  width: 300px;
  background: rgba(255, 255, 255, 0.12);
  border-color: var(--amber);
}

.search-box svg {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 16px;
  height: 16px;
  color: var(--warm-gray);
}

.btn-admin {
  color: var(--warm-gray);
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 6px;
  transition: all 0.25s ease;
}

.btn-admin:hover {
  color: var(--parchment);
  background: rgba(255, 255, 255, 0.08);
}

.btn-upload {
  background: var(--amber);
  color: var(--ink);
  border: none;
  padding: 8px 20px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
  letter-spacing: 0.02em;
}

.btn-upload:hover {
  background: var(--amber-deep);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(196, 135, 59, 0.3);
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--amber), var(--burgundy));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--parchment);
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.avatar:hover { transform: scale(1.08); }

.avatar-wrapper {
  position: relative;
  z-index: 100;
}

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

.dropdown-icon {
  width: 16px;
  height: 16px;
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

/* SIDEBAR */
.sidebar {
  position: fixed;
  top: var(--topbar-h);
  left: 0;
  bottom: 0;
  width: var(--sidebar-w);
  background: var(--cream);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  overflow-y: auto;
  padding: 24px 0;
  z-index: 50;
}

.sidebar::-webkit-scrollbar { width: 4px; }
.sidebar::-webkit-scrollbar-track { background: transparent; }
.sidebar::-webkit-scrollbar-thumb { background: var(--warm-gray); border-radius: 2px; }

.sidebar-section { margin-bottom: 28px; padding: 0 20px; }

.sidebar-title {
  font-family: 'DM Sans', sans-serif;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--warm-gray);
  margin-bottom: 12px;
  padding-left: 12px;
}

.sidebar-list { list-style: none; }

.sidebar-list li a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: var(--ink-light);
  font-size: 0.9rem;
  font-weight: 400;
  transition: all 0.2s ease;
  position: relative;
}

.sidebar-list li a:hover {
  background: rgba(196, 135, 59, 0.08);
  color: var(--ink);
}

.sidebar-list li a.active {
  background: rgba(196, 135, 59, 0.12);
  color: var(--amber-deep);
  font-weight: 500;
}

.sidebar-list li a.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  background: var(--amber);
  border-radius: 0 2px 2px 0;
}

.sidebar-icon { width: 20px; height: 20px; opacity: 0.7; flex-shrink: 0; }

.sidebar-list li a:hover .sidebar-icon,
.sidebar-list li a.active .sidebar-icon { opacity: 1; }

.sidebar-count {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--warm-gray);
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.sidebar-tag {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
}

/* MAIN CONTENT */
.main {
  margin-top: var(--topbar-h);
  margin-left: var(--sidebar-w);
  height: calc(100vh - var(--topbar-h));
  overflow-y: auto;
  padding: 36px 40px;
}

.main::-webkit-scrollbar { width: 6px; }
.main::-webkit-scrollbar-track { background: transparent; }
.main::-webkit-scrollbar-thumb { background: var(--warm-gray); border-radius: 3px; }

.page-header { margin-bottom: 36px; animation: fadeUp 0.6s ease both; }

.page-header h1 {
  font-family: 'Playfair Display', serif;
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 8px;
}

.page-header p {
  color: var(--ink-light);
  font-size: 0.95rem;
  font-weight: 300;
}

/* FEATURED */
.featured {
  background: var(--ink);
  border-radius: 16px;
  padding: 36px 40px;
  margin-bottom: 36px;
  position: relative;
  overflow: hidden;
  animation: fadeUp 0.6s 0.1s ease both;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.featured:hover { transform: translateY(-2px); }

.featured::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(196, 135, 59, 0.2) 0%, transparent 70%);
  pointer-events: none;
}

.featured::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--grain);
  background-size: 256px;
  opacity: 0.4;
  pointer-events: none;
}

.featured-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--amber);
  font-weight: 600;
  margin-bottom: 12px;
}

.featured h2 {
  font-family: 'Playfair Display', serif;
  font-size: 1.7rem;
  color: var(--parchment);
  font-weight: 600;
  margin-bottom: 10px;
  position: relative;
  z-index: 1;
}

.featured p {
  color: var(--warm-gray);
  font-size: 0.92rem;
  line-height: 1.6;
  max-width: 560px;
  position: relative;
  z-index: 1;
}

.featured-meta {
  display: flex;
  gap: 20px;
  margin-top: 20px;
  position: relative;
  z-index: 1;
}

.featured-meta span {
  font-size: 0.8rem;
  color: var(--warm-gray);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* SECTION HEADER */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  animation: fadeUp 0.6s 0.2s ease both;
}

.section-header h2 {
  font-family: 'Playfair Display', serif;
  font-size: 1.35rem;
  font-weight: 600;
}

/* DOC CARDS */
.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 48px;
}

.doc-card {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  position: relative;
  overflow: hidden;
  animation: fadeUp 0.5s ease both;
}

.doc-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--amber);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.doc-card:hover::before { transform: scaleX(1); }

.doc-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(44, 36, 24, 0.08);
  border-color: rgba(196, 135, 59, 0.2);
}

.doc-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.doc-card h3 {
  font-family: 'Source Serif 4', serif;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 8px;
  line-height: 1.4;
  transition: color 0.2s;
}

.doc-card:hover h3 { color: var(--amber-deep); }

.fav-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--warm-gray);
  padding: 0 4px;
  flex-shrink: 0;
  transition: color 0.2s;
}

.fav-btn.favorited { color: #e8b730; }

.fav-btn:hover { color: #e8b730; }

.doc-type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 4px 10px;
  border-radius: 4px;
  margin-bottom: 14px;
}

.doc-type.pdf { background: rgba(122, 59, 59, 0.08); color: var(--burgundy); }
.doc-type.doc, .doc-type.docx { background: rgba(107, 124, 94, 0.1); color: var(--sage); }
.doc-type.ppt, .doc-type.pptx { background: rgba(196, 135, 59, 0.1); color: var(--amber-deep); }
.doc-type.xls, .doc-type.xlsx, .doc-type.sheet { background: rgba(44, 36, 24, 0.06); color: var(--ink-light); }
.doc-type.txt { background: rgba(107, 141, 181, 0.1); color: #6b8db5; }
.doc-type.jpg, .doc-type.jpeg, .doc-type.png, .doc-type.gif { background: rgba(107, 124, 94, 0.1); color: var(--sage); }

.doc-card .excerpt {
  font-size: 0.84rem;
  color: var(--warm-gray);
  line-height: 1.55;
  margin-bottom: 16px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.doc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

.doc-author { display: flex; align-items: center; gap: 8px; }

.doc-author-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: #fff;
}

.doc-author span { font-size: 0.8rem; color: var(--ink-light); }

.doc-date { font-size: 0.76rem; color: var(--warm-gray); }

/* STATS */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 40px;
  animation: fadeUp 0.6s 0.15s ease both;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.stat-card:hover {
  border-color: rgba(196, 135, 59, 0.15);
  box-shadow: 0 4px 16px rgba(44, 36, 24, 0.05);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--warm-gray);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  font-weight: 500;
}

.stat-value {
  font-family: 'Playfair Display', serif;
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--ink);
}

.stat-change { font-size: 0.78rem; margin-top: 4px; font-weight: 500; }
.stat-change.up { color: var(--sage); }
.stat-change.down { color: var(--burgundy); }

/* ANIMATIONS */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

/* RESPONSIVE */
@media (max-width: 900px) {
  .sidebar { display: none; }
  .main { margin-left: 0; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
