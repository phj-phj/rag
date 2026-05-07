<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <h3 class="text-lg font-semibold text-gray-900 mb-4">
      文档分类占比
    </h3>
    <div
      ref="chartContainer"
      class="w-full h-80 rounded-lg overflow-hidden"
    />
    <div class="mt-4 grid grid-cols-2 gap-2">
      <div
        v-for="item in categories"
        :key="item.name"
        class="flex items-center gap-2 text-sm"
      >
        <span
          class="w-3 h-3 rounded-full"
          :style="{ background: item.color }"
        />
        <span class="text-gray-600">{{ item.name }}</span>
        <span class="ml-auto font-medium text-gray-900">{{ item.value }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'

interface Category {
  name: string
  value: number
  color: string
}

const chartContainer = ref<HTMLDivElement | null>(null)

const categories: Category[] = [
  { name: '技术文档', value: 34, color: '#c4873b' },
  { name: '产品需求', value: 21, color: '#7a3b3b' },
  { name: '会议纪要', value: 45, color: '#6b7c5e' },
  { name: '设计规范', value: 16, color: '#2c2418' },
  { name: '周报月报', value: 12, color: '#6b8db5' },
]

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let animationId: number
const bars: THREE.Mesh[] = []

function init() {
  const container = chartContainer.value
  if (!container) return

  const width = container.clientWidth
  const height = container.clientHeight

  // Scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf9fafb)

  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
  camera.position.set(8, 6, 8)
  camera.lookAt(0, 1.5, 0)

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)
  container.appendChild(renderer.domElement)

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 5)
  scene.add(directionalLight)

  // Ground plane
  const groundGeometry = new THREE.PlaneGeometry(12, 12)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0xf3f4f6,
    roughness: 0.8,
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.01
  scene.add(ground)

  // Grid helper
  const gridHelper = new THREE.GridHelper(12, 12, 0xe5e7eb, 0xe5e7eb)
  scene.add(gridHelper)

  // Create bars
  const total = categories.reduce((sum, c) => sum + c.value, 0)
  const maxBarHeight = 4
  const barWidth = 0.8
  const gap = 0.4
  const startX = -((categories.length - 1) * (barWidth + gap)) / 2

  categories.forEach((cat, i) => {
    const height = (cat.value / total) * maxBarHeight * 2.5
    const geometry = new THREE.BoxGeometry(barWidth, height, barWidth)
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(cat.color),
      roughness: 0.4,
      metalness: 0.1,
    })
    const bar = new THREE.Mesh(geometry, material)
    bar.position.x = startX + i * (barWidth + gap)
    bar.position.y = height / 2
    bar.userData = { targetY: height / 2, targetHeight: height }

    // Start from bottom for animation
    bar.scale.y = 0.01
    bar.position.y = 0.01

    scene.add(bar)
    bars.push(bar)
  })

  animate()
}

function animate() {
  animationId = requestAnimationFrame(animate)

  // Animate bars growing
  bars.forEach((bar) => {
    if (bar.scale.y < 1) {
      bar.scale.y += (1 - bar.scale.y) * 0.05
      bar.position.y = (bar.userData.targetHeight * bar.scale.y) / 2
    }
  })

  // Slow rotation
  scene.rotation.y += 0.002

  renderer.render(scene, camera)
}

function handleResize() {
  if (!chartContainer.value || !renderer || !camera) return
  const width = chartContainer.value.clientWidth
  const height = chartContainer.value.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

onMounted(() => {
  init()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (animationId) cancelAnimationFrame(animationId)
  if (renderer) {
    renderer.dispose()
    chartContainer.value?.removeChild(renderer.domElement)
  }
})
</script>
