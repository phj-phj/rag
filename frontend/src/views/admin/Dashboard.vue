<template>
  <div class="p-6">
    <h2 class="text-2xl font-bold mb-6">
      数据概览
    </h2>

    <StatsCards
      v-if="adminStore.stats"
      :stats="statsCards"
      :loading="adminStore.loading"
    />

    <div class="grid grid-cols-2 gap-6 mt-6">
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="font-semibold mb-4">
          文档分类分布
        </h3>
        <CategoryChart
          v-if="adminStore.stats"
          :categories="adminStore.stats.categoryStats || []"
        />
      </div>
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 class="font-semibold mb-4">
          7日上传趋势
        </h3>
        <UploadTrend
          v-if="adminStore.stats"
          :dates="(adminStore.stats.uploadTrend || []).map((d: any) => d.date)"
          :values="(adminStore.stats.uploadTrend || []).map((d: any) => d.count)"
        />
      </div>
    </div>

    <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
      <h3 class="font-semibold mb-4">
        最近动态
      </h3>
      <div
        v-if="adminStore.stats?.recentActivities?.length"
        class="space-y-3"
      >
        <div
          v-for="(item, idx) in adminStore.stats.recentActivities"
          :key="idx"
          class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
        >
          <div>
            <span class="font-medium text-sm">{{ item.title }}</span>
            <span class="text-gray-400 text-sm ml-2">by {{ item.uploader }}</span>
          </div>
          <span class="text-gray-400 text-xs">{{ formatDate(item.created_at) }}</span>
        </div>
      </div>
      <p
        v-else
        class="text-gray-400 text-sm"
      >
        暂无动态
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAdminStore } from '../../stores/admin'
import StatsCards from '../../components/StatsCards.vue'
import CategoryChart from '../../components/CategoryChart.vue'
import UploadTrend from '../../components/UploadTrend.vue'
import { computed } from 'vue'

const adminStore = useAdminStore()

const statsCards = computed(() => {
  if (!adminStore.stats) return []
  return [
    { label: '文档总数', value: adminStore.stats.totalDocs, icon: '📄' },
    { label: '分类数量', value: adminStore.stats.totalCategories, icon: '📂' },
    { label: '用户数量', value: adminStore.stats.totalUsers, icon: '👥' },
    { label: '系统运行', value: '正常', icon: '✅' },
  ]
})

function formatDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('zh-CN')
}

onMounted(() => {
  adminStore.fetchStats()
})
</script>
