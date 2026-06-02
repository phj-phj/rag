<template>
  <div :class="['q-card', { expanded: question.isExpanded }]">
    <div class="q-header" @click="toggle">
      <div class="q-number">{{ pad(index + 1) }}</div>
      <div class="q-text">{{ question.stem }}</div>
      <button class="q-toggle" @click.stop="toggle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <polyline v-if="question.isExpanded" points="6 15 12 9 18 15" />
          <polyline v-else points="6 9 12 15 18 9" />
        </svg>
        {{ question.isExpanded ? '收起答案' : '显示答案' }}
      </button>
    </div>

    <div class="q-answer">
      <div class="q-answer-inner" v-html="renderMarkdown(question.explanation)" />
    </div>

    <!-- 难度投票（仅已收录题） -->
    <div v-if="showDifficulty && !difficultyLocked" class="q-difficulty">
      <span class="difficulty-label">难度：</span>
      <button
        v-for="l in 5"
        :key="l"
        :class="['star', { active: votedLevel === l }]"
        @click.stop="handleVote(l)"
      >
        {{ l }}
      </button>
    </div>
    <div v-else-if="showDifficulty && difficultyLocked" class="q-difficulty locked">
      难度已确认：{{ question.difficulty }} 星
    </div>

    <!-- 已掌握/需复习（仅已收录题） -->
    <div v-if="question.id != null" class="q-actions">
      <button
        :class="['action-btn', { active: question.userStatus === 'mastered' }]"
        @click.stop="handleMark('mastered')"
      >
        已掌握
      </button>
      <button
        :class="['action-btn review', { active: question.userStatus === 'review' }]"
        @click.stop="handleMark('review')"
      >
        需复习
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { marked } from 'marked'
import type { QuestionCard as QuestionCardType } from '../../types/api'

const props = defineProps<{
  question: QuestionCardType
  index: number
  showDifficulty: boolean
}>()

const emit = defineEmits<{
  (e: 'vote-difficulty', level: number): void
  (e: 'mark-status', status: 'mastered' | 'review'): void
}>()

const votedLevel = ref<number | null>(null)

const difficultyLocked = computed(() => {
  const dv = props.question.difficulty_votes
  return (
    props.question.difficulty != null &&
    Array.isArray(dv) &&
    dv.length === 0
  )
})

function toggle() {
  props.question.isExpanded = !props.question.isExpanded
}

function handleVote(level: number) {
  votedLevel.value = level
  emit('vote-difficulty', level)
}

function handleMark(status: 'mastered' | 'review') {
  emit('mark-status', status)
}

function renderMarkdown(text: string): string {
  if (!text) return ''
  return marked.parse(text, { async: false }) as string
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}
</script>

<style scoped>
.q-card {
  background: #fff;
  border: 1px solid #e8e2d7;
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.3s ease;
  box-shadow: 0 1px 0 #e8e2d7;
  animation: fadeInUp 0.4s ease backwards;
}
.q-card.expanded { border-color: #c4873b; box-shadow: 0 2px 16px rgba(196,135,59,0.1); }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
.q-header {
  display: flex; align-items: center; gap: 16px; padding: 18px 24px;
  cursor: pointer; user-select: none; transition: background 0.15s;
}
.q-header:hover { background: #f5f0e8; }
.q-number {
  width: 36px; height: 36px; border-radius: 10px; display: flex;
  align-items: center; justify-content: center; font-size: 0.85rem;
  font-weight: 700; color: #a06a28; background: #fef3c7; flex-shrink: 0;
}
.q-text { flex: 1; font-size: 0.95rem; font-weight: 500; line-height: 1.5; }
.q-toggle {
  padding: 8px 16px; border-radius: 8px; font-size: 0.8rem; font-weight: 600;
  border: 1px solid #e8e2d7; background: #fff; color: #a06a28; cursor: pointer;
  font-family: inherit; flex-shrink: 0; transition: all 0.2s;
  display: flex; align-items: center; gap: 6px;
}
.q-toggle:hover { background: #c4873b; color: #fff; border-color: #c4873b; }
.q-toggle svg { width: 14px; height: 14px; transition: transform 0.3s; }
.q-card.expanded .q-toggle svg { transform: rotate(180deg); }
.q-answer { max-height: 0; overflow: hidden; transition: max-height 0.4s ease; }
.q-card.expanded .q-answer { max-height: 2000px; }
.q-answer-inner {
  padding: 0 24px 20px; margin: 0 24px; border-top: 1px solid #e8e2d7;
  font-size: 0.9rem; line-height: 1.8; color: #374151;
}
.q-card.expanded .q-answer-inner { padding-top: 16px; }
.q-answer-inner :deep(p) { margin: 0 0 8px; }
.q-answer-inner :deep(strong) { color: #2c2418; font-weight: 700; }
.q-answer-inner :deep(em) { font-style: italic; }
.q-answer-inner :deep(code) { background: rgba(0,0,0,0.06); padding: 1px 5px; border-radius: 3px; font-size: 0.85em; }
.q-answer-inner :deep(pre) { background: #f5f5f5; padding: 12px 16px; border-radius: 8px; overflow-x: auto; }
.q-answer-inner :deep(pre code) { background: none; padding: 0; }
.q-answer-inner :deep(ul), .q-answer-inner :deep(ol) { margin: 0 0 8px; padding-left: 20px; }
.q-answer-inner :deep(li) { margin-bottom: 4px; }
.q-answer-inner :deep(h1), .q-answer-inner :deep(h2), .q-answer-inner :deep(h3) { margin: 12px 0 8px; font-weight: 700; color: #2c2418; }
.q-answer-inner :deep(h3) { font-size: 1rem; }

.q-difficulty {
  display: flex; align-items: center; gap: 4px;
  padding: 0 24px 12px; font-size: 0.82rem;
}
.q-difficulty.locked { color: #9c9488; }
.difficulty-label { color: #9c9488; margin-right: 4px; }
.star {
  width: 28px; height: 28px; border-radius: 6px; border: 1px solid #e8e2d7;
  background: #fff; cursor: pointer; font-size: 0.78rem; font-weight: 600;
  color: #9c9488; transition: all 0.15s; display: flex;
  align-items: center; justify-content: center;
}
.star:hover { border-color: #c4873b; color: #c4873b; }
.star.active { background: #c4873b; color: #fff; border-color: #c4873b; }

.q-actions {
  display: flex; gap: 8px; padding: 0 24px 16px;
}
.action-btn {
  padding: 8px 18px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
  border: 1px solid #e8e2d7; background: #fff; cursor: pointer;
  font-family: inherit; transition: all 0.15s; color: #6b7280;
}
.action-btn:hover { border-color: #10b981; color: #10b981; }
.action-btn.active { background: #ecfdf5; border-color: #10b981; color: #059669; }
.action-btn.review:hover { border-color: #f59e0b; color: #f59e0b; }
.action-btn.review.active { background: #fffbeb; border-color: #f59e0b; color: #d97706; }
</style>
