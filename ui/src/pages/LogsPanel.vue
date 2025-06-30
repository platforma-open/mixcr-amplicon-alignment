<script setup lang="ts">
import { PlLogView } from '@platforma-sdk/ui-vue';
import { computed } from 'vue';
import { useApp } from '../app';

const app = useApp();

// Get the debug output log handle
const debugOutput = computed(() => app.model.outputs.debugOutput);
</script>

<template>
  <div v-if="debugOutput">
    <PlLogView 
      :log-handle="debugOutput" 
      label="Repseqio Library Generation Logs"
    />
  </div>
  <div v-else>
    <p>No logs available yet. Logs will appear once the reference library generation process starts.</p>
  </div>
</template> 