<template>
  <div
    ref="rootRef"
    class="sketch-tool-dropdown"
    @mousedown.stop
  >
    <!-- 触发器按钮 -->
    <div
      class="sketch-tool-dropdown__trigger"
      @click="toggle"
    >
      <slot name="trigger" />
      <span class="sketch-tool-dropdown__arrow">
        <svg viewBox="0 0 10 10" fill="currentColor">
          <path d="M2 10L10 10L10 2Z" />
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
import { nextTick, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const rootRef = ref<HTMLDivElement>()
let justClosedByOutside = false

function toggle() {
  if (justClosedByOutside) {
    justClosedByOutside = false
    return
  }
  emit('update:modelValue', !props.modelValue)
}

function close() {
  emit('update:modelValue', false)
}

function onClickOutside(e: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) {
    if (props.modelValue) {
      justClosedByOutside = true
      nextTick(() => {
        setTimeout(() => {
          justClosedByOutside = false
        }, 0)
      })
    }
    close()
  }
}

onMounted(() => {
  document.addEventListener('click', onClickOutside, true)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside, true)
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
  right: 0;
  bottom: 0;
  width: 10px;
  height: 10px;
  opacity: 0.5;
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
