<template>
  <button
    :class="buttonClasses"
    :disabled="disabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="spinner" aria-hidden="true"></span>
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'small' | 'medium' | 'large'
  disabled?: boolean
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'medium',
  disabled: false,
  loading: false
})

const buttonClasses = computed(() => {
  const classes = ['btn']

  if (props.variant === 'primary') classes.push('btn-primary')
  else if (props.variant === 'secondary') classes.push('btn-secondary')
  else if (props.variant === 'danger') classes.push('btn-danger')

  if (props.size === 'small') classes.push('btn-sm')
  else if (props.size === 'large') classes.push('btn-lg')
  // medium is default, no additional class

  return classes
})

const handleClick = (event: Event) => {
  if (props.disabled || props.loading) {
    event.preventDefault()
    return
  }
  // Emit click event if needed, but for now, let it bubble
}
</script>

<style scoped>
/* Additional scoped styles if needed, but using global button styles */
</style>