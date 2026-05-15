<template>
  <div class="min-h-screen bg-gray-50 flex">
    <!-- Sidebar -->
    <aside
      class="w-56 flex-shrink-0 text-white flex flex-col"
      style="background-color: #2c3e50;"
    >
      <div class="p-5 border-b border-white/10">
        <h1 class="text-lg font-bold">
          Papier 管理
        </h1>
      </div>

      <nav class="flex-1 p-3 space-y-1">
        <router-link
          to="/admin"
          class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors"
          :class="$route.path === '/admin' ? 'bg-white/15' : 'hover:bg-white/10'"
        >
          <span>数据概览</span>
        </router-link>
        <router-link
          to="/admin/docs"
          class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors"
          :class="$route.path === '/admin/docs' ? 'bg-white/15' : 'hover:bg-white/10'"
        >
          <span>文档管理</span>
        </router-link>
        <router-link
          to="/admin/users"
          class="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors"
          :class="$route.path === '/admin/users' ? 'bg-white/15' : 'hover:bg-white/10'"
        >
          <span>用户管理</span>
        </router-link>
      </nav>

      <div class="p-3 border-t border-white/10">
        <router-link
          to="/"
          class="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 transition-colors"
        >
          <span>返回前台</span>
        </router-link>
        <button
          class="w-full flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 transition-colors text-left"
          @click="handleLogout"
        >
          <span>退出登录</span>
        </button>
      </div>
    </aside>

    <!-- Main -->
    <div class="flex-1 overflow-auto">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const authStore = useAuthStore()

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>
