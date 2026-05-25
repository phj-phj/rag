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
            :href="downloadUrl"
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

    <DocumentReader
      :doc-id="Number(route.params.id)"
      @loaded="onDocLoaded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import DocumentReader from '../components/DocumentReader.vue'
import type { DocItem } from '../types/api'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const doc = ref<DocItem | null>(null)
const downloadUrl = ref('')
const showLogout = ref(false)

function onDocLoaded(d: DocItem, url: string) {
  doc.value = d
  downloadUrl.value = url
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

/* ── Responsive ── */
@media (max-width: 768px) {
  .topbar-inner {
    padding: 0 20px;
  }
}

@media (max-width: 640px) {
  .topbar-inner { padding: 0 14px; height: 48px; }
  .btn-ghost { padding: 6px 12px; font-size: 0.75rem; }
  .logo { font-size: 1.1rem; }
}
</style>
