<template>
  <div
    class="chat-page"
    :class="{ 'split-mode': splitDocId }"
  >
    <AppTopbar activeRoute="chat" />

    <!-- MAIN -->
    <main class="main">
      <!-- Left Panel: Chat -->
      <div class="chat-panel">
        <div class="chat-container">
          <div class="chat-header">
            <h1>AI 文档助手</h1>
          </div>

          <div
            ref="msgList"
            class="chat-messages"
          >
            <div
              v-if="messages.length === 0"
              class="chat-empty"
            >
              <p>向我提问，我会基于已上传的文档为你解答</p>
            </div>
            <div
              v-for="(msg, idx) in messages"
              :key="idx"
              :class="['chat-bubble', msg.role]"
            >
              <div
                class="bubble-content"
                v-html="renderContent(msg)"
              />
              <button
                v-for="doc in msg.docs"
                :key="doc.id"
                class="doc-source-link"
                @click="openDoc(doc.id, doc.title)"
              >
                来源：{{ doc.title }}
              </button>
            </div>
            <div
              v-if="loading"
              class="chat-bubble assistant"
            >
              <div class="bubble-content typing">
                <span /><span /><span />
              </div>
            </div>
          </div>

          <div class="chat-input-area">
            <button
              class="thinking-toggle"
              :class="{ active: thinking }"
              :title="thinking ? '深度思考已开启' : '深度思考已关闭'"
              @click="thinking = !thinking"
            >🧠</button>
            <input
              v-model="question"
              class="chat-input"
              type="text"
              placeholder="输入问题，基于文档内容回答..."
              :disabled="loading"
              @keydown.enter="handleAsk"
            >
            <button
              class="chat-send"
              :disabled="!question.trim() || loading"
              @click="handleAsk"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              ><line
                x1="22"
                y1="2"
                x2="11"
                y2="13"
              /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Right Panel: Document -->
      <div
        v-if="splitDocId"
        class="doc-panel"
      >
        <div class="doc-panel-header">
          <span class="doc-panel-title">{{ splitDocTitle }}</span>
          <div class="doc-panel-actions">
            <router-link
              :to="`/docs/${splitDocId}`"
              class="doc-panel-open"
              title="在文档库中打开"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              ><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line
                x1="10"
                y1="14"
                x2="21"
                y2="3"
              /></svg>
            </router-link>
            <button
              class="doc-panel-close"
              @click="closeDoc"
            >
              ✕
            </button>
          </div>
        </div>
        <DocumentReader
          :doc-id="splitDocId"
          :embedded="true"
        />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import AppTopbar from '../components/AppTopbar.vue'
import { useAuthStore } from '../stores/auth'
import { askStream } from '../api/chat'
import { marked } from 'marked'
import DocumentReader from '../components/DocumentReader.vue'
import type { ChatMessage } from '../types/api'

const router = useRouter()
const authStore = useAuthStore()

const question = ref('')
const messages = ref<ChatMessage[]>([])
const loading = ref(false)
const thinking = ref(false)
const showLogout = ref(false)
const showMobileNav = ref(false)
const msgList = ref<HTMLElement | null>(null)
const splitDocId = ref<number | null>(null)
const splitDocTitle = ref('')

function renderContent(msg: ChatMessage): string {
  if (msg.role === 'assistant') {
    return marked.parse(msg.content, { async: false }) as string
  }
  return msg.content
}

function openDoc(docId: number, docTitle: string) {
  splitDocId.value = docId
  splitDocTitle.value = docTitle
}

function closeDoc() {
  splitDocId.value = null
  splitDocTitle.value = ''
}

async function handleAsk() {
  const q = question.value.trim()
  if (!q || loading.value) return

  messages.value.push({ role: 'user', content: q })
  question.value = ''
  loading.value = true
  await nextTick()
  scrollToBottom()

  // AI 消息在收到第一个 token 时才创建，之前只显示加载动画
  let aiMsg: ChatMessage | null = null
  let pendingDocs: { id: number; title: string }[] | null = null

  try {
    console.log('[stream] 开始请求:', q)
    const body = await askStream(q, thinking.value).catch((e: Error) => {
      throw new Error(`连接失败: ${e.message}`)
    })

    const reader = body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read().catch((e: Error) => {
        throw new Error(`读取响应流失败: ${e.message}`)
      })
      if (done) {
        console.log('[stream] 流结束')
        break
      }

      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const json = line.slice(6).trim()
        if (json === '[DONE]') {
          console.log('[stream] 收到 [DONE]')
          continue
        }
        try {
          const data = JSON.parse(json)
          if (data.type === 'docs') {
            pendingDocs = data.docs
            console.log('[stream] 来源文档:', data.docs.length, '个')
          } else if (data.type === 'token') {
            if (!aiMsg) {
              // 第一个 token → 创建消息气泡，补上暂存的 docs
              loading.value = false
              messages.value.push({
                role: 'assistant',
                content: '',
                docs: pendingDocs || undefined,
              })
              aiMsg = messages.value[messages.value.length - 1]
              await nextTick()
            }
            aiMsg.content += data.content
            scrollToBottom()
          } else if (data.type === 'error') {
            if (!aiMsg) {
              loading.value = false
              messages.value.push({ role: 'assistant', content: '' })
              aiMsg = messages.value[messages.value.length - 1]
            }
            aiMsg.content = `❌ ${data.message}`
            console.error('[stream] 服务端错误:', data.message)
          }
        } catch {
          console.warn('[stream] JSON 解析失败:', json.slice(0, 100))
        }
      }
    }

    if (!aiMsg) {
      loading.value = false
      messages.value.push({ role: 'assistant', content: '（AI 未返回内容，请重试）' })
      console.warn('[stream] 未收到任何 token')
    }
  } catch (e) {
    loading.value = false
    const errMsg = (e as Error).message || String(e)
    messages.value.push({ role: 'assistant', content: `❌ 请求失败: ${errMsg}` })
    console.error('[stream] 异常:', errMsg, e)
  } finally {
    loading.value = false
  }
}

function scrollToBottom() {
  if (msgList.value) {
    msgList.value.scrollTop = msgList.value.scrollHeight
  }
}

function handleLogout() {
  showLogout.value = false
  authStore.logout()
  router.push('/login')
}

function onClickOutside(e: MouseEvent) {
  if (!(e.target as HTMLElement).closest('.avatar-wrapper')) {
    showLogout.value = false
  }
}

onMounted(() => document.addEventListener('click', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', onClickOutside))
</script>

<style scoped>
.chat-page {
  --ink: #2c2418;
  --parchment: #f5f0e8;
  --amber: #c4873b;
  --amber-deep: #a06a28;
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
}
.logo em { color: var(--amber); font-style: italic; }
.top-nav { display: flex; list-style: none; gap: 2px; margin: 0; padding: 0; }
.top-nav a {
  display: block;
  padding: 8px 18px;
  border-radius: 6px;
  color: #b8ae9e;
  text-decoration: none;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.2s;
}
.top-nav a:hover,
.top-nav a.active { color: var(--parchment); background: rgba(196,135,59,0.15); }
.topbar-right { display: flex; align-items: center; margin-left: auto; }

/* ── Avatar ── */
.avatar-wrapper { position: relative; z-index: 200; }
.avatar {
  width: 34px; height: 34px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700; color: #fff;
  background: linear-gradient(135deg, var(--amber), #92400e);
  cursor: pointer;
}
.avatar-dropdown {
  position: absolute; top: calc(100% + 8px); right: 0;
  min-width: 160px;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.12); overflow: hidden;
}
.dropdown-user { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; }
.dropdown-name { font-size: 0.9rem; font-weight: 600; color: #111827; }
.dropdown-role { font-size: 0.75rem; color: #9ca3af; display: block; }
.dropdown-item {
  width: 100%; display: flex; align-items: center; gap: 8px;
  padding: 10px 16px; font-size: 0.85rem; color: #6b7280;
  background: none; border: none; cursor: pointer; font-family: inherit;
}
.dropdown-item:hover { background: #fef2f2; color: #dc2626; }
.fade-enter-active,
.fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; transform: translateY(-4px); }

/* ── Main Layout ── */
.main {
  display: flex;
  height: calc(100vh - var(--topbar-h));
  margin-top: var(--topbar-h);
}
.chat-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
}
.split-mode .chat-panel {
  flex: 0 0 50%;
  border-right: 1px solid #e8e2d7;
}
.doc-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  overflow-y: auto;
}
.doc-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #e8e2d7;
  flex-shrink: 0;
}
.doc-panel-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.doc-panel-open {
  width: 28px; height: 28px;
  border-radius: 6px;
  border: 1px solid #e8e2d7;
  background: none;
  cursor: pointer;
  color: #9c9488;
  display: flex; align-items: center; justify-content: center;
  text-decoration: none;
}
.doc-panel-open:hover { background: #f0ece4; color: #d97706; border-color: #d97706; }
.doc-panel-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1a1815;
}
.doc-panel-close {
  width: 28px; height: 28px;
  border-radius: 6px;
  border: 1px solid #e8e2d7;
  background: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: #9c9488;
  display: flex; align-items: center; justify-content: center;
}
.doc-panel-close:hover { background: #fef2f2; color: #dc2626; }

/* ── Chat Container ── */
.chat-container {
  width: 100%;
  max-width: 680px;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 20px;
}
.chat-header {
  padding: 24px 0 12px;
  text-align: center;
  flex-shrink: 0;
}
.chat-header h1 {
  font-family: 'Noto Serif SC', 'Playfair Display', serif;
  font-size: 1.5rem;
  font-weight: 900;
  color: #1a1815;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0 16px;
}
.chat-empty {
  flex: 1;
  display: flex; align-items: center; justify-content: center;
  color: #9c9488;
  font-size: 0.9rem;
}
.chat-bubble {
  max-width: 88%;
  display: flex;
  flex-direction: column;
}
.chat-bubble.user { align-self: flex-end; }
.chat-bubble.assistant { align-self: flex-start; }
.bubble-content {
  padding: 12px 18px;
  border-radius: 14px;
  font-size: 0.9rem;
  line-height: 1.7;
}
.bubble-content :deep(p) { margin: 0 0 6px; }
.bubble-content :deep(p:last-child) { margin-bottom: 0; }
.bubble-content :deep(ul),
.bubble-content :deep(ol) { margin: 4px 0; padding-left: 18px; }
.bubble-content :deep(code) {
  background: rgba(0,0,0,0.06);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 0.85em;
}
.chat-bubble.user .bubble-content {
  background: var(--amber);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.chat-bubble.assistant .bubble-content {
  background: #fff;
  color: #1a1815;
  border: 1px solid #e8e2d7;
  border-bottom-left-radius: 4px;
}

.doc-source-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  margin-left: 2px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #e8e2d7;
  background: #faf7f2;
  color: var(--amber-deep);
  font-size: 0.78rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
}
.doc-source-link:hover {
  background: var(--amber);
  color: #fff;
  border-color: var(--amber);
}

/* ── Typing ── */
.typing {
  display: flex; align-items: center; gap: 4px;
  padding: 16px 20px;
}
.typing span {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #c4873b;
  animation: bounce 1.2s infinite;
}
.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-6px); }
}

/* ── Input ── */
.chat-input-area {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 0 20px;
  flex-shrink: 0;
}
.thinking-toggle {
  width: 38px; height: 38px;
  border: 1px solid #e8e2d7;
  border-radius: 10px;
  background: #fff;
  font-size: 1.1rem;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}
.thinking-toggle:hover { background: #faf7f2; }
.thinking-toggle.active {
  background: var(--amber, #d97706); border-color: var(--amber, #d97706);
}
.chat-input {
  flex: 1;
  padding: 12px 18px;
  border: 1px solid #e8e2d7;
  border-radius: 12px;
  font-size: 0.9rem;
  font-family: inherit;
  background: #fff;
  outline: none;
}
.chat-input:focus { border-color: var(--amber); }
.chat-input:disabled { background: #f5f0e8; }
.chat-send {
  width: 44px; height: 44px;
  border-radius: 12px;
  border: none;
  background: var(--amber);
  color: #fff;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.chat-send:hover { background: var(--amber-deep); }
.chat-send:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Hamburger ── */
.hamburger {
  display: none; flex-direction: column; gap: 4px;
  background: none; border: none; cursor: pointer; padding: 8px; margin-right: 8px;
}
.hamburger span { display: block; width: 22px; height: 2px; background: var(--parchment); border-radius: 1px; }

/* ── Mobile Nav ── */
.mobile-nav-overlay {
  position: fixed; top: var(--topbar-h); left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.45); z-index: 150;
}
.mobile-nav-panel { background: var(--ink); padding: 8px 0; }
.mobile-nav-link {
  display: block; padding: 14px 32px; color: var(--parchment); text-decoration: none;
  font-size: 0.95rem; font-weight: 500; transition: background 0.15s;
}
.mobile-nav-link:hover,
.mobile-nav-link.active { background: rgba(196,135,59,0.2); color: var(--amber); }

.slide-down-enter-active,
.slide-down-leave-active { transition: all 0.25s ease; }
.slide-down-enter-from,
.slide-down-leave-to { opacity: 0; transform: translateY(-8px); }

@media (max-width: 900px) {
  .hamburger { display: flex; }
  .top-nav { display: none; }
}

@media (max-width: 768px) {
  .split-mode .chat-panel { flex: 0 0 40%; }
  .chat-container { padding: 0 12px; }
  .chat-header h1 { font-size: 1.2rem; }
}
@media (max-width: 640px) {
  .topbar { padding: 0 16px; }
  .logo { font-size: 1.3rem; margin-right: 24px; }
  .split-mode .chat-panel { flex: 1; }
  .split-mode .doc-panel { display: none; }
}
</style>
