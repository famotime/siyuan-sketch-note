<template>
  <div
    ref="rootRef"
    class="sketch-tool-dropdown"
  >
    <!-- 触发器按钮 -->
    <div
      class="sketch-tool-dropdown__trigger"
      @click="toggle"
    >
      <slot name="trigger" />
      <span class="sketch-tool-dropdown__arrow" />
    </div>

    <!-- 下拉面板 -->
    <Transition name="sketch-dropdown">
      <div
        v-if="modelValue"
        class="sketch-tool-dropdown__panel"
      >
        <slot name="dropdown" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const rootRef = ref<HTMLDivElement>()

function toggle() {
  emit('update:modelValue', !props.modelValue)
}

function close() {
  emit('update:modelValue', false)
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
})
</script>

<style scoped>
.sketch-tool-dropdown {
  position: relative;
  display: inline-flex;
}

.sketch-tool-dropdown__trigger {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  position: relative;
}

.sketch-tool-dropdown__arrow {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid currentColor;
  opacity: 0.7;
  pointer-events: none;
}

.sketch-tool-dropdown__panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1000;
  min-width: 120px;
  background: var(--sketch-toolbar-control-bg);
  border: 1px solid var(--sketch-toolbar-control-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 4px;
  backdrop-filter: blur(12px);
}

.sketch-dropdown-enter-active,
.sketch-dropdown-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.sketch-dropdown-enter-from,
.sketch-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
