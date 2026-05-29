<template>
  <div class="training-page">
    <!-- Top Bar -->
    <header class="topbar">
      <router-link to="/" class="logo">Pap<em>ier</em></router-link>
      <button class="hamburger" @click="showMobileNav = !showMobileNav">
        <span /><span /><span />
      </button>
      <ul class="top-nav">
        <li><router-link to="/">文档库</router-link></li>
        <li><router-link to="/chat">AI 助手</router-link></li>
        <li><router-link to="/recent">最近</router-link></li>
        <li><router-link to="/training" class="active">每日训练</router-link></li>
      </ul>
      <div class="topbar-right">
        <div v-if="authStore.user" class="avatar-wrapper" @click.stop="showLogout = !showLogout">
          <div class="avatar">{{ authStore.user.username[0].toUpperCase() }}</div>
          <Transition name="fade">
            <div v-if="showLogout" class="avatar-dropdown">
              <div class="dropdown-user">
                <span class="dropdown-name">{{ authStore.user.username }}</span>
                <span class="dropdown-role">{{ authStore.isAdmin ? '管理员' : '用户' }}</span>
              </div>
              <button class="dropdown-item" @click="handleLogout">退出登录</button>
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- Mobile Nav -->
    <Transition name="slide-down">
      <div v-if="showMobileNav" class="mobile-nav-overlay" @click="showMobileNav = false">
        <nav class="mobile-nav-panel" @click.stop>
          <router-link to="/" class="mobile-nav-link" @click="showMobileNav = false">文档库</router-link>
          <router-link to="/chat" class="mobile-nav-link" @click="showMobileNav = false">AI 助手</router-link>
          <router-link to="/recent" class="mobile-nav-link" @click="showMobileNav = false">最近</router-link>
          <router-link to="/training" class="mobile-nav-link active" @click="showMobileNav = false">每日训练</router-link>
        </nav>
      </div>
    </Transition>

    <!-- Main -->
    <main class="main">
      <h1 class="page-title">每日训练</h1>
      <p class="page-subtitle">AI 根据文档库内容出题，每日精进你的技术能力</p>

      <!-- Input Card -->
      <div class="input-card">
        <div class="preset-chips">
          <button
            v-for="p in presets"
            :key="p"
            :class="['chip', { active: selectedPreset === p }]"
            @click="selectPreset(p)"
          >
            {{ p }}
          </button>
        </div>
        <div class="input-row">
          <input
            v-model="input"
            class="input-field"
            type="text"
            placeholder="给我出5道和Vue相关的面试题..."
            :disabled="loading"
            @keydown.enter="generate"
          >
          <button
            class="btn btn-primary"
            :disabled="!input.trim() || loading"
            @click="generate"
          >
            {{ loading ? '出题中...' : '开始出题' }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-dots">
        <span /><span /><span />
      </div>

      <!-- Error -->
      <div v-if="error" class="error-box">
        {{ error }}
      </div>

      <!-- Score Bar -->
      <div v-if="questions.length > 0" class="score-bar">
        <span>共 <strong>{{ questions.length }}</strong> 道题目</span>
        <span>已答 <strong>{{ answeredCount }}</strong> / {{ questions.length }}</span>
      </div>

      <!-- Questions -->
      <div class="questions-list">
        <div
          v-for="(item, idx) in questions"
          :key="idx"
          :class="['q-card', { expanded: expanded.has(idx) }]"
          :style="{ animationDelay: idx * 0.06 + 's' }"
        >
          <div class="q-header" @click="toggle(idx)">
            <div class="q-number">{{ String(idx + 1).padStart(2, '0') }}</div>
            <div class="q-text">{{ item.q }}</div>
            <button class="q-toggle" @click.stop="toggle(idx)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                <polyline :points="expanded.has(idx) ? '6 15 12 9 18 15' : '6 9 12 15 18 9'" />
              </svg>
              {{ expanded.has(idx) ? '收起答案' : '显示答案' }}
            </button>
          </div>
          <div class="q-answer">
            <div class="q-answer-inner" v-html="renderMarkdown(item.a)" />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { marked } from 'marked'
import { trainStream } from '../api/chat'

const router = useRouter()
const authStore = useAuthStore()

const presets = ['Vue', 'JavaScript', 'Node.js', 'React', 'TypeScript', 'CSS', 'Webpack']
const input = ref('')
const selectedPreset = ref('')
const loading = ref(false)
const error = ref('')
const questions = ref<Array<{ q: string; a: string }>>([])
const expanded = ref(new Set<number>())
const showLogout = ref(false)
const showMobileNav = ref(false)

// 调试信息
const showDebug = ref(false)
const debugRetrievalMs = ref(0)
const debugTtfbMs = ref(0)
const debugLlmMs = ref(0)
const debugModel = ref('')
const debugMaxTokens = ref(0)
const debugChunks = ref<Array<{ title: string; score: number; preview: string }>>([])
const questionElapsed = ref<number[]>([])

const answeredCount = computed(() => expanded.value.size)

function selectPreset(p: string) {
  selectedPreset.value = p
  input.value = `给我出5道和${p}相关的面试题`
}

function toggle(idx: number) {
  const s = new Set(expanded.value)
  if (s.has(idx)) s.delete(idx); else s.add(idx)
  expanded.value = s
}

function renderMarkdown(text: string): string {
  if (!text) return ''
  return marked.parse(text, { async: false }) as string
}

async function generate() {
  const q = input.value.trim()
  if (!q || loading.value) return

  loading.value = true
  error.value = ''
  questions.value = []
  expanded.value = new Set()
  questionElapsed.value = []
  try {
    console.log('[train-stream] 开始请求:', q)
    const body = await trainStream(q)
    const reader = body.getReader()
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
        try {
          const data = JSON.parse(json)
          if (data.type === 'diagnostics') {
            if (data.phase === 'retrieval') {
              console.log('[train] 🔍 检索:', data.retrievalMs + 'ms, 模型:', data.model, 'maxTokens:', data.maxTokens, 'chunks:', data.chunkCount)
            } else if (data.phase === 'llm') {
              console.log('[train] 🤖 LLM: TTFB=' + data.ttfbMs + 'ms 总=' + data.llmMs + 'ms chunks=' + data.totalChunks)
            }
          } else if (data.type === 'question') {
            questions.value.push(data.question)
            if (data.elapsedMs) console.log('[train] 📝 题目' + (questions.value.length) + ' (' + data.elapsedMs + 'ms):', data.question.q.slice(0, 50))
            loading.value = false
          } else if (data.type === 'done') {
            console.log('[train] ✅ 完成:', data.total, '道题')
          } else if (data.type === 'error') {
            error.value = data.message
          }
        } catch { /* skip */ }
      }
    }
  } catch (e: unknown) {
    console.error('[train-stream] 错误:', e)
    const err = e as { message?: string }
    error.value = err?.message || '出题失败，请稍后重试'
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
  if (!(e.target as HTMLElement).closest('.avatar-wrapper')) showLogout.value = false
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
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
