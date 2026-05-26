<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <h3 class="text-lg font-semibold text-gray-900 mb-4">
      最近上传趋势
    </h3>
    <div
      ref="chartRef"
      class="w-full h-80"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  dates?: string[]
  values?: number[]
}>()

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function getDisplayDates() {
  if (props.dates && props.dates.length > 0) return props.dates
  return ['05-01', '05-02', '05-03', '05-04', '05-05', '05-06', '05-07']
}

function getDisplayValues() {
  if (props.values && props.values.length > 0) return props.values
  return [0, 0, 0, 0, 0, 0, 0]
}

function initChart() {
  if (!chartRef.value) return

  chart = echarts.init(chartRef.value)
  applyOption()
}

function applyOption() {
  if (!chart) return

  const option = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#374151', fontSize: 13 },
      formatter: (params: { name: string; value: number }[]) => {
        const data = params[0]
        return `<div style="font-weight:600">${data.name}</div>
                <div style="color:#6b7280">上传数量: <span style="color:#c4873b;font-weight:600">${data.value} 篇</span></div>`
      },
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: getDisplayDates(),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisTick: { show: false },
      axisLabel: { color: '#6b7280', fontSize: 12 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f3f4f6', type: 'dashed' } },
      axisLabel: { color: '#6b7280', fontSize: 12 },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 8,
        data: getDisplayValues(),
        lineStyle: {
          color: '#c4873b',
          width: 3,
          shadowColor: 'rgba(196, 135, 59, 0.3)',
          shadowBlur: 10,
          shadowOffsetY: 5,
        },
        itemStyle: { color: '#c4873b', borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(196, 135, 59, 0.25)' },
            { offset: 1, color: 'rgba(196, 135, 59, 0.02)' },
          ]),
        },
      },
    ],
    animationDuration: 1500,
    animationEasing: 'cubicOut' as const,
  }

  chart.setOption(option)
}

watch(() => [props.dates, props.values], () => {
  applyOption()
})

function handleResize() {
  chart?.resize()
}

onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
})
</script>
