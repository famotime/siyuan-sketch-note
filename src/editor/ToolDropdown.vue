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
      <span class="sketch-tool-dropdown__arrow">
        <svg viewBox="0 0 6 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1.5 1.5L4.5 4.5" />
        </svg>
      </span>
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
  right: 1px;
  bottom: 1px;
  width: 7px;
  height: 7px;
  opacity: 0.6;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sketch-tool-dropdown__arrow svg {
  width: 100%;
  height: 100%;
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
