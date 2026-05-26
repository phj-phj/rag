<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    <div
      v-for="stat in normalizedStats"
      :key="stat.label"
      class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
    >
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm font-medium text-gray-500">{{ stat.label }}</span>
        <span
          v-if="stat.icon"
          class="text-lg"
        >{{ stat.icon }}</span>
        <span
          v-else-if="stat.change"
          :class="[
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            stat.changeType === 'up'
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-700',
          ]"
        >
          {{ stat.change }}
        </span>
      </div>
      <div class="text-3xl font-bold text-gray-900">
        {{ stat.value }}
      </div>
      <p
        v-if="stat.desc"
        class="mt-1 text-sm text-gray-500"
      >
        {{ stat.desc }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface StatItem {
  label: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down'
  desc?: string
  icon?: string
}

const props = defineProps<{
  stats?: StatItem[]
  loading?: boolean
}>()

const defaultStats: StatItem[] = [
  {
    label: '总文档数',
    value: '—',
    change: '加载中...',
    changeType: 'up',
    desc: '',
  },
]

const normalizedStats = computed(() => {
  if (props.loading || !props.stats || props.stats.length === 0) {
    return defaultStats
  }
  return props.stats
})
</script>
