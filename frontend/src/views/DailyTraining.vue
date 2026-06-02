<template>
  <div class="training-page">
    <AppTopbar activeRoute="training" />

    <!-- Main -->
    <main class="main">
      <h1 class="page-title">每日训练</h1>
      <p class="page-subtitle">AI 根据文档库内容出题，每日精进你的技术能力</p>

      <!-- 条件选择 -->
      <div class="input-card">
        <div class="filter-row">
          <label class="filter-label">知识点</label>
          <input
            v-model="selectedTopic"
            class="input-field"
            type="text"
            placeholder="如：Vue响应式、数据库事务..."
            :disabled="loading"
            @keydown.enter="startTraining"
          />
        </div>
        <div class="filter-row">
          <label class="filter-label">难度</label>
          <div class="difficulty-options">
            <button
              v-for="d in [null, 1, 2, 3, 4, 5]"
              :key="String(d)"
              :class="['difficulty-btn', { active: selectedDifficulty === d }]"
              :disabled="loading"
              @click="selectedDifficulty = d"
            >
              {{ d === null ? '全部' : d + '★' }}
            </button>
          </div>
        </div>
        <div class="filter-row">
          <label class="filter-label">数量</label>
          <div class="difficulty-options">
            <input
              v-model.number="selectedCount"
              class="count-input"
              type="number"
              min="1"
              max="50"
              :disabled="loading"
            />
            <span class="count-unit">道</span>
          </div>
        </div>
        <button
          class="btn btn-primary start-btn"
          :disabled="loading"
          @click="startTraining"
        >
          {{ loading ? '出题中...' : '开始训练' }}
        </button>
        <div v-if="showTimeoutHint" class="timeout-hint">
          如果是刚上传的文档，需要等待较长时间进行处理
        </div>
      </div>

      <!-- 加载动画 -->
      <div v-if="loading" class="loading-dots">
        <span /><span /><span />
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="error-box">{{ error }}</div>

      <!-- 统计条 -->
      <div v-if="done" class="score-bar">
        <span>共 <strong>{{ questions.length }}</strong> 道</span>
        <span>
          已掌握 <strong>{{ masterCount }}</strong> |
          需复习 <strong>{{ reviewCount }}</strong>
        </span>
        
      </div>

      <!-- 题目列表 -->
      <div class="questions-list">
        <template v-if="bankQuestions.length > 0">
          <div v-if="hasBankAndAdhoc" class="section-label">── 已收录题目 ──</div>
          <QuestionCard
            v-for="(q, i) in bankQuestions"
            :key="q.id ?? 'bank-' + i"
            :question="q"
            :index="i"
            :show-difficulty="true"
            @vote-difficulty="(level: number) => handleVoteDifficulty(q, level)"
            @mark-status="(status: 'mastered' | 'review') => handleMarkStatus(q, status)"
          />
        </template>

        <template v-if="adHocQuestions.length > 0">
          <div v-if="hasBankAndAdhoc" class="section-label">── AI 实时生成 ──</div>
          <QuestionCard
            v-for="(q, i) in adHocQuestions"
            :key="'gen-' + i"
            :question="q"
            :index="bankQuestions.length + i"
            :show-difficulty="false"
            @vote-difficulty="() => {}"
            @mark-status="() => {}"
          />
        </template>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import type { QuestionCard as QuestionCardType } from '../types/api'
import { voteDifficulty as apiVoteDifficulty, recordPractice } from '../api/training'
import QuestionCard from '../components/training/QuestionCard.vue'
import AppTopbar from '../components/AppTopbar.vue'

const selectedTopic = ref('')
const selectedDifficulty = ref<number | null>(null)
const selectedCount = ref(10)
const loading = ref(false)
const showTimeoutHint = ref(false)
const error = ref('')

const questions = ref<QuestionCardType[]>([])

const bankQuestions = computed(() =>
  questions.value.filter((q) => q.source_type !== 'ai_adhoc'),
)
const adHocQuestions = computed(() =>
  questions.value.filter((q) => q.source_type === 'ai_adhoc'),
)
const masterCount = computed(() =>
  questions.value.filter((q) => q.userStatus === 'mastered').length,
)
const reviewCount = computed(() =>
  questions.value.filter((q) => q.userStatus === 'review').length,
)
const done = computed(() => questions.value.length > 0 && !loading.value)
const hasBankAndAdhoc = computed(
  () => bankQuestions.value.length > 0 && adHocQuestions.value.length > 0,
)

let timeoutTimer: ReturnType<typeof setTimeout> | null = null

async function startTraining() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  questions.value = []
  showTimeoutHint.value = false

  timeoutTimer = setTimeout(() => {
    showTimeoutHint.value = true
  }, 60_000)

  try {
    const response = await fetch('/api/training/generate/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: selectedTopic.value || undefined,
        count: selectedCount.value,
        difficulty: selectedDifficulty.value ?? undefined,
      }),
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const json = line.slice(6).trim()
        if (json === '[DONE]') continue
        try {
          const data = JSON.parse(json)
          if (data.type === 'bank' && Array.isArray(data.questions)) {
            questions.value.push(...data.questions.map(toCard))
          } else if (data.type === 'question' && data.question) {
            questions.value.push(
              toCard({
                ...data.question,
                id: null,
                source_type: 'ai_adhoc',
                difficulty: null,
              }),
            )
          } else if (data.type === 'error') {
            error.value = data.message
          }
        } catch { /* skip */ }
      }
    }
  } catch (e: any) {
    error.value = e?.message || '出题失败，请稍后重试'
  } finally {
    loading.value = false
    if (timeoutTimer) clearTimeout(timeoutTimer)
  }
}

function toCard(q: any): QuestionCardType {
  return {
    id: q.id ?? null,
    stem: q.stem || '',
    explanation: q.explanation || '',
    difficulty: q.difficulty ?? null,
    difficulty_votes: q.difficulty_votes ?? [],
    source_type: q.source_type || 'ai_adhoc',
    isExpanded: false,
    userStatus: null,
  }
}

async function handleVoteDifficulty(card: QuestionCardType, level: number) {
  if (!card.id) return
  try {
    const res = await apiVoteDifficulty(card.id, level)
    card.difficulty = res.data.difficulty
    if (res.data.locked) card.difficulty_votes = []
  } catch { /* ignore */ }
}

async function handleMarkStatus(card: QuestionCardType, status: 'mastered' | 'review') {
  if (!card.id) return
  card.userStatus = status
  try {
    await recordPractice(card.id, status)
  } catch { card.userStatus = null }
}

onBeforeUnmount(() => {
  if (timeoutTimer) clearTimeout(timeoutTimer)
})
</script>

<style scoped>
.training-page {
  --ink: #2c2418; --parchment: #f5f0e8; --amber: #c4873b;
  --amber-deep: #a06a28; --amber-light: #fef3c7; --border: #e8e2d7; --muted: #9c9488;
  --topbar-h: 64px;
  min-height: 100vh; background: var(--parchment);
  font-family: 'DM Sans', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #1a1815;
}

/* Topbar */
.topbar { position: fixed; top: 0; left: 0; right: 0; height: var(--topbar-h); background: var(--ink); display: flex; align-items: center; padding: 0 32px; z-index: 100; border-bottom: 2px solid var(--amber); }
.logo { font-family: 'Playfair Display', serif; font-size: 1.6rem; font-weight: 700; color: var(--parchment); letter-spacing: 0.04em; margin-right: 48px; text-decoration: none; }
.logo em { color: var(--amber); font-style: italic; }
.top-nav { display: flex; list-style: none; gap: 2px; margin: 0; padding: 0; }
.top-nav a { display: block; padding: 8px 18px; border-radius: 6px; color: #b8ae9e; text-decoration: none; font-size: 0.85rem; font-weight: 500; transition: all 0.2s; }
.top-nav a:hover, .top-nav a.active { color: var(--parchment); background: rgba(196,135,59,0.15); }
.topbar-right { margin-left: auto; display: flex; align-items: center; }

/* Avatar */
.avatar-wrapper { position: relative; z-index: 200; }
.avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #fff; background: linear-gradient(135deg, var(--amber), #92400e); cursor: pointer; }
.avatar-dropdown { position: absolute; top: calc(100% + 8px); right: 0; min-width: 160px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.12); overflow: hidden; }
.dropdown-user { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; }
.dropdown-name { font-size: 0.9rem; font-weight: 600; color: #111827; }
.dropdown-role { font-size: 0.75rem; color: #9ca3af; display: block; }
.dropdown-item { width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 16px; font-size: 0.85rem; color: #6b7280; background: none; border: none; cursor: pointer; font-family: inherit; }
.dropdown-item:hover { background: #fef2f2; color: #dc2626; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }

/* Hamburger */
.hamburger { display: none; flex-direction: column; gap: 4px; background: none; border: none; cursor: pointer; padding: 8px; margin-right: 8px; }
.hamburger span { display: block; width: 22px; height: 2px; background: var(--parchment); border-radius: 1px; }
.mobile-nav-overlay { position: fixed; top: var(--topbar-h); left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.45); z-index: 150; }
.mobile-nav-panel { background: var(--ink); padding: 8px 0; }
.mobile-nav-link { display: block; padding: 14px 32px; color: var(--parchment); text-decoration: none; font-size: 0.95rem; font-weight: 500; }
.mobile-nav-link:hover, .mobile-nav-link.active { background: rgba(196,135,59,0.2); color: var(--amber); }
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.25s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-8px); }

/* Main */
.main { max-width: 780px; margin: 0 auto; padding: calc(var(--topbar-h) + 48px) 24px 100px; }
.page-title { font-family: 'Noto Serif SC', 'Playfair Display', serif; font-size: 1.8rem; font-weight: 900; margin-bottom: 8px; }
.page-subtitle { font-size: 0.9rem; color: var(--muted); margin-bottom: 36px; }

/* Input */
.input-card { background: #fff; border-radius: 16px; padding: 28px 32px; box-shadow: 0 1px 0 var(--border), 0 4px 24px rgba(0,0,0,0.04); margin-bottom: 32px; border: 1px solid var(--border); }
.preset-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.chip { padding: 6px 14px; border-radius: 20px; font-size: 0.78rem; font-weight: 500; border: 1px solid var(--border); background: #fff; color: var(--muted); cursor: pointer; font-family: inherit; transition: all 0.15s; }
.chip:hover { border-color: var(--amber); color: var(--amber-deep); background: var(--amber-light); }
.chip.active { background: var(--amber); color: #fff; border-color: var(--amber); }
.input-row { display: flex; gap: 12px; }
.input-field { flex: 1; padding: 14px 18px; border: 1px solid var(--border); border-radius: 12px; font-size: 0.92rem; font-family: inherit; background: var(--parchment); outline: none; transition: border-color 0.2s; }
.input-field:focus { border-color: var(--amber); box-shadow: 0 0 0 3px rgba(196,135,59,0.1); }
.btn { padding: 10px 22px; border-radius: 10px; font-size: 0.88rem; font-weight: 600; border: none; cursor: pointer; font-family: inherit; transition: all 0.2s; }
.btn-primary { background: linear-gradient(135deg, var(--amber), var(--amber-deep)); color: #fff; box-shadow: 0 2px 8px rgba(180,83,9,0.2); white-space: nowrap; }
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(180,83,9,0.3); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

/* Loading */
.loading-dots { display: flex; align-items: center; gap: 6px; padding: 12px 0; margin-bottom: 32px; }
.loading-dots span { width: 8px; height: 8px; border-radius: 50%; background: var(--amber); animation: bounce 1.2s infinite; }
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-8px); } }

/* Error */
.error-box { padding: 14px 20px; background: #fef2f2; color: #dc2626; border-radius: 10px; font-size: 0.88rem; margin-bottom: 24px; }

/* Filter */
.filter-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.filter-label { width: 60px; font-size: 0.85rem; font-weight: 600; color: #6b7280; flex-shrink: 0; }
.difficulty-options { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.difficulty-btn {
  padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 500;
  border: 1px solid #e8e2d7; background: #fff; color: #6b7280; cursor: pointer;
  font-family: inherit; transition: all 0.15s;
}
.difficulty-btn:hover { border-color: #c4873b; color: #c4873b; }
.difficulty-btn.active { background: #c4873b; color: #fff; border-color: #c4873b; }
.difficulty-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.count-input {
  width: 44px; text-align: center; border-radius: 8px;
  font-size: 0.8rem; font-weight: 500;
  border: 1px solid #e8e2d7; background: #fff; color: #6b7280;
  font-family: inherit; padding: 6px 4px; outline: none;
  -moz-appearance: textfield;
}
.count-input:focus { border-color: #c4873b; }
.count-input::-webkit-outer-spin-button,
.count-input::-webkit-inner-spin-button {
  -webkit-appearance: none; margin: 0;
}
.count-input:disabled { opacity: 0.4; cursor: not-allowed; }
.count-unit { font-size: 0.82rem; color: #6b7280; display: flex; align-items: center; }
.start-btn { margin-top: 8px; width: 100%; }
.timeout-hint {
  margin-top: 10px; padding: 8px 14px; background: #fef3c7; color: #a06a28;
  border-radius: 8px; font-size: 0.82rem;
}
.section-label {
  text-align: center; padding: 16px 0 8px; font-size: 0.82rem;
  color: #9c9488; font-weight: 500; letter-spacing: 0.05em;
}

/* Score Bar */

.score-bar { display: flex; align-items: center; justify-content: space-between; padding: 14px 24px; background: var(--amber-light); border-radius: 12px; margin-bottom: 24px; font-size: 0.88rem; color: var(--amber-deep); font-weight: 600; }

/* Questions */
.questions-list { display: flex; flex-direction: column; gap: 10px; }
.q-card { background: #fff; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; transition: all 0.3s ease; box-shadow: 0 1px 0 var(--border); animation: fadeInUp 0.4s ease backwards; }
.q-card.expanded { border-color: var(--amber); box-shadow: 0 2px 16px rgba(196,135,59,0.1); }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.q-header { display: flex; align-items: center; gap: 16px; padding: 18px 24px; cursor: pointer; user-select: none; transition: background 0.15s; }
.q-header:hover { background: var(--parchment); }
.q-number { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; color: var(--amber-deep); background: var(--amber-light); flex-shrink: 0; }
.q-text { flex: 1; font-size: 0.95rem; font-weight: 500; line-height: 1.5; }
.q-toggle { padding: 8px 16px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; border: 1px solid var(--border); background: #fff; color: var(--amber-deep); cursor: pointer; font-family: inherit; flex-shrink: 0; transition: all 0.2s; display: flex; align-items: center; gap: 6px; }
.q-toggle:hover { background: var(--amber); color: #fff; border-color: var(--amber); }
.q-toggle svg { width: 14px; height: 14px; transition: transform 0.3s; }
.q-card.expanded .q-toggle svg { transform: rotate(180deg); }
.q-answer { max-height: 0; overflow: hidden; transition: max-height 0.4s ease; }
.q-card.expanded .q-answer { max-height: 2000px; }
.q-answer-inner { padding: 0 24px 20px; margin: 0 24px; border-top: 1px solid var(--border); font-size: 0.9rem; line-height: 1.8; color: #374151; }
.q-card.expanded .q-answer-inner { padding-top: 16px; }
.q-answer-inner :deep(p) { margin: 0 0 8px; }
.q-answer-inner :deep(strong) { color: var(--ink); }
.q-answer-inner :deep(code) { background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 3px; font-size: 0.85em; }
.q-answer-inner :deep(pre) { background: #f5f5f5; padding: 12px 16px; border-radius: 8px; overflow-x: auto; }
.q-answer-inner :deep(pre code) { background: none; padding: 0; }

@media (max-width: 900px) {
  .hamburger { display: flex; }
  .top-nav { display: none; }
}
@media (max-width: 640px) {
  .topbar { padding: 0 16px; }
  .logo { font-size: 1.3rem; margin-right: 24px; }
  .main { padding: calc(var(--topbar-h) + 32px) 16px 60px; }
  .page-title { font-size: 1.4rem; }
  .input-row { flex-direction: column; }
  .input-card { padding: 20px; }
  .q-header { padding: 14px 18px; gap: 12px; }
  .q-number { width: 32px; height: 32px; font-size: 0.78rem; }
  .q-text { font-size: 0.88rem; }
}
</style>
