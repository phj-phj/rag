<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    <div
      v-for="stat in stats"
      :key="stat.label"
      class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow"
    >
      <div class="flex items-center justify-between mb-4">
        <span class="text-sm font-medium text-gray-500">{{ stat.label }}</span>
        <span
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
      <p class="mt-1 text-sm text-gray-500">
        {{ stat.desc }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface StatItem {
  label: string
  value: string | number
  change: string
  changeType: 'up' | 'down'
  desc: string
}

const stats: StatItem[] = [
  {
    label: '总文档数',
    value: 128,
    change: '+12 本月',
    changeType: 'up',
    desc: '较上月增长 10.3%',
  },
  {
    label: '文档分类',
    value: 5,
    change: '稳定',
    changeType: 'up',
    desc: '技术/产品/会议/设计/周报',
  },
  {
    label: '本周上传',
    value: 23,
    change: '+8 较上周',
    changeType: 'up',
    desc: '日均上传 3.3 篇',
  },
  {
    label: '存储用量',
    value: '4.2 GB',
    change: '78% 已用',
    changeType: 'down',
    desc: '总容量 5.4 GB',
  },
]
</script>
