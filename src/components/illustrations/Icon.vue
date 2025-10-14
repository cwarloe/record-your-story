<template>
  <svg
    :viewBox="viewBox"
    :class="iconClasses"
    :aria-hidden="decorative"
    :aria-label="decorative ? undefined : ariaLabel"
    role="decorative"
  >
    <use :href="iconPath"></use>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'primary' | 'secondary' | 'accent'
  decorative?: boolean
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'primary',
  decorative: true,
  ariaLabel: ''
})

const viewBox = '0 0 24 24'

const iconPath = computed(() => `/icons/${props.name}.svg#${props.name}`)

const iconClasses = computed(() => [
  'icon',
  `icon-${props.size}`,
  `icon-${props.variant}`,
  {
    'icon-interactive': !props.decorative
  }
])
</script>

<style scoped>
.icon {
  width: 24px;
  height: 24px;
  stroke: var(--color-primary);
  transition: stroke var(--transition-fast);
  display: inline-block;
  flex-shrink: 0;
}

.icon:hover {
  stroke: var(--color-primary-hover);
}

.icon-sm {
  width: 16px;
  height: 16px;
}

.icon-md {
  width: 24px;
  height: 24px;
}

.icon-lg {
  width: 32px;
  height: 32px;
}

.icon-xl {
  width: 48px;
  height: 48px;
}

.icon-secondary {
  stroke: var(--color-secondary);
}

.icon-accent {
  stroke: var(--color-accent);
}

.icon-interactive {
  cursor: pointer;
}

.icon-interactive:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 2px;
}
</style>