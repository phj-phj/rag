<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center gap-3">
            <h1 class="text-xl font-bold text-gray-900">
              Pap<span class="text-amber-600">ier</span>
            </h1>
            <span class="text-sm text-gray-400">|</span>
            <span class="text-sm text-gray-600">后台管理</span>
          </div>
          <nav class="flex items-center gap-1">
            <router-link
              to="/"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              文档库
            </router-link>
            <router-link
              to="/admin"
              class="px-4 py-2 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg"
            >
              数据概览
            </router-link>
            <router-link
              to="/admin/docs"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              文档管理
            </router-link>
            <router-link
              to="/admin/questions"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              题库管理
            </router-link>
            <router-link
              to="/admin/users"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              用户管理
            </router-link>
            <router-link
              to="/"
              class="ml-4 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
            >
              返回前台
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
          </nav>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-900">
          数据概览
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          文档库整体数据与分类统计
        </p>
      </div>

      <StatsCards
        v-if="adminStore.stats"
        :stats="statsCards"
        :loading="adminStore.loading"
      />

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart
          :categories="adminStore.stats?.categoryStats || []"
        />
        <UploadTrend
          :dates="uploadTrendDates"
          :values="uploadTrendValues"
        />
      </div>

      <div class="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          最近活动
        </h3>
        <div class="space-y-4">
          <div
            v-for="activity in recentActivities"
            :key="activity.id"
            class="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
              :style="{ background: activity.avatarBg }"
            >
              {{ activity.user[0] }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-900">
                <span class="font-medium">{{ activity.user }}</span>
                {{ activity.action }}
                <span class="font-medium text-amber-700">{{ activity.target }}</span>
              </p>
              <p class="text-xs text-gray-400 mt-0.5">
                {{ activity.time }}
              </p>
            </div>
            <span
              class="inline-flex items-center px-2 py-1 rounded text-xs font-medium flex-shrink-0"
              :class="activity.tagClass"
            >
              {{ activity.tag }}
            </span>
          </div>
          <p
            v-if="recentActivities.length === 0"
            class="text-gray-400 text-sm"
          >
            暂无活动
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStore } from '../stores/admin'
import { useAuthStore } from '../stores/auth'
import StatsCards from '../components/StatsCards.vue'
import CategoryChart from '../components/CategoryChart.vue'
import UploadTrend from '../components/UploadTrend.vue'

const router = useRouter()
const adminStore = useAdminStore()
const authStore = useAuthStore()
const showLogout = ref(false)

const statsCards = computed(() => {
  if (!adminStore.stats) return []
  return [
    { label: '文档总数', value: adminStore.stats.totalDocs, icon: '📄' },
    { label: '分类数量', value: adminStore.stats.totalCategories, icon: '📂' },
    { label: '用户数量', value: adminStore.stats.totalUsers, icon: '👥' },
    { label: '系统运行', value: '正常', icon: '✅' },
  ]
})

const uploadTrendDates = computed(() => {
  if (!adminStore.stats?.uploadTrend) return []
  return adminStore.stats.uploadTrend.map((d) => d.date)
})

const uploadTrendValues = computed(() => {
  if (!adminStore.stats?.uploadTrend) return []
  return adminStore.stats.uploadTrend.map((d) => d.count)
})

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #7a3b3b, #a06a28)',
  'linear-gradient(135deg, #6b7c5e, #4a6741)',
  'linear-gradient(135deg, #c4873b, #8b5e34)',
  'linear-gradient(135deg, #2c2418, #5a4d3a)',
  'linear-gradient(135deg, #6b8db5, #4a6b8a)',
  'linear-gradient(135deg, #8b6b4a, #5a7a5a)',
  'linear-gradient(135deg, #3b6b5a, #2a4a3a)',
  'linear-gradient(135deg, #7a5a8b, #4a3a6b)',
]

const TAG_STYLES: Record<string, string> = {
  pdf: 'bg-red-50 text-red-700',
  doc: 'bg-green-50 text-green-700',
  docx: 'bg-green-50 text-green-700',
  txt: 'bg-blue-50 text-blue-700',
  png: 'bg-purple-50 text-purple-700',
  jpg: 'bg-purple-50 text-purple-700',
  jpeg: 'bg-purple-50 text-purple-700',
  gif: 'bg-purple-50 text-purple-700',
}

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

interface Activity {
  id: number
  user: string
  action: string
  target: string
  time: string
  tag: string
  tagClass: string
  avatarBg: string
}

const recentActivities = computed<Activity[]>(() => {
  if (!adminStore.stats?.recentActivities) return []
  return adminStore.stats.recentActivities.map((item) => {
    const fileType = (item.file_type || '').toLowerCase()
    const tag = fileType.toUpperCase() || 'FILE'
    const tagClass = TAG_STYLES[fileType] || 'bg-gray-100 text-gray-700'
    const avatarIdx = hashName(item.uploader || '未知') % AVATAR_GRADIENTS.length
    return {
      id: item.id,
      user: item.uploader || '未知用户',
      action: '上传了文档',
      target: item.title,
      time: formatRelativeTime(item.created_at),
      tag,
      tagClass,
      avatarBg: AVATAR_GRADIENTS[avatarIdx],
    }
  })
})

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return ''
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return new Date(dateStr).toLocaleDateString('zh-CN')
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
  adminStore.fetchStats()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onClickOutside)
})
</script>

<style scoped>
.avatar-wrapper {
  position: relative;
  z-index: 100;
  margin-left: 4px;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--amber, #c4873b), var(--burgundy, #7a3b3b));
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  font-size: 0.8rem;
  cursor: pointer;
  transition: transform 0.2s;
}

.avatar:hover { transform: scale(1.08); }

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

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
