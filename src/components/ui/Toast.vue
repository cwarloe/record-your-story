<template>
  <Teleport to="body">
    <div
      v-if="visible"
      :class="toastClasses"
      :style="{ bottom: show ? 'var(--space-5)' : '-100px' }"
    >
      <div class="toast-content">
        <span v-if="type === 'success'" class="toast-icon">✓</span>
        <span v-else-if="type === 'error'" class="toast-icon">✕</span>
        <span v-else-if="type === 'info'" class="toast-icon">ℹ</span>
        <span class="toast-message">{{ message }}</span>
      </div>
      <button
        v-if="dismissible"
        class="toast-close"
        @click="dismiss"
        aria-label="Dismiss toast"
      >
        ×
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'

interface Props {
  modelValue: boolean
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
  dismissible?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'dismissed'): void
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  duration: 5000,
  dismissible: true
})

const emit = defineEmits<Emits>()

const visible = ref(false)
const show = ref(false)
const timeoutId = ref<number | null>(null)

const toastClasses = computed(() => {
  const classes = ['toast']

  if (props.type === 'success') classes.push('toast-success')
  else if (props.type === 'error') classes.push('toast-error')
  else if (props.type === 'info') classes.push('toast-info')

  if (show.value) classes.push('show')

  return classes
})

const dismiss = () => {
  show.value = false
  setTimeout(() => {
    visible.value = false
    emit('update:modelValue', false)
    emit('dismissed')
  }, 300) // Match transition duration
}

const startTimer = () => {
  if (props.duration > 0 && timeoutId.value === null) {
    timeoutId.value = window.setTimeout(() => {
      dismiss()
    }, props.duration)
  }
}

const clearTimer = () => {
  if (timeoutId.value !== null) {
    clearTimeout(timeoutId.value)
    timeoutId.value = null
  }
}

watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    visible.value = true
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      show.value = true
      startTimer()
    }, 10)
  } else {
    clearTimer()
    dismiss()
  }
})

watch(() => props.duration, () => {
  clearTimer()
  if (props.modelValue && show.value) {
    startTimer()
  }
})

onMounted(() => {
  if (props.modelValue) {
    visible.value = true
    setTimeout(() => {
      show.value = true
      startTimer()
    }, 10)
  }
})
</script>

<style scoped>
.toast {
  position: fixed;
  bottom: -100px;
  left: 50%;
  transform: translateX(-50%);
  padding: var(--space-3) var(--space-5);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  z-index: 10000;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  min-width: 300px;
  max-width: 500px;
  text-align: center;
  transition: bottom 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.toast.show {
  bottom: var(--space-5);
}

.toast-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-color: #059669;
}

.toast-error {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border-color: #dc2626;
}

.toast-info {
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
  color: white;
  border-color: var(--color-primary);
}

.toast-content {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
}

.toast-icon {
  font-size: var(--font-size-lg);
  font-weight: bold;
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
  text-align: left;
}

.toast-close {
  background: none;
  border: none;
  color: inherit;
  font-size: var(--font-size-xl);
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
  transition: opacity var(--transition-fast);
  flex-shrink: 0;
}

.toast-close:hover {
  opacity: 1;
}

@media (max-width: 768px) {
  .toast {
    min-width: 280px;
    max-width: 90vw;
    left: 50%;
    transform: translateX(-50%);
  }
}
</style>