<template>
  <!-- Top Bar -->
  <header class="topbar">
    <router-link to="/" class="logo">Pap<em>ier</em></router-link>
    <button class="hamburger" @click="showMobileNav = !showMobileNav">
      <span /><span /><span />
    </button>
    <ul class="top-nav">
      <li><router-link to="/" :class="{ active: activeRoute === 'home' }">文档库</router-link></li>
      <li><router-link to="/chat" :class="{ active: activeRoute === 'chat' }">AI 助手</router-link></li>
      <li><router-link to="/recent" :class="{ active: activeRoute === 'recent' }">最近</router-link></li>
      <li><router-link to="/training" :class="{ active: activeRoute === 'training' }">每日训练</router-link></li>
      <li><router-link to="/collected" :class="{ active: activeRoute === 'collected' }">已收录</router-link></li>
    </ul>
    <div class="topbar-right">
      <slot name="controls" />
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
        <router-link to="/" class="mobile-nav-link" :class="{ active: activeRoute === 'home' }" @click="showMobileNav = false">文档库</router-link>
        <router-link to="/chat" class="mobile-nav-link" :class="{ active: activeRoute === 'chat' }" @click="showMobileNav = false">AI 助手</router-link>
        <router-link to="/recent" class="mobile-nav-link" :class="{ active: activeRoute === 'recent' }" @click="showMobileNav = false">最近</router-link>
        <router-link to="/training" class="mobile-nav-link" :class="{ active: activeRoute === 'training' }" @click="showMobileNav = false">每日训练</router-link>
        <router-link to="/collected" class="mobile-nav-link" :class="{ active: activeRoute === 'collected' }" @click="showMobileNav = false">已收录</router-link>
      </nav>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

defineProps<{ activeRoute: string }>()

const router = useRouter()
const authStore = useAuthStore()
const showLogout = ref(false)
const showMobileNav = ref(false)

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
.topbar { position: fixed; top: 0; left: 0; right: 0; height: 64px; background: var(--ink, #2c2418); display: flex; align-items: center; padding: 0 32px; z-index: 100; border-bottom: 2px solid var(--amber, #c4873b); }
.logo { font-family: 'Playfair Display', serif; font-size: 1.6rem; font-weight: 700; color: var(--parchment, #f5f0e8); letter-spacing: 0.04em; margin-right: 48px; text-decoration: none; }
.logo em { color: var(--amber, #c4873b); font-style: italic; }
.top-nav { display: flex; list-style: none; gap: 2px; margin: 0; padding: 0; }
.top-nav a { display: block; padding: 8px 18px; border-radius: 6px; color: #b8ae9e; text-decoration: none; font-size: 0.85rem; font-weight: 500; transition: all 0.2s; }
.top-nav a:hover, .top-nav a.active { color: var(--parchment, #f5f0e8); background: rgba(196,135,59,0.15); }
.topbar-right { margin-left: auto; display: flex; align-items: center; }

.hamburger { display: none; flex-direction: column; gap: 4px; background: none; border: none; cursor: pointer; padding: 8px; margin-right: 8px; }
.hamburger span { display: block; width: 22px; height: 2px; background: var(--parchment, #f5f0e8); border-radius: 1px; }
.mobile-nav-overlay { position: fixed; top: 64px; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.45); z-index: 150; }
.mobile-nav-panel { background: var(--ink, #2c2418); padding: 8px 0; }
.mobile-nav-link { display: block; padding: 14px 32px; color: var(--parchment, #f5f0e8); text-decoration: none; font-size: 0.95rem; font-weight: 500; }
.mobile-nav-link:hover, .mobile-nav-link.active { background: rgba(196,135,59,0.2); color: var(--amber, #c4873b); }
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.25s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-8px); }

.avatar-wrapper { position: relative; z-index: 200; }
.avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; color: #fff; background: linear-gradient(135deg, var(--amber, #c4873b), #92400e); cursor: pointer; }
.avatar-dropdown { position: absolute; top: calc(100% + 8px); right: 0; min-width: 160px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.12); overflow: hidden; }
.dropdown-user { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; }
.dropdown-name { font-size: 0.9rem; font-weight: 600; color: #111827; }
.dropdown-role { font-size: 0.75rem; color: #9ca3af; display: block; }
.dropdown-item { width: 100%; display: flex; align-items: center; gap: 8px; padding: 10px 16px; font-size: 0.85rem; color: #6b7280; background: none; border: none; cursor: pointer; font-family: inherit; }
.dropdown-item:hover { background: #fef2f2; color: #dc2626; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }

/* slot controls */
.search-box { display: flex; align-items: center; gap: 8px; padding: 6px 14px; border-radius: 6px; border: 1px solid rgba(196,135,59,0.2); background: rgba(255,255,255,0.06); margin-right: 8px; }
.search-box input { border: none; outline: none; font-size: 0.82rem; font-family: inherit; background: transparent; color: var(--parchment, #f5f0e8); width: 160px; }
.search-box input::placeholder { color: #b8ae9e; }
.search-box svg { width: 15px; height: 15px; color: #b8ae9e; flex-shrink: 0; }
.btn-admin { padding: 7px 16px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; color: var(--amber, #c4873b); border: 1px solid var(--amber, #c4873b); background: transparent; text-decoration: none; cursor: pointer; font-family: inherit; margin-right: 8px; transition: all 0.2s; }
.btn-admin:hover { background: var(--amber, #c4873b); color: #fff; }
.btn-upload { padding: 7px 18px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; color: #fff; background: var(--amber, #c4873b); border: none; cursor: pointer; font-family: inherit; margin-right: 10px; transition: all 0.2s; }
.btn-upload:hover { background: #a06a28; }

@media (max-width: 768px) {
  .top-nav { display: none; }
  .hamburger { display: flex; }
  .topbar { padding: 0 16px; }
  .logo { font-size: 1.3rem; margin-right: 24px; }
}
</style>
