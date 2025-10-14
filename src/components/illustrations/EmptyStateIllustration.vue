<template>
  <div class="empty-state-illustration" role="img" :aria-label="ariaLabel">
    <component :is="currentIllustration" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type: 'timeline' | 'photo-upload' | 'search'
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  ariaLabel: ''
})

const ariaLabels = {
  timeline: 'Empty timeline illustration showing a dotted line with floating memory orb',
  'photo-upload': 'Empty photo upload illustration showing camera and floating photo placeholders',
  search: 'Empty search illustration showing magnifying glass over timeline segments'
}

const currentAriaLabel = computed(() => props.ariaLabel || ariaLabels[props.type])

const currentIllustration = computed(() => {
  switch (props.type) {
    case 'timeline':
      return TimelineEmpty
    case 'photo-upload':
      return PhotoUploadEmpty
    case 'search':
      return SearchEmpty
    default:
      return TimelineEmpty
  }
})
</script>

<script>
const TimelineEmpty = {
  template: `
    <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="emptyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:#e2e8f0"/>
          <stop offset="100%" style="stop-color:#cbd5e1"/>
        </linearGradient>
        <linearGradient id="orbGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#e0e7ff"/>
          <stop offset="100%" style="stop-color:#c7d2fe"/>
        </linearGradient>
      </defs>
      <line x1="50" y1="100" x2="350" y2="100" stroke="url(#emptyGradient)" stroke-width="2" stroke-dasharray="5,5"/>
      <circle cx="200" cy="80" r="20" fill="url(#orbGradient)" stroke="#6366f1" stroke-width="2" opacity="0.7"/>
      <circle cx="200" cy="80" r="8" fill="#06b6d4" opacity="0.5"/>
      <line x1="200" y1="100" x2="200" y2="60" stroke="#e2e8f0" stroke-width="1" opacity="0.5"/>
    </svg>
  `
}

const PhotoUploadEmpty = {
  template: `
    <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cameraGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#e0e7ff"/>
          <stop offset="100%" style="stop-color:#c7d2fe"/>
        </linearGradient>
        <linearGradient id="photoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#fef3c7"/>
          <stop offset="100%" style="stop-color:#fde68a"/>
        </linearGradient>
      </defs>
      <rect x="100" y="60" width="100" height="80" rx="8" stroke="#6366f1" stroke-width="2" fill="url(#cameraGradient)" opacity="0.6"/>
      <circle cx="130" cy="90" r="8" stroke="#06b6d4" stroke-width="2" fill="none"/>
      <circle cx="130" cy="90" r="4" fill="#f59e0b" opacity="0.5"/>
      <rect x="50" y="30" width="40" height="30" rx="4" stroke="#cbd5e1" stroke-width="1" fill="url(#photoGradient)" opacity="0.4"/>
      <rect x="210" y="40" width="40" height="30" rx="4" stroke="#cbd5e1" stroke-width="1" fill="url(#photoGradient)" opacity="0.4"/>
      <rect x="40" y="140" width="40" height="30" rx="4" stroke="#cbd5e1" stroke-width="1" fill="url(#photoGradient)" opacity="0.4"/>
      <rect x="220" y="130" width="40" height="30" rx="4" stroke="#cbd5e1" stroke-width="1" fill="url(#photoGradient)" opacity="0.4"/>
      <path d="M90 45 L110 70 M190 50 L180 70 M80 155 L110 130 M180 145 L180 110" stroke="#e2e8f0" stroke-width="1" opacity="0.5"/>
    </svg>
  `
}

const SearchEmpty = {
  template: `
    <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="searchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#e0e7ff"/>
          <stop offset="100%" style="stop-color:#c7d2fe"/>
        </linearGradient>
      </defs>
      <circle cx="120" cy="80" r="30" stroke="#6366f1" stroke-width="2" fill="url(#searchGradient)" opacity="0.6"/>
      <circle cx="120" cy="80" r="15" fill="none" stroke="#06b6d4" stroke-width="2"/>
      <line x1="135" y1="95" x2="150" y2="110" stroke="#06b6d4" stroke-width="2" stroke-linecap="round"/>
      <line x1="180" y1="60" x2="280" y2="60" stroke="#e2e8f0" stroke-width="2"/>
      <circle cx="200" cy="60" r="4" fill="#cbd5e1"/>
      <circle cx="230" cy="60" r="4" fill="#cbd5e1"/>
      <circle cx="260" cy="60" r="4" fill="#cbd5e1"/>
      <line x1="180" y1="90" x2="280" y2="90" stroke="#e2e8f0" stroke-width="2"/>
      <circle cx="210" cy="90" r="4" fill="#cbd5e1"/>
      <circle cx="240" cy="90" r="4" fill="#cbd5e1"/>
      <line x1="180" y1="120" x2="280" y2="120" stroke="#e2e8f0" stroke-width="2"/>
      <circle cx="220" cy="120" r="4" fill="#cbd5e1"/>
      <circle cx="250" cy="120" r="4" fill="#cbd5e1"/>
      <path d="M150 80 Q165 75 180 80 M150 80 Q165 85 180 100 M150 80 Q165 95 180 120" stroke="#e2e8f0" stroke-width="1" opacity="0.3" fill="none"/>
    </svg>
  `
}
</script>

<style scoped>
.empty-state-illustration {
  display: flex;
  justify-content: center;
  align-items: center;
}

.empty-state-illustration svg {
  width: 200px;
  height: auto;
  opacity: 0.6;
}

@media (max-width: 768px) {
  .empty-state-illustration svg {
    width: 150px;
  }
}
</style>