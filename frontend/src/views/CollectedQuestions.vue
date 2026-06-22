<template>
  <div class="collected-page">
    <AppTopbar activeRoute="collected" />

    <!-- Main -->
    <main class="main">
      <h1 class="page-title">已收录</h1>
      <p class="page-subtitle">系统从文档中提取和 AI 预生成的全部题目</p>

      <!-- Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-number">{{ stats.total }}</div>
          <div class="stat-label">总收录题数</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ stats.extracted }}</div>
          <div class="stat-label">从文档提取</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ stats.pregenerated }}</div>
          <div class="stat-label">AI 预生成</div>
        </div>
        <div class="stat-card">
          <div class="stat-number">{{ stats.knowledgePoints }}</div>
          <div class="stat-label">覆盖知识点</div>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <div class="filter-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input v-model="filters.keyword" type="text" placeholder="搜索知识点或题干..." @input="debouncedSearch" />
        </div>
        <div class="filter-divider" />
        <div class="filter-group">
          <button :class="['filter-chip', { active: filters.sourceType === 'all' }]" @click="setFilter('sourceType', 'all')">全部</button>
          <button :class="['filter-chip', { active: filters.sourceType === 'extracted' }]" @click="setFilter('sourceType', 'extracted')">文档提取</button>
          <button :class="['filter-chip', { active: filters.sourceType === 'ai_pregenerated' }]" @click="setFilter('sourceType', 'ai_pregenerated')">AI 预生成</button>
        </div>
        <div class="filter-divider" />
        <div class="filter-group">
          <button :class="['filter-chip star', { active: filters.difficulty === 'all' }]" @click="setFilter('difficulty', 'all')">全部</button>
          <button v-for="l in 5" :key="l" :class="['filter-chip star', { active: filters.difficulty === String(l) }]" @click="setFilter('difficulty', String(l))">{{ l }}★</button>
        </div>
        <div class="filter-divider" />
        <div class="filter-group">
          <button :class="['filter-chip', { active: filters.practiceStatus === 'all' }]" @click="setFilter('practiceStatus', 'all')">全部</button>
          <button :class="['filter-chip', { active: filters.practiceStatus === 'mastered' }]" @click="setFilter('practiceStatus', 'mastered')">已掌握</button>
          <button :class="['filter-chip', { active: filters.practiceStatus === 'review' }]" @click="setFilter('practiceStatus', 'review')">需复习</button>
        </div>
        <span class="result-count">共 {{ total }} 道题目</span>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-dots"><span /><span /><span /></div>

      <!-- Empty -->
      <div v-else-if="questions.length === 0" class="empty-state">
        <p>暂无收录的题目</p>
      </div>

      <!-- Questions -->
      <div class="questions-list">
        <div
          v-for="(q, i) in questions"
          :key="q.id"
          :class="['q-card', { expanded: expanded.has(q.id) }]"
          :style="{ animationDelay: i * 0.03 + 's' }"
        >
          <div class="q-header" @click="toggle(q.id)">
            <div class="q-num">{{ pad((page - 1) * pageSize + i + 1) }}</div>
            <div class="q-stem">{{ cleanStem(q.stem) }}</div>
            <div class="q-meta">
              <span :class="['q-tag', q.source_type === 'extracted' ? 'extracted' : 'pregenerated']">
                {{ q.source_type === 'extracted' ? '文档提取' : 'AI 预生成' }}
              </span>
              <span class="q-star-row">
                <span v-for="s in 5" :key="s" :class="['q-star', { filled: q.difficulty && s <= q.difficulty }]">★</span>
              </span>
            </div>
            <button class="q-toggle-btn" @click.stop="toggle(q.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polyline :points="expanded.has(q.id) ? '6 15 12 9 18 15' : '6 9 12 15 18 9'" />
              </svg>
              {{ expanded.has(q.id) ? '收起' : '展开' }}
            </button>
          </div>
          <div :ref="(el: any) => answerRefs[q.id] = el" class="q-answer">
            <div class="q-answer-inner" v-html="renderMarkdown(q.explanation)" />
          </div>
          <div class="q-actions">
            <button :class="['action-btn', { active: q.userStatus === 'mastered' }]" @click.stop="handleMarkStatus(q, 'mastered')">已掌握</button>
            <button :class="['action-btn review', { active: q.userStatus === 'review' }]" @click.stop="handleMarkStatus(q, 'review')">需复习</button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button
          v-for="p in visiblePages" :key="p"
          :class="['page-btn', { active: page === p, ellipsis: p === '...' }]"
          :disabled="p === '...'"
          @click="p !== '...' && goPage(p as number)"
        >{{ p }}</button>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { marked } from 'marked'
import { listQuestions, getQuestionsStats, recordPractice } from '../api/training'
import type { QuestionItem } from '../api/training'
import AppTopbar from '../components/AppTopbar.vue'

const loading = ref(false)
const questions = ref<QuestionItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(12)
const expanded = ref(new Set<number>())
const answerRefs: Record<number, HTMLElement> = {}

const stats = reactive({ total: 0, extracted: 0, pregenerated: 0, knowledgePoints: 0 })

const filters = reactive({
  keyword: '',
  sourceType: 'all',
  difficulty: 'all',
  practiceStatus: 'all',
})

let searchTimer: ReturnType<typeof setTimeout> | null = null

const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

const visiblePages = computed(() => {
  const pages: (number | string)[] = []
  const tp = totalPages.value
  const cp = page.value
  if (tp <= 10) { for (let i=1;i<=tp;i++) pages.push(i) }
  else {
    pages.push(1)
    if (cp > 3) pages.push('...')
    const start = Math.max(2, cp - 2)
    const end = Math.min(tp - 1, cp + 2)
    if (cp <= 3) {
      for (let i=2;i<=5;i++) pages.push(i)
      pages.push('...')
    } else if (cp >= tp - 2) {
      for (let i=tp-4;i<tp;i++) pages.push(i)
    } else {
      for (let i=start;i<=end;i++) pages.push(i)
      pages.push('...')
    }
    pages.push(tp)
  }
  return pages
})

function setFilter(key: string, value: string) {
  ;(filters as any)[key] = value
  page.value = 1
  fetchData()
}

function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { page.value = 1; fetchData() }, 300)
}

async function toggle(id: number) {
  const el = answerRefs[id]
  const s = new Set(expanded.value)
  const isExpanded = s.has(id)
  if (el) {
    if (isExpanded) {
      el.style.transition = 'none'
      el.style.maxHeight = el.scrollHeight + 'px'
      el.offsetHeight
      el.style.transition = 'max-height 0.35s ease'
      el.style.maxHeight = '0px'
    } else {
      el.style.maxHeight = el.scrollHeight + 'px'
      el.addEventListener('transitionend', () => {
        el.style.maxHeight = 'none'
      }, { once: true })
    }
  }
  if (isExpanded) s.delete(id); else s.add(id)
  expanded.value = s
}

function goPage(p: number) {
  page.value = p
  fetchData()
  window.scrollTo({ top: 300, behavior: 'smooth' })
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function cleanStem(text: string): string {
  return text.replace(/^\s*(?:\d+[.、)）]\s*|[（(]\d+[)）]\s*|[一二三四五六七八九十]+[、.。)）]\s*)+/, '')
}

function renderMarkdown(text: string): string {
  if (!text) return ''
  return marked.parse(text, { async: false }) as string
}

async function fetchData() {
  loading.value = true
  try {
    const { data } = await listQuestions({
      page: page.value,
      pageSize: pageSize.value,
      keyword: filters.keyword || undefined,
      source_type: filters.sourceType,
      difficulty: filters.difficulty,
      practice_status: filters.practiceStatus,
    })
    questions.value = data.items
    total.value = data.total
  } catch { /* ignore */ }
  loading.value = false
}

async function handleMarkStatus(
  q: QuestionItem & { userStatus?: string | null },
  status: 'mastered' | 'review',
) {
  try {
    await recordPractice(q.id, status)
    q.userStatus = status
  } catch { /* ignore */ }
}

async function loadStats() {
  try {
    const { data } = await getQuestionsStats()
    Object.assign(stats, data)
  } catch { /* ignore */ }
}

onMounted(() => {
  fetchData()
  loadStats()
})
onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<style scoped>
.collected-page {
  --ink: #2c2418; --parchment: #f5f0e8; --amber: #c4873b;
  --amber-deep: #a06a28; --amber-light: #fef3c7; --border: #e8e2d7; --muted: #9c9488;
  --topbar-h: 64px;
  min-height: 100vh; background: var(--parchment);
}

/* ▸ Topbar ▸ */
.topbar { position: fixed; top: 0; left: 0; right: 0; height: var(--topbar-h); background: var(--ink); display: flex; align-items: center; padding: 0 32px; z-index: 100; border-bottom: 2px solid var(--amber); }
.logo { font-family: 'Playfair Display', serif; font-size: 1.6rem; font-weight: 700; color: var(--parchment); letter-spacing: 0.04em; margin-right: 48px; text-decoration: none; }
.logo em { color: var(--amber); font-style: italic; }
.top-nav { display: flex; list-style: none; gap: 2px; margin: 0; padding: 0; }
.top-nav a { display: block; padding: 8px 18px; border-radius: 6px; color: #b8ae9e; text-decoration: none; font-size: 0.85rem; font-weight: 500; transition: all 0.2s; }
.top-nav a:hover, .top-nav a.active { color: var(--parchment); background: rgba(196,135,59,0.15); }
.topbar-right { margin-left: auto; display: flex; align-items: center; }

/* ▸ Hamburger ▸ */
.hamburger { display: none; flex-direction: column; gap: 5px; background: none; border: none; cursor: pointer; padding: 6px; margin-left: auto; }
.hamburger span { display: block; width: 22px; height: 2px; background: var(--parchment); border-radius: 1px; }
.mobile-nav-overlay { position: fixed; top: var(--topbar-h); left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.45); z-index: 150; }
.mobile-nav-panel { background: var(--ink); padding: 8px 0; }
.mobile-nav-link { display: block; padding: 14px 32px; color: var(--parchment); text-decoration: none; font-size: 0.95rem; font-weight: 500; }
.mobile-nav-link:hover, .mobile-nav-link.active { background: rgba(196,135,59,0.2); color: var(--amber); }

/* ▸ Avatar ▸ */
.avatar-wrapper { cursor: pointer; }
.avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #fff; background: linear-gradient(135deg, var(--amber), #92400e); }
.avatar-dropdown { position: absolute; top: calc(var(--topbar-h)); right: 32px; min-width: 180px; background: #fff; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.15); padding: 6px; z-index: 200; }
.dropdown-user { padding: 10px 14px; border-bottom: 1px solid var(--border); }
.dropdown-name { font-size: 0.85rem; font-weight: 600; color: var(--ink); display: block; }
.dropdown-role { font-size: 0.72rem; color: var(--muted); }
.dropdown-item { display: block; width: 100%; padding: 10px 14px; border: none; background: none; cursor: pointer; font-size: 0.82rem; color: var(--ink); font-family: inherit; border-radius: 8px; text-align: left; transition: all 0.15s; }
.dropdown-item:hover { background: #fef3c7; color: var(--amber-deep); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* ▸ Main ▸ */
.main { max-width: 900px; margin: 0 auto; padding: calc(var(--topbar-h) + 48px) 24px 100px; }
.page-title { font-family: 'Playfair Display', 'Noto Serif SC', serif; font-size: 2rem; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
.page-subtitle { font-size: 0.92rem; color: var(--muted); margin-bottom: 28px; }

/* ▸ Stats ▸ */
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 28px; }
.stat-card { background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 20px 24px; box-shadow: 0 1px 0 var(--border); transition: all 0.2s; }
.stat-card:hover { border-color: var(--amber); box-shadow: 0 2px 12px rgba(196,135,59,0.06); }
.stat-number { font-size: 1.6rem; font-weight: 700; color: var(--ink); }
.stat-label { font-size: 0.8rem; color: var(--muted); margin-top: 2px; }

/* ▸ Filters ▸ */
.filters-bar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; padding: 16px 0; margin-bottom: 20px; border-bottom: 1px solid var(--border); }
.filter-search { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border); background: #fff; flex: 1; max-width: 280px; transition: all 0.2s; }
.filter-search:focus-within { border-color: var(--amber); }
.filter-search svg { width: 16px; height: 16px; color: var(--muted); flex-shrink: 0; }
.filter-search input { border: none; outline: none; font-size: 0.85rem; font-family: inherit; background: transparent; width: 100%; color: var(--ink); }
.filter-search input::placeholder { color: var(--muted); }
.filter-group { display: flex; gap: 4px; }
.filter-chip { padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 500; border: 1px solid var(--border); background: #fff; color: #6b7280; cursor: pointer; font-family: inherit; transition: all 0.15s; }
.filter-chip:hover { border-color: var(--amber); color: var(--amber); }
.filter-chip.active { background: var(--amber); color: #fff; border-color: var(--amber); }
.filter-chip.star { font-size: 0.78rem; padding: 6px 10px; }
.filter-divider { width: 1px; height: 24px; background: var(--border); }
.result-count { font-size: 0.82rem; color: var(--muted); margin-left: auto; }

/* ▸ Loading ▸ */
.loading-dots { display: flex; justify-content: center; gap: 6px; padding: 48px 0; }
.loading-dots span { width: 8px; height: 8px; border-radius: 50%; background: var(--amber); animation: bounce 1.4s infinite ease-in-out both; }
.loading-dots span:nth-child(1) { animation-delay: -0.32s; }
.loading-dots span:nth-child(2) { animation-delay: -0.16s; }
@keyframes bounce { 0%,80%,100% { transform: scale(0); } 40% { transform: scale(1); } }

/* ▸ Empty ▸ */
.empty-state { text-align: center; padding: 64px 0; color: var(--muted); }

/* ▸ Cards ▸ */
.questions-list { display: flex; flex-direction: column; gap: 10px; }
.q-card { background: #fff; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; transition: all 0.2s; box-shadow: 0 1px 0 var(--border); animation: fadeUp 0.4s ease backwards; }
.q-card.expanded { border-color: var(--amber); box-shadow: 0 2px 16px rgba(196,135,59,0.08); }
@keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
.q-header { display: flex; align-items: center; gap: 16px; padding: 16px 24px; cursor: pointer; user-select: none; transition: background 0.15s; flex-wrap: wrap; }
.q-header:hover { background: #f5f0e8; }
.q-num { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; color: var(--amber); background: var(--amber-light); flex-shrink: 0; }
.q-stem { flex: 1; font-size: 0.93rem; font-weight: 500; line-height: 1.5; min-width: 200px; }
.q-meta { display: flex; gap: 6px; align-items: center; flex-shrink: 0; }
.q-tag { padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
.q-tag.extracted { background: #ecfdf5; color: #059669; }
.q-tag.pregenerated { background: #eef2ff; color: #4f46e5; }
.q-tag.kp { background: #f5f0e8; color: #6b7280; }
.q-star-row { display: flex; gap: 1px; }
.q-star { font-size: 0.7rem; color: #d1ccc0; }
.q-star.filled { color: #f59e0b; }
.q-toggle-btn { padding: 6px 14px; border-radius: 8px; font-size: 0.78rem; font-weight: 600; border: 1px solid var(--border); background: #fff; color: var(--amber); cursor: pointer; font-family: inherit; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
.q-toggle-btn:hover { background: var(--amber); color: #fff; border-color: var(--amber); }
.q-toggle-btn svg { width: 14px; height: 14px; transition: transform 0.3s; }
.q-card.expanded .q-toggle-btn svg { transform: rotate(180deg); }
.q-answer { max-height: 0; overflow: hidden; transition: max-height 0.35s ease; }
.q-answer-inner { margin: 0 24px; padding: 14px 0 18px; border-top: 1px solid var(--border); font-size: 0.88rem; line-height: 1.8; color: #374151; }
.q-answer-inner :deep(strong) { color: var(--ink); }
.q-answer-inner :deep(ul), .q-answer-inner :deep(ol) { margin-left: 18px; margin-bottom: 8px; }
.q-answer-inner :deep(li) { margin-bottom: 3px; }
.q-answer-inner :deep(code) { background: rgba(0,0,0,0.05); padding: 1px 5px; border-radius: 3px; font-size: 0.87em; }

/* ▸ Action buttons ▸ */
.q-actions { display: flex; gap: 8px; padding: 0 24px 16px; }
.action-btn { padding: 7px 16px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; border: 1px solid var(--border); background: #fff; cursor: pointer; font-family: inherit; transition: all 0.15s; color: #6b7280; }
.action-btn:hover { border-color: #10b981; color: #10b981; }
.action-btn.active { background: #ecfdf5; border-color: #10b981; color: #059669; }
.action-btn.review:hover { border-color: #f59e0b; color: #f59e0b; }
.action-btn.review.active { background: #fffbeb; border-color: #f59e0b; color: #d97706; }

/* ▸ Pagination ▸ */
.pagination { display: flex; justify-content: center; gap: 4px; margin-top: 32px; }
.page-btn { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 500; border: 1px solid var(--border); background: #fff; color: #6b7280; cursor: pointer; font-family: inherit; transition: all 0.15s; }
.page-btn:hover { border-color: var(--amber); color: var(--amber); }
.page-btn.active { background: var(--amber); color: #fff; border-color: var(--amber); }

/* ▸ Mobile ▸ */
@media (max-width: 768px) {
  .main { padding: calc(var(--topbar-h) + 32px) 16px 80px; }
  .top-nav { display: none; }
  .hamburger { display: flex; }
  .topbar { padding: 0 16px; }
  .logo { font-size: 1.3rem; margin-right: 24px; }
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .filter-search { max-width: 100%; }
  .q-meta { gap: 4px; }
  .page-title { font-size: 1.5rem; }
}
</style>
