<template>
  <div class="form-group">
    <label v-if="label" :for="inputId" class="form-label">
      {{ label }}
      <span v-if="required" class="required-indicator" aria-label="required">*</span>
    </label>

    <div class="input-wrapper" :class="{ 'input-error': hasError, 'input-success': hasSuccess }">
      <input
        :id="inputId"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :maxlength="maxlength"
        :minlength="minlength"
        :pattern="pattern"
        :autocomplete="autocomplete"
        :class="inputClasses"
        @input="handleInput"
        @blur="handleBlur"
        @focus="handleFocus"
        v-bind="$attrs"
      />

      <div v-if="icon" class="input-icon">
        <slot name="icon">{{ icon }}</slot>
      </div>
    </div>

    <div v-if="hasError && errorMessage" class="form-error">
      {{ errorMessage }}
    </div>

    <div v-if="helpText && !hasError" class="form-help">
      {{ helpText }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  modelValue: string | number
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
  label?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  maxlength?: number
  minlength?: number
  pattern?: string
  autocomplete?: string
  error?: boolean
  success?: boolean
  errorMessage?: string
  helpText?: string
  icon?: string
  size?: 'small' | 'medium' | 'large'
}

interface Emits {
  (e: 'update:modelValue', value: string | number): void
  (e: 'blur', event: FocusEvent): void
  (e: 'focus', event: FocusEvent): void
  (e: 'input', event: Event): void
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false,
  readonly: false,
  required: false,
  error: false,
  success: false,
  size: 'medium'
})

const emit = defineEmits<Emits>()

const inputId = ref(`input-${Math.random().toString(36).substr(2, 9)}`)
const isFocused = ref(false)

const hasError = computed(() => props.error)
const hasSuccess = computed(() => props.success && !props.error)

const inputClasses = computed(() => {
  const classes = ['form-input']

  if (props.size === 'small') classes.push('form-input-sm')
  else if (props.size === 'large') classes.push('form-input-lg')

  if (hasError.value) classes.push('form-input-error')
  if (hasSuccess.value) classes.push('form-input-success')
  if (isFocused.value) classes.push('form-input-focused')

  return classes
})

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  let value: string | number = target.value

  if (props.type === 'number') {
    value = target.valueAsNumber || 0
  }

  emit('update:modelValue', value)
  emit('input', event)
}

const handleBlur = (event: FocusEvent) => {
  isFocused.value = false
  emit('blur', event)
}

const handleFocus = (event: FocusEvent) => {
  isFocused.value = true
  emit('focus', event)
}
</script>

<style scoped>
.form-group {
  margin-bottom: var(--space-4);
}

.form-label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-on-surface);
  margin-bottom: var(--space-1);
}

.required-indicator {
  color: var(--color-error);
}

.input-wrapper {
  position: relative;
}

.input-icon {
  position: absolute;
  right: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-on-surface-secondary);
  pointer-events: none;
}

.form-input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  color: var(--color-on-surface);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.1);
}

.form-input::placeholder {
  color: var(--color-on-surface-tertiary);
}

.form-input:disabled {
  background-color: var(--color-surface-tertiary);
  color: var(--color-on-surface-secondary);
  cursor: not-allowed;
}

.form-input[readonly] {
  background-color: var(--color-surface-tertiary);
  cursor: default;
}

.input-wrapper.input-error .form-input {
  border-color: var(--color-error);
}

.input-wrapper.input-error .form-input:focus {
  border-color: var(--color-error);
  box-shadow: 0 0 0 3px rgba(234, 67, 53, 0.1);
}

.input-wrapper.input-success .form-input {
  border-color: var(--color-secondary);
}

.input-wrapper.input-success .form-input:focus {
  border-color: var(--color-secondary);
  box-shadow: 0 0 0 3px rgba(52, 168, 83, 0.1);
}

.form-input-sm {
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-sm);
}

.form-input-lg {
  padding: var(--space-3) var(--space-4);
  font-size: var(--font-size-lg);
}

.form-error {
  font-size: var(--font-size-sm);
  color: var(--color-error);
  margin-top: var(--space-1);
}

.form-help {
  font-size: var(--font-size-sm);
  color: var(--color-on-surface-secondary);
  margin-top: var(--space-1);
}
</style>