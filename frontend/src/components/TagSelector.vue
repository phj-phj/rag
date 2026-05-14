<template>
  <div class="flex flex-wrap gap-1.5">
    <span
      v-for="tag in tags"
      :key="tag.id"
      class="inline-block px-2.5 py-1 rounded-full text-xs cursor-pointer transition-colors border"
      :class="
        selectedTags.includes(tag.id)
          ? 'border-blue-500 bg-blue-50 text-blue-700'
          : 'border-gray-200 text-gray-600 hover:border-gray-300'
      "
      @click="toggle(tag.id)"
    >
      {{ tag.name }}
    </span>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  tags: { id: number; name: string }[]
  selectedTags: number[]
}>()
const emit = defineEmits<{
  'update:selectedTags': [value: number[]]
}>()

function toggle(id: number) {
  const val = props.selectedTags.includes(id)
    ? props.selectedTags.filter((t) => t !== id)
    : [...props.selectedTags, id]
  emit('update:selectedTags', val)
}
</script>
