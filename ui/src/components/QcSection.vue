<script setup lang="ts">
import { PlStatusTag } from '@platforma-sdk/ui-vue';
import type { QcItem } from '../results';

defineProps<{
  value: QcItem;
}>();
</script>

<template>
  <div class="qc-section">
    <div class="qc-header">
      <PlStatusTag :status="value.status" />
      <span class="qc-title">{{ value.title }}</span>
    </div>
    <div class="qc-message">{{ value.message }}</div>
  </div>
</template>

<style scoped>
.qc-section {
  padding: 1rem;
  border: 1px solid var(--pl-color-border);
  border-radius: 0.5rem;
}

.qc-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.qc-message {
  color: var(--pl-color-text-2);
}
</style> 