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
          </nav>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Page Title -->
      <div class="mb-8">
        <h2 class="text-2xl font-bold text-gray-900">
          数据概览
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          文档库整体数据与分类统计
        </p>
      </div>

      <!-- Stats Cards -->
      <StatsCards />

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryChart />
        <UploadTrend />
      </div>

      <!-- Recent Activity -->
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
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import StatsCards from '../components/StatsCards.vue'
import CategoryChart from '../components/CategoryChart.vue'
import UploadTrend from '../components/UploadTrend.vue'

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

const recentActivities: Activity[] = [
  {
    id: 1,
    user: '李思远',
    action: '上传了文档',
    target: '前端性能优化白皮书 v3.0',
    time: '2 小时前',
    tag: 'PDF',
    tagClass: 'bg-red-50 text-red-700',
    avatarBg: 'linear-gradient(135deg, #7a3b3b, #a06a28)',
  },
  {
    id: 2,
    user: '王晓涵',
    action: '更新了文档',
    target: '用户增长策略 — Q2 复盘',
    time: '5 小时前',
    tag: 'DOC',
    tagClass: 'bg-green-50 text-green-700',
    avatarBg: 'linear-gradient(135deg, #6b7c5e, #4a6741)',
  },
  {
    id: 3,
    user: '赵雨萱',
    action: '创建了新分类',
    target: '设计规范',
    time: '昨天',
    tag: '分类',
    tagClass: 'bg-amber-50 text-amber-700',
    avatarBg: 'linear-gradient(135deg, #c4873b, #8b5e34)',
  },
  {
    id: 4,
    user: '陈墨白',
    action: '分享了文档',
    target: 'API 接口性能基准测试数据',
    time: '昨天',
    tag: 'SHEET',
    tagClass: 'bg-gray-100 text-gray-700',
    avatarBg: 'linear-gradient(135deg, #2c2418, #5a4d3a)',
  },
  {
    id: 5,
    user: '刘浩然',
    action: '上传了文档',
    target: '微服务架构迁移可行性评估报告',
    time: '3 天前',
    tag: 'PDF',
    tagClass: 'bg-red-50 text-red-700',
    avatarBg: 'linear-gradient(135deg, #6b8db5, #4a6b8a)',
  },
]
</script>
